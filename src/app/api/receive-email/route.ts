import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";

/**
 * POST /api/receive-email
 *
 * Receives incoming emails from n8n and logs them to the appropriate card
 * This endpoint is called by n8n when a reply email is received
 */
export async function POST(request: NextRequest) {
  try {
    const { from, to, cc, subject, body, cardId, emailId, inReplyTo } = await request.json();

    console.log("=== Receive Email Request ===");
    console.log("From:", from);
    console.log("To:", to);
    console.log("CC:", cc);
    console.log("Subject:", subject);
    console.log("Card ID:", cardId);
    console.log("In Reply To:", inReplyTo);
    console.log("============================");

    // Validate required fields
    if (!from || !subject || !body) {
      return NextResponse.json(
        {
          error: "Missing required fields: from, subject, body",
          received: { from, subject: !!subject, body: !!body },
        },
        { status: 400 }
      );
    }

    // Priority 1: Try to extract card ID from subject line
    // Format: "Re: Subject [#cardId]" or "Subject [#cardId]"
    // UUID format: 8-4-4-4-12 characters (e.g., 550e8400-e29b-41d4-a716-446655440000)
    let targetCardId = cardId;

    if (!targetCardId && subject) {
      const cardIdMatch = subject.match(/\[#([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\]/i);
      if (cardIdMatch) {
        targetCardId = cardIdMatch[1];
        console.log("✅ Found card ID from subject:", targetCardId);
      }
    }

    // Priority 2: If cardId is not provided and not in subject, try to find it from inReplyTo
    // NOTE: Disabled for now - requires admin SDK which isn't set up
    // if (!targetCardId && inReplyTo) {
    //   try {
    //     const result = await db.query(...);
    //     if (result?.card_emails?.[0]?.card) {
    //       targetCardId = result.card_emails[0].card.id;
    //     }
    //   } catch (error) {
    //     console.log("⚠️ Error querying by inReplyTo:", error);
    //   }
    // }

    // Priority 3: If still no card found, try to match by email address in card fields
    // NOTE: Disabled for now - requires admin SDK which isn't set up
    // if (!targetCardId && from) {
    //   try {
    //     const result = await db.query(...);
    //     if (result?.card_fields?.[0]?.card) {
    //       targetCardId = result.card_fields[0].card.id;
    //     }
    //   } catch (error) {
    //     console.log("⚠️ Error querying by email field:", error);
    //   }
    // }

    if (!targetCardId) {
      return NextResponse.json(
        {
          error: "Could not find matching card",
          message: "Please ensure one of: subject contains [#cardId], inReplyTo matches original email, or sender email matches card's 電郵 field",
          from,
          subject,
        },
        { status: 404 }
      );
    }

    // Log received email to database
    const cardEmailId = id();
    const receivedEmailId = emailId || `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await adminDb.transact([
      adminDb.tx.card_emails[cardEmailId].update({
        direction: "received",
        from,
        to: to || "system",
        cc: cc || undefined,
        subject,
        body,
        sentAt: Date.now(),
        emailId: receivedEmailId,
        inReplyTo: inReplyTo || null,
        read: false, // Received emails start as unread
      }).link({ card: targetCardId }),
    ]);

    console.log("✅ Received email logged to database");

    return NextResponse.json({
      success: true,
      message: "Email received and logged",
      cardId: targetCardId,
      emailId: receivedEmailId,
    });
  } catch (error: any) {
    console.error("❌ Error receiving email:", error);
    return NextResponse.json(
      {
        error: "Failed to receive email",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for documentation
export async function GET() {
  return NextResponse.json({
    message: "Receive Email API Endpoint",
    method: "POST",
    usage: {
      url: "/api/receive-email",
      body: {
        from: "client@example.com (sender email address)",
        to: "your@email.com (optional)",
        subject: "Email subject",
        body: "Email body content",
        cardId: "Card ID (optional if inReplyTo is provided)",
        emailId: "Unique email ID (optional)",
        inReplyTo: "Original email ID for threading (optional)",
      },
    },
    howItWorks: [
      "1. n8n receives an email via Email Trigger or IMAP node",
      "2. n8n extracts: from, to, subject, body",
      "3. n8n sends data to this endpoint",
      "4. System finds matching card by (in priority order):",
      "   a) [#cardId] in subject line (BEST - works without Message-ID!)",
      "   b) cardId (if provided explicitly)",
      "   c) inReplyTo (finds original sent email's card)",
      "   d) from email (matches against 電郵 field)",
      "5. Email is logged to card's mailbox",
    ],
    instructions: [
      "1. Set up n8n Email Trigger or IMAP node",
      "2. Add HTTP Request node to POST to this endpoint",
      "3. Map email fields: from, to, subject, body",
      "4. Include Message-ID as emailId for threading",
      "5. Include In-Reply-To header as inReplyTo",
    ],
    example: {
      n8nWorkflow: "Email Trigger → HTTP Request (POST to /api/receive-email)",
      bodyMapping: {
        from: "{{ $json.from }}",
        to: "{{ $json.to }}",
        subject: "{{ $json.subject }}",
        body: "{{ $json.text || $json.html }}",
        emailId: "{{ $json.messageId }}",
        inReplyTo: "{{ $json.inReplyTo }}",
      },
    },
  });
}
