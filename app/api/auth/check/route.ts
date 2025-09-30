import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Simple authentication check
  const authHeader = request.headers.get('authorization');
  const apiKey = request.headers.get('x-api-key');
  
  // Check for valid API key or auth token
  const validApiKey = process.env.ADMIN_API_KEY || 'your-secure-admin-key';
  
  if (apiKey === validApiKey || authHeader?.includes('Bearer')) {
    return NextResponse.json({ authenticated: true });
  }
  
  return NextResponse.json({ authenticated: false }, { status: 401 });
}
