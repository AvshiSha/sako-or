import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Resend } from 'resend';
import { ContactMessageEmail } from '@/app/emails/contact-message';
import crypto from 'crypto';

const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory rate limiting store (consider using Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0].trim() || realIP || 'unknown';
}

// Helper function to check rate limit
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetTime) {
    // New entry or expired
    rateLimitStore.set(ip, { count: 1, resetTime: now + hourInMs });
    return { allowed: true, remaining: 4 };
  }

  if (entry.count >= 5) {
    // Max 5 requests per hour
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: 5 - entry.count };
}

// Helper function to validate content for spam patterns
function containsSpam(text: string): boolean {
  const spamPatterns = [
    /https?:\/\//i, // URLs
    /<[^>]*>/g, // HTML tags
    /\b(viagra|cialis|casino|lottery|winner|congratulations)\b/i, // Spam keywords
    /(.)\1{10,}/, // Repeated characters (more than 10 in a row)
    /[^\w\s\u0590-\u05FF.,!?@()-]{5,}/, // Too many special characters
  ];

  // Check for random letter strings (bot-generated content)
  if (isRandomLetterString(text)) {
    return true;
  }

  return spamPatterns.some(pattern => pattern.test(text));
}

// Helper function to detect random letter strings (bot spam)
function isRandomLetterString(text: string): boolean {
  // Check if text contains Hebrew characters
  const hasHebrew = /[\u0590-\u05FF]/.test(text);
  const hasLatin = /[a-zA-Z]/.test(text);
  
  // If text contains Hebrew, don't apply Latin spam detection
  // Hebrew text should be validated separately
  if (hasHebrew && !hasLatin) {
    return false; // Let Hebrew text pass through
  }
  
  // If text is mixed Hebrew + Latin, only check the Latin parts
  if (hasHebrew && hasLatin) {
    // Extract only Latin characters for spam detection
    const latinOnly = text.replace(/[\u0590-\u05FF\s]/g, '');
    if (latinOnly.length < 8) return false; // Too short to be spam
    
    // Apply spam detection only to Latin parts
    return isRandomLetterString(latinOnly);
  }
  
  // Pure Latin text - apply full spam detection
  const cleanText = text.replace(/\s/g, '').toLowerCase();
  
  // Must be at least 8 characters to avoid false positives
  if (cleanText.length < 8) return false;
  
  // Check if it's mostly letters (at least 80%)
  const letterCount = (cleanText.match(/[a-z]/g) || []).length;
  const letterRatio = letterCount / cleanText.length;
  
  if (letterRatio < 0.8) return false;
  
  // Check for patterns that indicate random generation
  // 1. Very few vowels (less than 20% of letters - bot spam has almost no vowels)
  const vowelCount = (cleanText.match(/[aeiou]/g) || []).length;
  const vowelRatio = vowelCount / letterCount;
  
  // 2. Check for alternating case pattern (mixed case spam like WYPHoqRKkPJbPgcA)
  const hasAlternatingCase = /[a-z][A-Z]|[A-Z][a-z]/.test(text);
  
  // 3. Check for excessive consonants in a row (4+ consonants)
  const hasExcessiveConsonants = /[bcdfghjklmnpqrstvwxyz]{4,}/i.test(cleanText);
  
  // 4. Check for common word patterns (legitimate text has these)
  const hasCommonPatterns = /(ing|tion|ness|ment|able|ible|hello|world|product|inquiry|help|question|support)/i.test(cleanText);
  
  // 5. Check for dictionary words (English and Hebrew)
  const hasEnglishWords = /(hello|world|product|inquiry|help|question|support|about|contact|information|service|order|buy|purchase|price|cost|delivery|shipping|return|refund)/i.test(cleanText);
  const hasHebrewWords = /(שלום|מוצר|שאלה|עזרה|תמיכה|מידע|שירות|הזמנה|קנייה|מחיר|משלוח|החזר|צור|קשר)/i.test(text);
  const hasDictionaryWords = hasEnglishWords || hasHebrewWords;
  
  // Flag as spam if ANY of these patterns match:
  // Pattern 1: Very few vowels + alternating case + no dictionary words
  const pattern1 = (vowelRatio < 0.2) && hasAlternatingCase && !hasDictionaryWords;
  
  // Pattern 2: Very few vowels + no dictionary words + excessive consonants
  const pattern2 = (vowelRatio < 0.2) && !hasDictionaryWords && hasExcessiveConsonants;
  
  // Pattern 3: Very few vowels + all uppercase + no dictionary words
  const isAllUppercase = /^[A-Z\s]+$/.test(text) && text.length >= 8;
  const pattern3 = (vowelRatio < 0.2) && isAllUppercase && !hasDictionaryWords;
  
  // Pattern 4: Random letter string with no dictionary words (catches oMOSIggooBo type spam)
  // - Has alternating case OR all uppercase
  // - No dictionary words
  // - No common word endings (ing, tion, etc.)
  const hasCommonEndings = /(ing|tion|ness|ment|able|ible|ly|ed|er|est)$/i.test(cleanText);
  const hasAlternatingOrUpper = hasAlternatingCase || isAllUppercase;
  const pattern4 = hasAlternatingOrUpper && !hasDictionaryWords && !hasCommonEndings && cleanText.length >= 10;
  
  return pattern1 || pattern2 || pattern3 || pattern4;
}

// Helper function to generate idempotency key
function generateIdempotencyKey(fullName: string, email: string, subject: string, message: string, timestamp: Date): string {
  const data = `${fullName}:${email}:${subject}:${message}:${timestamp.toISOString().slice(0, 10)}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Helper function to check for duplicate submission
async function isDuplicateSubmission(idempotencyKey: string): Promise<boolean> {
  try {
    // Check in Firebase (faster for recent submissions)
    const q = query(
      collection(db, 'contact_messages'),
      where('idempotencyKey', '==', idempotencyKey),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking duplicate submission:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // Extract request metadata for logging
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const referrer = request.headers.get('referer') || 'direct';
  const origin = request.headers.get('origin') || 'unknown';

  try {
    const body = await request.json();
    const { fullName, email, subject, message, language, honeypot } = body;

    // 🍯 HONEYPOT CHECK - Bots fill this hidden field
    if (honeypot) {
      console.warn('[SPAM DETECTED] Honeypot field filled', {
        ip,
        userAgent,
        honeypot,
        timestamp: new Date().toISOString(),
      });
      // Return success to not alert the bot
      return NextResponse.json(
        { success: true, message: 'Message received' },
        { status: 200 }
      );
    }

    // 📊 LOG REQUEST
    console.log('[CONTACT FORM] Request received', {
      ip,
      userAgent,
      referrer,
      origin,
      timestamp: new Date().toISOString(),
      language,
    });

    // 🚦 RATE LIMITING - Max 5 requests per hour per IP
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      console.warn('[RATE LIMIT] Too many requests', {
        ip,
        userAgent,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // ✅ VALIDATE REQUIRED FIELDS
    if (!fullName || !email || !subject || !message) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 }
      );
    }

    // ✅ VALIDATE NAME (2-80 letters only, allow spaces and some punctuation)
    const nameRegex = /^[a-zA-Z\u0590-\u05FF\s'-]{2,80}$/;
    if (!nameRegex.test(fullName.trim())) {
      console.warn('[VALIDATION FAILED] Invalid name format', { ip, fullName });
      return NextResponse.json(
        { success: false, error: 'Invalid name format. Please use 2-80 letters only.' },
        { status: 400 }
      );
    }

    // ✅ VALIDATE EMAIL FORMAT
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // ✅ VALIDATE SUBJECT (3-120 characters, no links or HTML)
    if (subject.trim().length < 3 || subject.trim().length > 120) {
      return NextResponse.json(
        { success: false, error: 'Subject must be between 3 and 120 characters' },
        { status: 400 }
      );
    }

    if (containsSpam(subject)) {
      console.warn('[SPAM DETECTED] Suspicious subject content', { ip, subject });
      return NextResponse.json(
        { success: false, error: 'Invalid subject content' },
        { status: 400 }
      );
    }

    // ✅ VALIDATE MESSAGE (10-2000 characters, no HTML or excessive links)
    if (message.trim().length < 10 || message.trim().length > 2000) {
      return NextResponse.json(
        { success: false, error: 'Message must be between 10 and 2000 characters' },
        { status: 400 }
      );
    }

    if (containsSpam(message)) {
      console.warn('[SPAM DETECTED] Suspicious message content', { ip, message: message.substring(0, 100) });
      return NextResponse.json(
        { success: false, error: 'Invalid message content' },
        { status: 400 }
      );
    }

    const timestamp = new Date();
    const isHebrew = language === 'he';

    // 🔑 IDEMPOTENCY CHECK - Prevent duplicate submissions
    const idempotencyKey = generateIdempotencyKey(fullName, email, subject, message, timestamp);
    
    const isDuplicate = await isDuplicateSubmission(idempotencyKey);
    if (isDuplicate) {
      console.warn('[DUPLICATE SUBMISSION] Same message already processed', {
        ip,
        email,
        idempotencyKey,
        timestamp: timestamp.toISOString(),
      });
      return NextResponse.json(
        { success: true, message: 'Message already received' },
        { status: 200 }
      );
    }

    // Format timestamp for email
    const formattedTimestamp = timestamp.toLocaleString(isHebrew ? 'he-IL' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // 💾 1. Store in Neon (PostgreSQL) database
    let neonContactMessage;
    try {
      neonContactMessage = await prisma.contactMessage.create({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          subject: subject.trim(),
          message: message.trim(),
          idempotencyKey,
          createdAt: timestamp,
        },
      });
      console.log(`[DB] Contact message stored in Neon DB with ID: ${neonContactMessage.id}`);
    } catch (prismaError) {
      console.error('[DB ERROR] Failed to store contact message in Neon DB:', prismaError);
    }

    // 💾 2. Store in Firebase (Firestore) database
    let firebaseId;
    try {
      const docRef = await addDoc(collection(db, 'contact_messages'), {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        message: message.trim(),
        createdAt: timestamp,
        idempotencyKey,
        metadata: {
          ip,
          userAgent,
          referrer,
          origin,
        },
      });
      firebaseId = docRef.id;
      console.log(`[DB] Contact message stored in Firebase with ID: ${firebaseId}`);
    } catch (firebaseError) {
      console.error('[DB ERROR] Failed to store contact message in Firebase:', firebaseError);
    }

    // 📧 3. Send email notifications ONLY to admins
    if (!process.env.RESEND_API_KEY) {
      console.error('[EMAIL ERROR] RESEND_API_KEY environment variable is not set');
      return NextResponse.json(
        { 
          success: true, 
          message: 'Contact message saved but email could not be sent (missing API key)',
          id: neonContactMessage?.id || firebaseId 
        },
        { status: 200 }
      );
    }

    try {
      const emailSubject = isHebrew 
        ? `הודעת צור קשר חדשה - ${subject.trim()}`
        : `New Contact Message - ${subject.trim()}`;

      // Send ONLY to internal recipients (not to customer to avoid spam loops)
      const recipients = [
        'avshi@sako-or.com',
        'moshe@sako-or.com',
        'info@sako-or.com',
      ];

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: 'Sako Or Contact Form <info@sako-or.com>',
        to: recipients,
        replyTo: email.trim(), // Customer can be replied to here
        subject: emailSubject,
        react: ContactMessageEmail({
          fullName: fullName.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          timestamp: formattedTimestamp,
          isHebrew,
        }),
        headers: {
          'X-Contact-Form-IP': ip,
          'X-Contact-Form-User-Agent': userAgent,
        },
      }, {
        // Idempotency for Resend to prevent duplicate sends
        idempotencyKey: `contact-${idempotencyKey}`,
      });

      if (emailError) {
        console.error('[EMAIL ERROR] Failed to send contact message email:', emailError);
        return NextResponse.json(
          { 
            success: true, 
            message: 'Contact message saved but email failed to send',
            id: neonContactMessage?.id || firebaseId,
            emailError: emailError 
          },
          { status: 200 }
        );
      }

      const duration = Date.now() - startTime;
      console.log(`[EMAIL SUCCESS] Contact message email sent successfully`, {
        messageId: emailData?.id,
        duration: `${duration}ms`,
        recipients: recipients.length,
      });
      
      return NextResponse.json({
        success: true,
        message: 'Contact message sent successfully',
        id: neonContactMessage?.id || firebaseId,
        emailMessageId: emailData?.id,
      });

    } catch (emailException) {
      console.error('[EMAIL EXCEPTION] Exception while sending contact message email:', emailException);
      return NextResponse.json(
        { 
          success: true, 
          message: 'Contact message saved but email encountered an error',
          id: neonContactMessage?.id || firebaseId,
          emailError: emailException instanceof Error ? emailException.message : 'Unknown error'
        },
        { status: 200 }
      );
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[CONTACT FORM ERROR] Contact form submission error:', {
      error,
      ip,
      userAgent,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process contact message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
