import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

// Set the API key
const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) {
  throw new Error('SENDGRID_API_KEY environment variable is not set');
}
sgMail.setApiKey(apiKey);

export async function POST(request: NextRequest) {
  try {
    const { to, subject, text } = await request.json();
    
    const msg = {
      to: to || 'avshi@sako-or.com',
      from: 'info@sako-or.com',
      subject: subject || 'Test Email',
      text: text || 'This is a test email from Sako-Or.',
    };

    console.log('Sending simple email:', msg);
    
    const response = await sgMail.send(msg);
    console.log('Simple email sent successfully:', response[0].statusCode);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Simple email sent successfully',
      statusCode: response[0].statusCode
    });

  } catch (error) {
    console.error('Simple email error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    return NextResponse.json({ 
      error: 'Failed to send simple email',
      details: error instanceof Error ? error.message : 'Unknown error',
      fullError: error
    }, { status: 500 });
  }
}
