import { sendOrderConfirmationEmail, OrderEmailData } from '../../../lib/email';

export async function POST(request: Request) {
  try {
    const body: OrderEmailData = await request.json();
    
    const result = await sendOrderConfirmationEmail(body);
    
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 500 });
    }

    return Response.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}