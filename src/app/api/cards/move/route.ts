import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";

// Initialize InstantDB Admin SDK
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "f0827431-76de-4f51-a2c3-bae2e1558bcc";
const ADMIN_KEY = process.env.INSTANT_ADMIN_KEY;

if (!ADMIN_KEY) {
  console.error("INSTANT_ADMIN_KEY is not set");
}

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_KEY,
});

/**
 * POST /api/cards/move
 *
 * Move a card to a different stage (for n8n automation)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardId, stageId, secret } = body;

    console.log("=== Move Card Request ===");
    console.log("Card ID:", cardId);
    console.log("New Stage ID:", stageId);
    console.log("========================");

    // Optional: Verify secret
    const expectedSecret = process.env.N8N_SHARED_SECRET;
    if (expectedSecret && secret && secret !== expectedSecret) {
      console.warn("Secret mismatch");
      return NextResponse.json(
        { error: "Invalid secret" },
        { status: 401 }
      );
    }

    if (!ADMIN_KEY) {
      return NextResponse.json(
        { error: "Server configuration error: INSTANT_ADMIN_KEY not set" },
        { status: 500 }
      );
    }

    // Validate required fields
    if (!cardId || !stageId) {
      return NextResponse.json(
        {
          error: "Missing required fields: cardId and stageId",
          received: { cardId, stageId },
        },
        { status: 400 }
      );
    }

    // Update card's stage link
    await db.transact([
      db.tx.cards[cardId].update({
        updatedAt: Date.now(),
      }).link({ stage: stageId }),
    ]);

    console.log("✅ Card moved successfully");

    // Send event to n8n (optional)
    const n8nEventsUrl = process.env.N8N_EVENTS_URL;
    if (n8nEventsUrl) {
      try {
        await fetch(n8nEventsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "card.moved",
            cardId,
            stageId,
            timestamp: Date.now(),
          }),
        });
        console.log("📤 Sent card.moved event to n8n");
      } catch (err) {
        console.error("Failed to send event to n8n:", err);
      }
    }

    return NextResponse.json({
      success: true,
      cardId,
      stageId,
      message: "Card moved successfully",
    });
  } catch (error: any) {
    console.error("❌ Error moving card:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for documentation
export async function GET() {
  return NextResponse.json({
    message: "Move Card API Endpoint",
    method: "POST",
    usage: {
      url: "/api/cards/move",
      body: {
        cardId: "The card ID to move",
        stageId: "The target stage ID",
        secret: "Optional: N8N_SHARED_SECRET for authentication",
      },
      example: {
        cardId: "abc123-...",
        stageId: "xyz789-...",
      },
    },
    instructions: [
      "1. Get the cardId from the card creation response",
      "2. Get the stageId from /pipes (copy from URL when viewing a stage)",
      "3. POST to this endpoint with the body shown above",
      "4. Use this in n8n workflows to auto-route cards",
    ],
  });
}
