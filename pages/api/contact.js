
import { Resend } from 'resend';
import { prisma } from '../../lib/prisma';
import axios from 'axios';
import { render } from '@react-email/render';
import { ContactMessageEmail } from '../../app/emails/contact-message';

const resend = new Resend(process.env.RESEND_API_KEY);

// 🔐 Verify Cloudflare Turnstile token
async function validateTurnstile(token, remoteip) {
  const params = new URLSearchParams();
  params.append('secret', process.env.TURNSTILE_SECRET_KEY);
  params.append('response', token);
  if (remoteip) params.append('remoteip', remoteip);

  try {
    const resp = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    const data = resp.data;
    return data;
  } catch (err) {
    const detail = (axios.isAxiosError(err) && err.response?.data) || null;
    return { success: false, 'error-codes': ['http-error'], detail };
  }
}

// Contact form API - Production ready with full Turnstile verification
export default async function handler(req, res) {
  const startTime = Date.now();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Extract request metadata for logging
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  try {
    const { fullName, email, subject, message, language, turnstileToken } = req.body;

    // ✅ VALIDATE REQUIRED FIELDS
    if (!fullName || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    // 🔐 VERIFY TURNSTILE TOKEN
    if (!turnstileToken) {
      console.warn('[CONTACT API] No Turnstile token provided', { ip });
      return res.status(400).json({
        success: false,
        error: 'Security verification required'
      });
    }

    // 🔐 TURNSTILE VERIFICATION
    const validation = await validateTurnstile(turnstileToken, ip);

    if (!validation.success) {
      console.error('[CONTACT API] Invalid Turnstile token:', validation['error-codes']);
      return res.status(400).json({
        success: false,
        error: 'Invalid verification. Please try again.',
        errorCodes: validation['error-codes']
      });
    }

    // ✅ BASIC VALIDATION
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    if (subject.trim().length < 2 || subject.trim().length > 120) {
      return res.status(400).json({
        success: false,
        error: 'Subject must be between 2 and 120 characters'
      });
    }

    if (message.trim().length < 2 || message.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message must be between 2 and 2000 characters'
      });
    }

    // 💾 SAVE TO DATABASE
    try {
      const dbMessage = await prisma.contactMessage.create({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          subject: subject.trim(),
          message: message.trim(),
        },
      });

      // 📧 SEND EMAILS (synchronously to ensure they complete before response)
      try {
        // Format timestamp in readable format
        const now = new Date();
        const formattedTimestamp = language === 'he'
          ? now.toLocaleString('he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Jerusalem',
          })
          : now.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Jerusalem',
        });

        const emailData = {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          subject: subject.trim(),
          message: message.trim(),
          isHebrew: language === 'he',
          timestamp: formattedTimestamp,
        };

        // 1. Render and send team notification email
        const teamEmailHtml = await render(ContactMessageEmail({
          fullName: emailData.fullName,
          email: emailData.email,
          subject: emailData.subject,
          message: emailData.message,
          timestamp: emailData.timestamp,
          isHebrew: emailData.isHebrew,
          isCustomerConfirmation: false,
        }));

        try {
          await resend.emails.send({
            from: 'Sako Or Contact Form <info@sako-or.com>',
            to: ['avshi@sako-or.com', 'moshe@sako-or.com'],
            replyTo: email.trim().toLowerCase(),
            subject: `New Contact Message: ${subject.trim()}`,
            html: teamEmailHtml,
          });
        } catch (teamEmailError) {
          console.error('[CONTACT API] Team email failed:', teamEmailError.message);
        }

        // 2. Wait 600ms to avoid Resend rate limit (2 requests per second)
        await new Promise(resolve => setTimeout(resolve, 600));

        // 3. Render and send customer confirmation email
        try {
          const customerEmailHtml = await render(ContactMessageEmail({
            fullName: emailData.fullName,
            email: emailData.email,
            subject: emailData.subject,
            message: emailData.message,
            timestamp: emailData.timestamp,
            isHebrew: emailData.isHebrew,
            isCustomerConfirmation: true,
          }));

          await resend.emails.send({
            from: 'Sako Or <info@sako-or.com>',
            to: [email.trim().toLowerCase()],
            subject: language === 'he' ? 'תודה על פנייתך - Sako Or' : 'Thank you for contacting Sako Or',
            html: customerEmailHtml,
          });
        } catch (customerEmailError) {
          console.error('[CONTACT API] Customer email failed:', customerEmailError.message);
        }

      } catch (emailError) {
        console.error('[CONTACT API] Email send failed:', emailError.message);
      }

      // ✅ RETURN SUCCESS AFTER EMAILS ARE SENT
      return res.status(200).json({
        success: true,
        message: 'Message sent successfully! Thank you for contacting us.',
        id: dbMessage.id,
      });

    } catch (dbError) {
      console.error('[CONTACT API] Database operation failed:', {
        error: dbError.message || dbError,
        ip,
        userAgent,
        duration: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      });

      // Still send email to team even if database fails
      try {
        const now = new Date();
        const formattedTimestamp = language === 'he'
          ? now.toLocaleString('he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Jerusalem',
          })
          : now.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Jerusalem',
          });

        const fallbackEmailHtml = await render(ContactMessageEmail({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          subject: subject.trim(),
          message: message.trim() + '\n\n⚠️ Database was unavailable - message not saved to database',
          timestamp: formattedTimestamp,
          isHebrew: language === 'he',
          isCustomerConfirmation: false,
        }));

        await resend.emails.send({
          from: 'Sako Or Contact Form <info@sako-or.com>',
          to: ['avshi@sako-or.com', 'moshe@sako-or.com'],
          replyTo: email.trim().toLowerCase(),
          subject: `New Contact Message: ${subject.trim()}`,
          html: fallbackEmailHtml,
        });
      } catch (emailError) {
        console.error('[CONTACT API] Fallback email failed:', emailError.message);
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to process your message. Please try again later.',
      });
    }

  } catch (error) {
    console.error('[CONTACT API] Unexpected error:', {
      error: error.message || error,
      ip,
      userAgent,
      duration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      success: false,
      error: 'Server error. Please try again later.',
    });
  }
}
