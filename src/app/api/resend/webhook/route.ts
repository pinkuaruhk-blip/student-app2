import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { adminDb } from "@/lib/db-admin";

const resend = new Resend(process.env.RESEND_API_KEY || "re_webhook_verify_placeholder");

const SUPPORTED_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.failed",
  "email.suppressed",
  "email.complained",
] as const;

type SupportedEventType = (typeof SUPPORTED_EVENTS)[number];
type DeliveryStatus =
  | "sent"
  | "delivered"
  | "delayed"
  | "failed"
  | "bounced"
  | "suppressed"
  | "complained";

type ResendWebhookEvent = {
  type: string;
  created_at?: string | number | null;
  data?: {
    email_id?: string | null;
    reason?: string | null;
    message?: string | null;
    error?:
      | string
      | {
          message?: string | null;
        }
      | null;
    suppression?: {
      reason?: string | null;
      type?: string | null;
      message?: string | null;
      description?: string | null;
    } | null;
    bounce?: {
      type?: string | null;
      subType?: string | null;
      message?: string | null;
    } | null;
  } | null;
};

type CardEmailRecord = {
  id: string;
  resendId?: string;
  status?: string;
  statusUpdatedAt?: number;
  bounceType?: string;
  bounceMessage?: string;
};

const EVENT_STATUS_MAP: Record<SupportedEventType, DeliveryStatus> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
  "email.complained": "complained",
};

const STATUS_PRECEDENCE: Record<DeliveryStatus, number> = {
  sent: 1,
  delayed: 2,
  delivered: 3,
  failed: 4,
  bounced: 5,
  suppressed: 6,
  complained: 7,
};

function isSupportedEventType(value: string): value is SupportedEventType {
  return SUPPORTED_EVENTS.includes(value as SupportedEventType);
}

function parseEventTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === "string") {
    const parsedAsNumber = Number(value);
    if (Number.isFinite(parsedAsNumber) && value.trim() !== "") {
      return parsedAsNumber < 1_000_000_000_000 ? parsedAsNumber * 1000 : parsedAsNumber;
    }

    const parsedAsDate = Date.parse(value);
    if (Number.isFinite(parsedAsDate)) {
      return parsedAsDate;
    }
  }

  return null;
}

function shouldUpdateStatus(currentStatus: string | undefined, nextStatus: DeliveryStatus): boolean {
  const currentPrecedence = currentStatus && currentStatus in STATUS_PRECEDENCE
    ? STATUS_PRECEDENCE[currentStatus as DeliveryStatus]
    : 0;
  const nextPrecedence = STATUS_PRECEDENCE[nextStatus];
  return nextPrecedence >= currentPrecedence;
}

function normalizeMetadataText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  // Keep metadata short and safe for UI/logging surfaces.
  return trimmed.slice(0, 500);
}

function getSuppressionMetadata(eventData: ResendWebhookEvent["data"]): {
  suppressionType?: string;
  suppressionMessage: string;
} {
  const suppressionType = normalizeMetadataText(
    eventData?.suppression?.reason
      ?? eventData?.suppression?.type
      ?? eventData?.reason
      ?? eventData?.bounce?.type
      ?? eventData?.bounce?.subType
  );

  const suppressionMessage = normalizeMetadataText(
    eventData?.suppression?.message
      ?? eventData?.suppression?.description
      ?? eventData?.message
      ?? (typeof eventData?.error === "string" ? eventData.error : eventData?.error?.message)
      ?? eventData?.bounce?.message
  ) ?? "Email suppressed by Resend.";

  return {
    suppressionType,
    suppressionMessage,
  };
}

/**
 * POST /api/resend/webhook
 *
 * Receives Resend webhook events and updates outbound email delivery status.
 */
export async function POST(request: NextRequest) {
  const payload = await request.text();

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[Resend webhook] RESEND_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook endpoint is not configured" },
      { status: 503 }
    );
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[Resend webhook] Missing signature headers");
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  let event: ResendWebhookEvent;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature,
      },
      webhookSecret,
    }) as ResendWebhookEvent;
  } catch (error) {
    console.error("[Resend webhook] Signature verification failed:", error);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  const eventType = event.type;
  const resendEmailId = event.data?.email_id?.trim();

  console.log("[Resend webhook] Event received", {
    eventType,
    resendEmailId: resendEmailId || "(missing)",
  });

  if (!resendEmailId) {
    console.warn("[Resend webhook] Event missing data.email_id", { eventType });
    return NextResponse.json({
      received: true,
      eventType,
      updated: false,
    });
  }

  if (!isSupportedEventType(eventType)) {
    console.log("[Resend webhook] Ignoring unsupported event type", {
      eventType,
      resendEmailId,
    });
    return NextResponse.json({
      received: true,
      eventType,
      updated: false,
    });
  }

  const statusFromEvent = EVENT_STATUS_MAP[eventType];
  const statusUpdatedAt = parseEventTimestamp(event.created_at) ?? Date.now();
  const isSuppressedEvent = statusFromEvent === "suppressed";
  const suppressionMetadata = isSuppressedEvent ? getSuppressionMetadata(event.data) : null;
  const bounceType = isSuppressedEvent
    ? suppressionMetadata?.suppressionType
    : normalizeMetadataText(event.data?.bounce?.type) || normalizeMetadataText(event.data?.bounce?.subType);
  const bounceMessage = isSuppressedEvent
    ? suppressionMetadata?.suppressionMessage
    : normalizeMetadataText(event.data?.bounce?.message);

  try {
    const result = await adminDb.query({
      card_emails: {
        $: {
          where: {
            resendId: resendEmailId,
          },
        },
      },
    });

    const matchingEmails = (result.card_emails || []) as CardEmailRecord[];
    const matchingEmail = matchingEmails[0];

    if (!matchingEmail) {
      console.warn("[Resend webhook] No matching card_emails row for resendId", { resendEmailId, eventType });
      return NextResponse.json({
        received: true,
        eventType,
        updated: false,
      });
    }

    if (matchingEmails.length > 1) {
      console.warn("[Resend webhook] Multiple card_emails rows found for resendId, using first match", {
        resendEmailId,
        matches: matchingEmails.length,
      });
    }

    const currentStatus = matchingEmail.status;
    const canApplyTransition = shouldUpdateStatus(currentStatus, statusFromEvent);
    const hasNewBounceType = Boolean(bounceType && bounceType !== matchingEmail.bounceType);
    const hasNewBounceMessage = Boolean(bounceMessage && bounceMessage !== matchingEmail.bounceMessage);
    const hasMetadataUpdate = hasNewBounceType || hasNewBounceMessage;

    console.log("[Resend webhook] Status transition check", {
      resendEmailId,
      cardEmailId: matchingEmail.id,
      eventType,
      fromStatus: currentStatus || "(none)",
      toStatus: statusFromEvent,
      allowed: canApplyTransition,
    });

    if (!canApplyTransition) {
      return NextResponse.json({
        received: true,
        eventType,
        updated: false,
      });
    }

    if (currentStatus === statusFromEvent && !hasMetadataUpdate) {
      console.log("[Resend webhook] Duplicate status event ignored", {
        resendEmailId,
        cardEmailId: matchingEmail.id,
        eventType,
        status: statusFromEvent,
      });

      return NextResponse.json({
        received: true,
        eventType,
        updated: false,
      });
    }

    const updatePayload: {
      status: DeliveryStatus;
      statusUpdatedAt: number;
      provider: "resend";
      bounceType?: string;
      bounceMessage?: string;
    } = {
      status: statusFromEvent,
      statusUpdatedAt,
      provider: "resend",
    };

    if (bounceType) {
      updatePayload.bounceType = bounceType;
    }

    if (bounceMessage) {
      updatePayload.bounceMessage = bounceMessage;
    }

    await adminDb.transact([
      adminDb.tx.card_emails[matchingEmail.id].update(updatePayload),
    ]);

    console.log("[Resend webhook] Updated card_emails delivery status", {
      resendEmailId,
      cardEmailId: matchingEmail.id,
      eventType,
      fromStatus: currentStatus || "(none)",
      toStatus: statusFromEvent,
    });

    return NextResponse.json({
      received: true,
      eventType,
      updated: true,
    });
  } catch (error) {
    console.error("[Resend webhook] Error processing event:", {
      eventType,
      resendEmailId,
      error,
    });

    return NextResponse.json(
      { error: "Failed to process webhook event" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    supportedEvents: SUPPORTED_EVENTS,
  });
}
