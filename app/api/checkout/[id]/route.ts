import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

// GET method to retrieve a specific checkout record
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const checkout = await prisma.checkout.findUnique({
      where: { id },
    });

    if (!checkout) {
      return NextResponse.json(
        { error: 'Checkout record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: checkout,
    });

  } catch (error) {
    console.error('Error fetching checkout:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch checkout record',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT method to update a specific checkout record
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate that the checkout record exists
    const existingCheckout = await prisma.checkout.findUnique({
      where: { id },
    });

    if (!existingCheckout) {
      return NextResponse.json(
        { error: 'Checkout record not found' },
        { status: 404 }
      );
    }

    // Update the checkout record
    const updatedCheckout = await prisma.checkout.update({
      where: { id },
      data: {
        ...(body.customerEmail && { customerEmail: body.customerEmail }),
        ...(body.customerFirstName && { customerFirstName: body.customerFirstName }),
        ...(body.customerLastName && { customerLastName: body.customerLastName }),
        ...(body.customerPhone && { customerPhone: body.customerPhone }),
        ...(body.customerStreetName && { customerStreetName: body.customerStreetName }),
        ...(body.customerStreetNumber && { customerStreetNumber: body.customerStreetNumber }),
        ...(body.customerFloor !== undefined && { customerFloor: body.customerFloor }),
        ...(body.customerApartment !== undefined && { customerApartment: body.customerApartment }),
        ...(body.customerCity && { customerCity: body.customerCity }),
        ...(body.customerState && { customerState: body.customerState }),
        ...(body.customerZip !== undefined && { customerZip: body.customerZip }),
        ...(body.customerCountry && { customerCountry: body.customerCountry }),
        ...(body.customerID !== undefined && { customerID: body.customerID }),
        ...(body.customerDeliveryNotes !== undefined && { customerDeliveryNotes: body.customerDeliveryNotes }),
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedCheckout,
      message: 'Checkout record updated successfully',
    });

  } catch (error) {
    console.error('Error updating checkout:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to update checkout record',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE method to delete a specific checkout record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Validate that the checkout record exists
    const existingCheckout = await prisma.checkout.findUnique({
      where: { id },
    });

    if (!existingCheckout) {
      return NextResponse.json(
        { error: 'Checkout record not found' },
        { status: 404 }
      );
    }

    // Delete the checkout record
    await prisma.checkout.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Checkout record deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting checkout:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to delete checkout record',
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
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
