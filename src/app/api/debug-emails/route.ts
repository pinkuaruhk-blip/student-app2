import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";

/**
 * Debug endpoint to check card emails
 */
export async function GET() {
  try {
    const cardId = "d66d028a-2687-492f-89d0-ee9815abf278";

    // Query using admin SDK
    const result = await adminDb.query({
      card_emails: {
        $: {
          where: {
            card: cardId,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      cardId,
      emails: result.card_emails,
      count: result.card_emails?.length || 0,
    });
  } catch (error: any) {
    console.error("❌ Debug query failed:", error);
    return NextResponse.json(
      {
        error: "Debug query failed",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
