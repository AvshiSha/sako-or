import { NextRequest, NextResponse } from 'next/server';
import { sendMetaEvent, hashUserData, getCurrentTimestamp, UserDataInput, CustomData } from '@/lib/meta-conversions';

/**
 * POST /api/meta-events
 * 
 * Frontend endpoint for sending Meta Conversions API events.
 * 
 * Body:
 * {
 *   event_name: string;
 *   event_id?: string; // For deduplication with pixel
 *   event_source_url: string;
 *   userData?: UserDataInput; // Non-hashed user data
 *   customData?: CustomData;
 *   event_time?: number; // Optional, defaults to now
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.event_name) {
      return NextResponse.json(
        { success: false, error: 'event_name is required' },
        { status: 400 }
      );
    }

    if (!body.event_source_url) {
      return NextResponse.json(
        { success: false, error: 'event_source_url is required' },
        { status: 400 }
      );
    }

    // Get client user agent from request headers
    const clientUserAgent = request.headers.get('user-agent') || undefined;

    // Hash user data if provided
    const hashedUserData = body.userData
      ? hashUserData(body.userData as UserDataInput, clientUserAgent)
      : hashUserData({}, clientUserAgent); // At minimum, include client_user_agent

    // Build event
    const event = {
      event_name: body.event_name,
      event_time: body.event_time || getCurrentTimestamp(),
      event_source_url: body.event_source_url,
      action_source: 'website' as const,
      event_id: body.event_id, // For deduplication with pixel
      user_data: hashedUserData,
      custom_data: body.customData as CustomData | undefined,
    };

    // Send to Meta Conversions API
    const result = await sendMetaEvent(event);

    if (!result.success) {
      console.error('[Meta Events API] Failed to send event:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to send event to Meta',
          details: result.response,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Event sent successfully',
      response: result.response,
    });
  } catch (error) {
    console.error('[Meta Events API] Error processing request:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process event request',
        details: error instanceof Error ? error.message : 'Unknown error',
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

