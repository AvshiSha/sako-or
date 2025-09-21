import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    environment: process.env.NODE_ENV,
    cardcomTerminal: process.env.CARDCOM_TERMINAL_NUMBER ? 'Set' : 'Not set',
    cardcomApiName: process.env.CARDCOM_API_NAME ? 'Set' : 'Not set',
    cardcomPassword: process.env.CARDCOM_API_PASSWORD ? 'Set' : 'Not set',
    cardcomWebhook: process.env.CARDCOM_WEBHOOK_SECRET ? 'Set' : 'Not set',
  });
}
