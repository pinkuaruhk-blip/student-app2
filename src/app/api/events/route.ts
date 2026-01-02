import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/events
 *
 * Receives events from the client (e.g., card.moved, card.field_changed)
 * and forwards them to n8n for further processing
 *
 * Expected payload:
 * {
 *   event: string,  // e.g., "card.moved", "card.created", "card.field_changed"
 *   cardId: string,
 *   pipeId?: string,
 *   stageId?: string,
 *   newStageId?: string,
 *   ... other event-specific data
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, ...data } = body;

    // Validate event
    if (!event) {
      return NextResponse.json(
        { error: "Missing 'event' field" },
        { status: 400 }
      );
    }

    // Get n8n webhook URL from environment
    const n8nEventsUrl = process.env.N8N_EVENTS_URL;

    if (!n8nEventsUrl) {
      // If n8n URL is not configured, just log and return success
      console.log("Event received (n8n not configured):", event, data);
      return NextResponse.json({ success: true, message: "Event logged (n8n not configured)" });
    }

    // Forward event to n8n
    const response = await fetch(n8nEventsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        ...data,
      }),
    });

    if (!response.ok) {
      console.error("Failed to forward event to n8n:", response.statusText);
      return NextResponse.json(
        { error: "Failed to forward event to n8n" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Event forwarded to n8n",
    });
  } catch (error: any) {
    console.error("Error in /api/events:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
