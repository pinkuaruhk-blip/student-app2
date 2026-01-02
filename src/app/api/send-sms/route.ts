import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";
import twilio from "twilio";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

/**
 * POST /api/send-sms
 *
 * Sends SMS via Twilio and logs it to the database
 */
export async function POST(request: NextRequest) {
  const debugLogs: string[] = [];
  const log = (message: string, ...args: any[]) => {
    console.log(message, ...args);
    debugLogs.push(message + (args.length ? " " + JSON.stringify(args) : ""));
  };

  try {
    const { to, body, cardId, sentVia } = await request.json();

    log("=== Send SMS Request ===");
    log("To:", to);
    log("Body:", body);
    log("Card ID:", cardId);
    log("=======================");

    // Validate required fields
    if (!to || !body) {
      return NextResponse.json(
        {
          error: "Missing required fields: to, body",
          received: { to, body: !!body },
        },
        { status: 400 }
      );
    }

    // Validate phone number format (basic check for international format)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(to.replace(/[\s\-\(\)]/g, ""))) {
      return NextResponse.json(
        { error: "Invalid phone number format. Use international format (e.g., +1234567890)", phone: to },
        { status: 400 }
      );
    }

    // Check Twilio configuration
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return NextResponse.json(
        {
          error: "SMS service not configured",
          message: "Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in .env.local",
        },
        { status: 503 }
      );
    }

    // Initialize Twilio client
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    log("Sending SMS via Twilio...");

    // Send SMS via Twilio
    const message = await client.messages.create({
      body,
      from: TWILIO_PHONE_NUMBER,
      to,
    });

    log("Twilio response:", message.sid, message.status);

    // Save SMS to database
    const smsId = id();
    const now = Date.now();

    await adminDb.transact([
      adminDb.tx["card_sms"][smsId]
        .update({
          direction: "sent",
          from: TWILIO_PHONE_NUMBER,
          to,
          body,
          sentAt: now,
          smsId: message.sid,
          status: message.status,
          read: true, // Sent messages are marked as read
          sentVia: sentVia || undefined,
        })
        .link({ card: cardId }),
    ]);

    log("SMS saved to database with ID:", smsId);

    return NextResponse.json({
      success: true,
      smsId,
      twilioSid: message.sid,
      status: message.status,
      message: "SMS sent successfully",
      debugLogs,
    });
  } catch (error: any) {
    console.error("Error sending SMS:", error);
    log("Error:", error.message);

    return NextResponse.json(
      {
        error: "Failed to send SMS",
        message: error.message || "Unknown error occurred",
        debugLogs,
      },
      { status: 500 }
    );
  }
}
