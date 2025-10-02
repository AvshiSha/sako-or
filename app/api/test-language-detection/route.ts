import { NextRequest, NextResponse } from 'next/server';
import { sendOrderConfirmationEmail } from '../../../lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { language, customerEmail = 'test@example.com' } = body;
    
    console.log('=== TESTING LANGUAGE DETECTION ===');
    console.log('Input language:', language);
    
    // Simulate the language detection logic from webhook
    const if_he = language === 'he' || true; // Same logic as webhook
    console.log('Detected if_he:', if_he);
    
    // Test email sending with detected language
    const emailResult = await sendOrderConfirmationEmail({
      customerEmail: customerEmail,
      customerName: 'Test User',
      orderNumber: 'TEST-' + Date.now(),
      orderDate: new Date().toLocaleDateString(),
      items: [
        {
          name: if_he ? 'נעליים לבדיקה' : 'Test Shoes',
          quantity: 1,
          price: 100.00,
        }
      ],
      total: 100.00,
      isHebrew: if_he,
    });
    
    console.log('Email result:', emailResult);
    console.log('=== END TESTING ===');
    
    return NextResponse.json({
      success: true,
      inputLanguage: language,
      detectedHebrew: if_he,
      emailSent: emailResult.success,
      emailResult: emailResult,
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json(
      { 
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

