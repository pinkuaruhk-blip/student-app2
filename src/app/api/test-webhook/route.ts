import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "f0827431-76de-4f51-a2c3-bae2e1558bcc";
const ADMIN_KEY = process.env.INSTANT_ADMIN_KEY;

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_KEY,
});

/**
 * Test endpoint to check what cards exist
 * Visit: http://localhost:3000/api/test-webhook
 */
export async function GET(request: NextRequest) {
  try {
    // Query all cards to see what's in the database
    const result = await db.query({
      cards: {
        pipe: {},
        stage: {},
        fields: {},
      },
    });

    return NextResponse.json({
      message: "Database query successful",
      totalCards: result.cards?.length || 0,
      cards: result.cards || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: "Failed to query database",
      details: error.message,
    }, { status: 500 });
  }
}
