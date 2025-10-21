
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

    console.log('[CONTACT API] Request received:', {
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
      language,
    });

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

    if (validation.success) {
      // Token is valid - proceed with form processing
      console.log('[CONTACT API] ✅ Turnstile validation successful from:', validation.hostname);
    } else {
      // Token is invalid - reject the submission
      console.error('[CONTACT API] ❌ Invalid Turnstile token:', validation['error-codes']);
      return res.status(400).json({
        success: false,
        error: 'Invalid verification. Please try again.',
        errorCodes: validation['error-codes']
      });
    }

    // ✅ BASIC VALIDATION
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[CONTACT API] Invalid email format:', email);
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    if (subject.trim().length < 2 || subject.trim().length > 120) {
      console.log('[CONTACT API] Subject length invalid:', subject.length);
      return res.status(400).json({
        success: false,
        error: 'Subject must be between 2 and 120 characters'
      });
    }

    if (message.trim().length < 2 || message.trim().length > 2000) {
      console.log('[CONTACT API] Message length invalid:', message.length);
      return res.status(400).json({
        success: false,
        error: 'Message must be between 2 and 2000 characters'
      });
    }

    console.log('[CONTACT API] Validation passed - saving to database');

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

      console.log('[CONTACT API] Message saved to PostgreSQL:', dbMessage.id);

      // 📧 SEND EMAILS (synchronously to ensure they complete before response)
      console.log('[CONTACT API] Sending emails...');

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
            hour12: false
          })
          : now.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const emailData = {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          subject: subject.trim(),
          message: message.trim(),
          isHebrew: language === 'he',
          timestamp: formattedTimestamp,
        };

        console.log('[CONTACT API] Attempting to send team notification email...', {
          to: ['avshi@sako-or.com', 'moshe@sako-or.com'],
          from: 'Sako Or Contact Form <noreply@sako-or.com>',
          subject: `New Contact Message: ${subject.trim()}`,
          hasResendKey: !!process.env.RESEND_API_KEY,
          resendKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 7) + '...',
        });

        // 1. Render team email HTML
        console.log('[CONTACT API] Rendering team email HTML...');
        const teamEmailHtml = await render(ContactMessageEmail({
          fullName: emailData.fullName,
          email: emailData.email,
          subject: emailData.subject,
          message: emailData.message,
          timestamp: emailData.timestamp,
          isHebrew: emailData.isHebrew,
          isCustomerConfirmation: false,
        }));
        console.log('[CONTACT API] Team email HTML rendered successfully, length:', teamEmailHtml.length);

        // 2. Send email to team (notification)
        console.log('[CONTACT API] Sending team email via Resend...');
        console.log('[CONTACT API] Email payload:', {
          from: 'Sako Or Contact Form <info@sako-or.com>',
          to: ['avshi@sako-or.com', 'moshe@sako-or.com'],
          replyTo: email.trim().toLowerCase(),
          subject: `New Contact Message: ${subject.trim()}`,
          htmlLength: teamEmailHtml.length,
          htmlPreview: teamEmailHtml.substring(0, 200)
        });
        
        let teamEmailResult;
        try {
          // Send team notification email
          teamEmailResult = await resend.emails.send({
            from: 'Sako Or Contact Form <info@sako-or.com>',
            to: ['avshi@sako-or.com', 'moshe@sako-or.com'],
            replyTo: email.trim().toLowerCase(),
            subject: `New Contact Message: ${subject.trim()}`,
            html: teamEmailHtml,
          });
          
          console.log('[CONTACT API] Resend API response received:', { 
            hasData: !!teamEmailResult.data, 
            hasError: !!teamEmailResult.error,
            data: teamEmailResult.data,
            error: teamEmailResult.error
          });

          console.log('[CONTACT API] ✅ Team notification email sent successfully:', {
            id: teamEmailResult.data?.id,
            error: teamEmailResult.error,
            fullResult: teamEmailResult
          });

          // Check if team email had errors
          if (teamEmailResult.error) {
            console.error('[CONTACT API] ⚠️ Team email had errors but continuing:', teamEmailResult.error);
          }
        } catch (teamEmailError) {
          console.error('[CONTACT API] ❌ Team email send failed:', {
            message: teamEmailError.message,
            error: teamEmailError,
            stack: teamEmailError.stack
          });
          // Continue to try customer email even if team email fails
        }

        // 3. Send confirmation email to customer
        // Wait 600ms to avoid Resend rate limit (2 requests per second)
        console.log('[CONTACT API] Waiting 600ms before sending customer email (rate limit)...');
        await new Promise(resolve => setTimeout(resolve, 600));
        
        console.log('[CONTACT API] Attempting to send customer confirmation email...', {
          to: email.trim().toLowerCase(),
          subject: language === 'he' ? 'תודה על פנייתך - Sako Or' : 'Thank you for contacting Sako Or',
          emailData
        });

        try {
          console.log('[CONTACT API] Rendering customer email HTML...');
          const customerEmailHtml = await render(ContactMessageEmail({
            fullName: emailData.fullName,
            email: emailData.email,
            subject: emailData.subject,
            message: emailData.message,
            timestamp: emailData.timestamp,
            isHebrew: emailData.isHebrew,
            isCustomerConfirmation: true,
          }));
          console.log('[CONTACT API] Customer email HTML rendered successfully, length:', customerEmailHtml.length);

          console.log('[CONTACT API] Sending customer email via Resend...');
          const customerEmailResult = await resend.emails.send({
            from: 'Sako Or <info@sako-or.com>',
            to: [email.trim().toLowerCase()],
            subject: language === 'he' ? 'תודה על פנייתך - Sako Or' : 'Thank you for contacting Sako Or',
            html: customerEmailHtml,
            headers: {
              'X-Entity-Ref-ID': (new Date().getTime() + 1).toString(),
            },
          });

          console.log('[CONTACT API] ✅ Customer confirmation email sent successfully:', {
            id: customerEmailResult.data?.id,
            error: customerEmailResult.error
          });
        } catch (customerEmailError) {
          console.error('[CONTACT API] ❌ Customer email failed:', {
            message: customerEmailError.message,
            error: customerEmailError,
            stack: customerEmailError.stack
          });
          // Continue even if customer email fails - team was notified
        }

      } catch (emailError) {
        console.error('[CONTACT API] ❌ Email send failed (non-critical):', {
          message: emailError.message,
          error: emailError,
          stack: emailError.stack
        });
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

      // Still send emails even if database fails
      console.log('[CONTACT API] Database failed, but sending emails anyway...');

      // Send emails in background without blocking response
      (async () => {
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
              hour12: false
            })
            : now.toLocaleString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });

          // Send email to team (notification)
          await resend.emails.send({
            from: 'Sako Or Contact Form <info@sako-or.com>',
            to: ['avshi@sako-or.com', 'moshe@sako-or.com'],
            replyTo: email.trim().toLowerCase(),
            subject: `New Contact Message: ${subject.trim()}`,
            html: await render(ContactMessageEmail({
              fullName: fullName.trim(),
              email: email.trim().toLowerCase(),
              subject: subject.trim(),
              message: message.trim() + '\n\n⚠️ Database was unavailable - message not saved to database',
              timestamp: formattedTimestamp,
              isHebrew: language === 'he',
              isCustomerConfirmation: false,
            })),
          });

          console.log('[CONTACT API] ✅ Fallback email sent to team (DB failed)');
        } catch (emailError) {
          console.error('[CONTACT API] ❌ Fallback email also failed:', emailError.message);
        }
      })();

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
