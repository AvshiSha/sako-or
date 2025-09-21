import { NextResponse } from 'next/server';
import { CardComAPI } from '../../../lib/cardcom';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  try {
    // Test 1: Environment Variables
    const envCheck = {
      DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
      CARDCOM_TERMINAL_NUMBER: process.env.CARDCOM_TERMINAL_NUMBER ? 'Set' : 'Not set',
      CARDCOM_API_NAME: process.env.CARDCOM_API_NAME ? 'Set' : 'Not set',
      CARDCOM_API_PASSWORD: process.env.CARDCOM_API_PASSWORD ? 'Set' : 'Not set',
      NODE_ENV: process.env.NODE_ENV,
    };

    // Test 2: Database Connection
    let dbCheck: { status: string; error: string | null; userCount?: number } = { status: 'Unknown', error: null };
    try {
      await prisma.$connect();
      const userCount = await prisma.user.count();
      dbCheck = { status: 'Connected', error: null, userCount };
    } catch (error) {
      dbCheck = { status: 'Failed', error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // Test 3: CardCom API Initialization
    let cardcomCheck = { status: 'Unknown', error: null };
    try {
      const cardcomAPI = new CardComAPI();
      cardcomCheck = { status: 'Initialized', error: null };
    } catch (error) {
      cardcomCheck = { status: 'Failed', error: error instanceof Error ? error.message : 'Unknown error' };
    }

    // Test 4: Order Creation Test
    let orderTest = { status: 'Unknown', error: null, orderId: null };
    try {
      const testOrder = await prisma.order.create({
        data: {
          orderNumber: `TEST-${Date.now()}`,
          total: 10.00,
          currency: 'ILS',
          customerName: 'Test User',
          customerEmail: 'test@example.com',
          status: 'pending',
          paymentStatus: 'pending',
        },
      });
      orderTest = { status: 'Success', error: null, orderId: testOrder.id };
      
      // Clean up test order
      await prisma.order.delete({ where: { id: testOrder.id } });
    } catch (error) {
      orderTest = { status: 'Failed', error: error instanceof Error ? error.message : 'Unknown error', orderId: null };
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envCheck,
      database: dbCheck,
      cardcom: cardcomCheck,
      orderCreation: orderTest,
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Debug endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
