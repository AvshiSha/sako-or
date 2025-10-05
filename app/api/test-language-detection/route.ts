import { NextRequest, NextResponse } from 'next/server';
import { sendOrderConfirmationEmail } from '../../../lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { language, customerEmail = 'test@example.com' } = body;
    
    console.log('=== TESTING LANGUAGE DETECTION ===');
    console.log('Input language:', language);
    
    // Test both methods: URL parameter (new) and body parameter (for testing)
    const url = new URL(request.url);
    const langParam = url.searchParams.get('lang');
    console.log('Language from URL parameter:', langParam);
    
    // Use URL parameter if available, otherwise use body parameter for testing
    const effectiveLanguage = langParam || language;
    const if_he = effectiveLanguage === 'he' || !effectiveLanguage;
    console.log('Effective language:', effectiveLanguage);
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
      payer: {
        firstName: 'Test',
        lastName: 'User',
        email: customerEmail,
        mobile: '+972-50-123-4567',
        idNumber: '123456789'
      },
      deliveryAddress: {
        city: if_he ? 'תל אביב' : 'Tel Aviv',
        streetName: if_he ? 'רחוב הרצל' : 'Herzl Street',
        streetNumber: '1',
        floor: '2',
        apartmentNumber: '10',
        zipCode: '66881'
      },
      notes: if_he ? 'בדיקת מערכת' : 'System test',
      isHebrew: if_he,
    });
    
    console.log('Email result:', emailResult);
    console.log('=== END TESTING ===');
    
    return NextResponse.json({
      success: true,
      inputLanguage: language,
      urlLanguage: langParam,
      effectiveLanguage: effectiveLanguage,
      detectedHebrew: if_he,
      detectionMethod: 'URL parameter',
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

