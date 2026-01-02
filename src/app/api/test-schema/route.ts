import { NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";

/**
 * Test endpoint to verify admin SDK and schema
 */
export async function GET() {
  try {
    // Try to create a test card_email to see if schema is properly configured
    const testCardId = id();
    const testEmailId = id();

    console.log("Testing admin SDK with test IDs:");
    console.log("Test Card ID:", testCardId);
    console.log("Test Email ID:", testEmailId);

    // First, create a test card
    await adminDb.transact([
      adminDb.tx.cards[testCardId].update({
        title: "Test Card for Email",
        description: "This is a test card",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    ]);

    console.log("✅ Test card created successfully");

    // Now try to create a test email
    await adminDb.transact([
      adminDb.tx.card_emails[testEmailId].update({
        direction: "sent",
        from: "test@example.com",
        to: "test@example.com",
        subject: "Test Subject",
        body: "Test Body",
        sentAt: Date.now(),
      }).link({ card: testCardId }),
    ]);

    console.log("✅ Test email created and linked successfully");

    return NextResponse.json({
      success: true,
      message: "Schema test passed! Admin SDK is working correctly.",
      testCardId,
      testEmailId,
    });
  } catch (error: any) {
    console.error("❌ Schema test failed:", error);
    return NextResponse.json(
      {
        error: "Schema test failed",
        details: error.message,
        hint: error.hint || "Check if schema is properly configured",
      },
      { status: 500 }
    );
  }
}
