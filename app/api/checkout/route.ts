import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { CheckoutFormData } from '../../types/checkout';

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutFormData = await request.json();
    console.log('Checkout form submission received:', JSON.stringify(body, null, 2));
    
    // Validate required fields
    if (!body.payer?.firstName || !body.payer?.lastName || !body.payer?.email || !body.payer?.mobile) {
      return NextResponse.json(
        { error: 'Missing required payer information (firstName, lastName, email, mobile)' },
        { status: 400 }
      );
    }

    if (!body.deliveryAddress?.city || !body.deliveryAddress?.streetName || !body.deliveryAddress?.streetNumber) {
      return NextResponse.json(
        { error: 'Missing required delivery address information (city, streetName, streetNumber)' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.payer.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
    if (!phoneRegex.test(body.payer.mobile)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Create checkout record in database
    const checkout = await prisma.checkout.create({
      data: {
        customerEmail: body.payer.email,
        customerFirstName: body.payer.firstName,
        customerLastName: body.payer.lastName,
        customerPhone: body.payer.mobile,
        customerStreetName: body.deliveryAddress.streetName,
        customerStreetNumber: body.deliveryAddress.streetNumber,
        customerFloor: body.deliveryAddress.floor || null,
        customerApartment: body.deliveryAddress.apartmentNumber || null,
        customerCity: body.deliveryAddress.city,
        customerState: body.deliveryAddress.city, // Using city as state for now
        customerZip: body.deliveryAddress.zipCode || null,
        customerCountry: 'Israel', // Default to Israel, can be made configurable
        customerID: body.payer.idNumber || null,
        customerDeliveryNotes: body.notes || null,
      },
    });

    console.log('Checkout record created successfully:', checkout.id);

    return NextResponse.json({
      success: true,
      checkoutId: checkout.id,
      message: 'Checkout information saved successfully',
    });

  } catch (error) {
    console.error('Checkout submission error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to save checkout information',
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

// GET method to retrieve checkout records (for admin purposes)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const [checkouts, total] = await Promise.all([
      prisma.checkout.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.checkout.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: checkouts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching checkouts:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch checkout records',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
