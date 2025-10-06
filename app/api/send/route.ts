import { sendOrderConfirmationEmailIdempotent, OrderEmailData } from '../../../lib/email';

export async function POST(request: Request) {
  try {
    const body: OrderEmailData = await request.json();
    
    const result = await sendOrderConfirmationEmailIdempotent(body);
    
    if (!result.success) {
      return Response.json({ error: 'error' in result ? result.error : 'Unknown error' }, { status: 500 });
    }

    return Response.json({ success: true, messageId: result.messageId });
  } catch (error) {
    console.error('API error:', error);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
}