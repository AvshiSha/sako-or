import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  try {
    console.log('[TEST-RESEND] Starting test email send...');
    console.log('[TEST-RESEND] API Key:', process.env.RESEND_API_KEY?.substring(0, 10) + '...');
    
    // Test with simple HTML email (no React component)
    const result = await resend.emails.send({
      from: 'Sako Or <info@sako-or.com>',
      to: ['avshi@sako-or.com'],
      subject: 'Test Email from Resend',
      html: '<h1>Test Email</h1><p>This is a simple test email to verify Resend is working.</p><p>If you receive this, your Resend setup is correct!</p>',
    });
    
    console.log('[TEST-RESEND] Success!', result);
    
    return res.status(200).json({ 
      success: true, 
      result,
      message: 'Email sent successfully! Check avshi@sako-or.com'
    });
  } catch (error) {
    console.error('[TEST-RESEND] Error:', error);
    
    return res.status(500).json({ 
      success: false,
      error: error.message,
      details: error,
      stack: error.stack
    });
  }
}

