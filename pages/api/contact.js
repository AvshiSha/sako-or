import { Resend } from 'resend';
import { prisma } from '../../lib/prisma';
import { ContactMessageEmail } from '../../app/emails/contact-message';

const resend = new Resend(process.env.RESEND_API_KEY);

// 🔐 Verify Cloudflare Turnstile token
async function validateTurnstile(token, remoteip) {
  // Use URLSearchParams instead of FormData for better Node.js compatibility
  const formData = new URLSearchParams();
  formData.append('secret', process.env.TURNSTILE_SECRET_KEY);
  formData.append('response', token);
  formData.append('remoteip', remoteip);

  try {
    console.log('[TURNSTILE] Starting verification...');
    
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });
    
    console.log('[TURNSTILE] Response status:', response.status);
    console.log('[TURNSTILE] Response ok:', response.ok);
    console.log('[TURNSTILE] Response headers:', Object.fromEntries(response.headers.entries()));
    
    // Try to read the response text first to debug
    const text = await response.text();
    console.log('[TURNSTILE] Response text:', text);
    
    try {
      const result = JSON.parse(text);
      console.log('[TURNSTILE] Verification result:', result.success);
      return result;
    } catch (parseError) {
      console.error('[TURNSTILE] Failed to parse JSON:', parseError);
      return { success: false, 'error-codes': ['json-parse-error'] };
    }
  } catch (error) {
    console.error('[TURNSTILE] Validation error:', error);
    return { success: false, 'error-codes': ['internal-error'] };
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
    console.log('[CONTACT API] Attempting Turnstile verification...');
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

    if (message.trim().length < 3 || message.trim().length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message must be between 3 and 2000 characters'
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

      // 📧 SEND EMAILS IN BACKGROUND (non-blocking)
      console.log('[CONTACT API] Sending emails in background...');
      
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

          const emailData = {
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            subject: subject.trim(),
            message: message.trim(),
            isHebrew: language === 'he',
            timestamp: formattedTimestamp,
          };

          console.log('[CONTACT API] Attempting to send team notification email...', {
            to: ['avshi@sako-or.com', 'moshe@sako-or.com', 'info@sako-or.com'],
            from: 'Sako Or Contact Form <noreply@sako-or.com>',
            subject: `New Contact Message: ${subject.trim()}`,
            hasResendKey: !!process.env.RESEND_API_KEY,
            resendKeyPrefix: process.env.RESEND_API_KEY?.substring(0, 7) + '...',
          });

          // 1. Send email to team (notification)
          const teamEmailResult = await resend.emails.send({
            from: 'Sako Or Contact Form <info@sako-or.com>',
            to: ['avshi@sako-or.com', 'moshe@sako-or.com'],
            replyTo: email.trim().toLowerCase(),
            subject: `New Contact Message: ${subject.trim()}`,
            html: `
              <!DOCTYPE html>
              <html dir="${language === 'he' ? 'rtl' : 'ltr'}" lang="${language === 'he' ? 'he' : 'en'}">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px; direction: ${language === 'he' ? 'rtl' : 'ltr'};">
                  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #4F46E5; padding: 20px; text-align: ${language === 'he' ? 'right' : 'left'};">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${language === 'he' ? 'הודעת צור קשר חדשה' : 'New Contact Message'}</h1>
                    </div>
                    <div style="padding: 30px;">
                      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'מאת' : 'From'}:</td>
                            <td style="padding: 8px 0; color: #333; text-align: ${language === 'he' ? 'left' : 'right'};">${fullName.trim()}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'אימייל' : 'Email'}:</td>
                            <td style="padding: 8px 0; color: #333; text-align: ${language === 'he' ? 'left' : 'right'};"><span dir="ltr">${email.trim().toLowerCase()}</span></td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'נושא' : 'Subject'}:</td>
                            <td style="padding: 8px 0; color: #333; text-align: ${language === 'he' ? 'left' : 'right'};">${subject.trim()}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'זמן' : 'Time'}:</td>
                            <td style="padding: 8px 0; color: #333; text-align: ${language === 'he' ? 'left' : 'right'};">${formattedTimestamp}</td>
                          </tr>
                        </table>
                      </div>
                      <div>
                        <h2 style="color: #333; font-size: 18px; margin-bottom: 10px; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'הודעה' : 'Message'}:</h2>
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; white-space: pre-wrap; text-align: ${language === 'he' ? 'right' : 'left'};">${message.trim()}</div>
                      </div>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e6ebf1;">
                      <p style="color: #666; font-size: 12px; margin: 0;">${language === 'he' ? 'הודעה זו נשלחה דרך טופס יצירת הקשר באתר Sako Or' : 'This message was sent via the Sako Or website contact form'}</p>
                    </div>
                  </div>
                </body>
              </html>
            `,
            headers: {
              'X-Entity-Ref-ID': new Date().getTime().toString(),
            },
          });
          
          console.log('[CONTACT API] ✅ Team notification email sent successfully:', {
            id: teamEmailResult.data?.id,
            error: teamEmailResult.error,
            fullResult: teamEmailResult
          });

          // 2. Send confirmation email to customer
          const customerEmailResult = await resend.emails.send({
            from: 'Sako Or <info@sako-or.com>',
            to: [email.trim().toLowerCase()],
            subject: language === 'he' ? 'תודה על פנייתך - Sako Or' : 'Thank you for contacting Sako Or',
            html: `
              <!DOCTYPE html>
              <html dir="${language === 'he' ? 'rtl' : 'ltr'}" lang="${language === 'he' ? 'he' : 'en'}">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px; direction: ${language === 'he' ? 'rtl' : 'ltr'};">
                  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #4F46E5; padding: 20px; text-align: ${language === 'he' ? 'right' : 'left'};">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${language === 'he' ? 'תודה על פנייתך - Sako Or' : 'Thank you for contacting Sako Or'}</h1>
                    </div>
                    <div style="padding: 30px;">
                      <p style="color: #333; font-size: 16px; line-height: 24px; text-align: ${language === 'he' ? 'right' : 'left'};">
                        ${language === 'he' ? `שלום ${fullName.trim()}` : `Dear ${fullName.trim()}`},
                      </p>
                      <p style="color: #333; font-size: 16px; line-height: 24px; text-align: ${language === 'he' ? 'right' : 'left'};">
                        ${language === 'he' ? 'תודה רבה על פנייתך אלינו! קיבלנו את הודעתך ונחזור אליך בהקדם האפשרי.' : 'Thank you for reaching out to us! We have received your message and will get back to you as soon as possible.'}
                      </p>
                      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h2 style="color: #333; font-size: 18px; margin: 0 0 15px 0; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'פרטי ההודעה שלך:' : 'Your message details:'}</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'נושא:' : 'Subject:'}</td>
                            <td style="padding: 8px 0; color: #333; text-align: ${language === 'he' ? 'left' : 'right'};">${subject.trim()}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold; vertical-align: top; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'הודעה:' : 'Message:'}</td>
                            <td style="padding: 8px 0; color: #333; text-align: ${language === 'he' ? 'left' : 'right'}; white-space: pre-wrap;">${message.trim()}</td>
                          </tr>
                        </table>
                      </div>
                      <p style="color: #333; font-size: 16px; line-height: 24px; text-align: ${language === 'he' ? 'right' : 'left'};">
                        ${language === 'he' ? 'בברכה, הצוות של Sako Or' : 'Best regards, The Sako Or Team'}
                      </p>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e6ebf1;">
                      <p style="color: #666; font-size: 12px; margin: 0;">Sako Or | Premium Footwear & Accessories</p>
                    </div>
                  </div>
                </body>
              </html>
            `,
            headers: {
              'X-Entity-Ref-ID': (new Date().getTime() + 1).toString(),
            },
          });
          
          console.log('[CONTACT API] ✅ Customer confirmation email sent successfully:', {
            id: customerEmailResult.data?.id,
            error: customerEmailResult.error
          });
          
        } catch (emailError) {
          console.error('[CONTACT API] ❌ Email send failed (non-critical):', {
            message: emailError.message,
            error: emailError,
            stack: emailError.stack
          });
        }
      })();

      // ✅ RETURN SUCCESS IMMEDIATELY
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
            html: `
              <!DOCTYPE html>
              <html dir="${language === 'he' ? 'rtl' : 'ltr'}" lang="${language === 'he' ? 'he' : 'en'}">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; background-color: #f6f9fc; margin: 0; padding: 20px; direction: ${language === 'he' ? 'rtl' : 'ltr'};">
                  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #4F46E5; padding: 20px; text-align: ${language === 'he' ? 'right' : 'left'};">
                      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${language === 'he' ? 'הודעת צור קשר חדשה' : 'New Contact Message'}</h1>
                    </div>
                    <div style="padding: 30px;">
                      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'מאת' : 'From'}:</td>
                            <td style="padding: 8px 0; color: #333; text-align: ${language === 'he' ? 'left' : 'right'};">${fullName.trim()}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'אימייל' : 'Email'}:</td>
                            <td style="padding: 8px 0; color: #333; text-align: ${language === 'he' ? 'left' : 'right'};"><span dir="ltr">${email.trim().toLowerCase()}</span></td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'נושא' : 'Subject'}:</td>
                            <td style="padding: 8px 0; color: #333; text-align: ${language === 'he' ? 'left' : 'right'};">${subject.trim()}</td>
                          </tr>
                          <tr>
                            <td style="padding: 8px 0; color: #666; font-weight: bold; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'זמן' : 'Time'}:</td>
                            <td style="padding: 8px 0; color: #333; text-align: ${language === 'he' ? 'left' : 'right'};">${formattedTimestamp}</td>
                          </tr>
                        </table>
                      </div>
                      <div>
                        <h2 style="color: #333; font-size: 18px; margin-bottom: 10px; text-align: ${language === 'he' ? 'right' : 'left'};">${language === 'he' ? 'הודעה' : 'Message'}:</h2>
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; white-space: pre-wrap; text-align: ${language === 'he' ? 'right' : 'left'};">${message.trim()}</div>
                      </div>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e6ebf1;">
                      <p style="color: #666; font-size: 12px; margin: 0;">${language === 'he' ? 'הודעה זו נשלחה דרך טופס יצירת הקשר באתר Sako Or' : 'This message was sent via the Sako Or website contact form'}</p>
                      <p style="color: #e53e3e; font-size: 11px; margin: 5px 0 0 0;">⚠️ Database was unavailable - message not saved to database</p>
                    </div>
                  </div>
                </body>
              </html>
            `,
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