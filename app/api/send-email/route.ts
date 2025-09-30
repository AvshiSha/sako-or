import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, sendOrderConfirmationEmail } from '@/lib/sendgrid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...emailData } = body;

    let result;

    if (type === 'order-confirmation') {
      result = await sendOrderConfirmationEmail(
        emailData.customerEmail,
        emailData.orderData
      );
    } else {
      result = await sendEmail(emailData);
    }

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Email sent successfully',
        messageId: result.messageId 
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
