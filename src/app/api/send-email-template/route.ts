import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { processEmailTemplate } from "@/lib/email-templates";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return emailRegex.test(value);
}

function getBaseUrl(request: NextRequest): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, "");
  }

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")
    .map((value) => value.trim())
    .find(Boolean);
  const protocol = forwardedProto || "https";
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const host = request.headers.get("host")?.trim();

  if (forwardedHost) {
    return `${protocol}://${forwardedHost}`;
  }

  if (host) {
    return `${protocol}://${host}`;
  }

  return request.nextUrl.origin.replace(/\/$/, "");
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalRecipients(
  value: unknown
): string | string[] | undefined {
  if (Array.isArray(value)) {
    const recipients = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return recipients.length > 0 ? recipients : undefined;
  }

  return normalizeOptionalString(value);
}

export async function POST(request: NextRequest) {
  try {
    const { recipientEmail, templateId, cardId } = await request.json();

    if (!recipientEmail || !templateId) {
      return NextResponse.json(
        { error: "Missing required fields: recipientEmail, templateId" },
        { status: 400 }
      );
    }

    if (typeof recipientEmail !== "string" || typeof templateId !== "string") {
      return NextResponse.json(
        { error: "recipientEmail and templateId must be strings" },
        { status: 400 }
      );
    }

    if (cardId !== undefined && cardId !== null && typeof cardId !== "string") {
      return NextResponse.json(
        { error: "cardId must be a string when provided" },
        { status: 400 }
      );
    }

    const normalizedRecipientEmail = recipientEmail.trim();
    const normalizedTemplateId = templateId.trim();
    const normalizedCardId = normalizeOptionalString(cardId);

    if (!normalizedRecipientEmail || !normalizedTemplateId) {
      return NextResponse.json(
        { error: "recipientEmail and templateId cannot be empty" },
        { status: 400 }
      );
    }

    if (!isValidEmail(normalizedRecipientEmail)) {
      return NextResponse.json(
        { error: "Invalid recipientEmail format" },
        { status: 400 }
      );
    }

    console.log("[send-email-template] request received", {
      recipientEmail: normalizedRecipientEmail,
      templateId: normalizedTemplateId,
      hasCardId: !!normalizedCardId,
    });

    const templateResult = await adminDb.query({
      email_templates: {
        $: {
          where: { id: normalizedTemplateId },
        },
      },
    });

    const template = templateResult?.email_templates?.[0];
    if (!template) {
      return NextResponse.json(
        { error: "Email template not found" },
        { status: 404 }
      );
    }

    let cardData: any = undefined;
    if (normalizedCardId) {
      const cardResult = await adminDb.query({
        cards: {
          $: { where: { id: normalizedCardId } },
          fields: {},
          stage: {
            pipe: {},
          },
        },
      });

      cardData = cardResult?.cards?.[0];
      if (!cardData) {
        return NextResponse.json(
          { error: "Card not found" },
          { status: 404 }
        );
      }
    }

    const emailTemplateData: any = {};
    if (cardData) {
      emailTemplateData.card = {
        title: cardData.title,
        description: cardData.description,
        fields: cardData.fields,
      };
      emailTemplateData.stage = {
        name: cardData.stage?.name,
      };
      emailTemplateData.pipe = {
        name: cardData.stage?.pipe?.name,
      };
    }

    const subject = processEmailTemplate(
      typeof template.subject === "string" ? template.subject : "",
      emailTemplateData
    );
    const body = processEmailTemplate(
      typeof template.body === "string" ? template.body : "",
      emailTemplateData
    );

    const sendEmailPayload = {
      to: normalizedRecipientEmail,
      subject,
      body,
      cardId: normalizedCardId,
      cardData,
      from: normalizeOptionalString(template.fromEmail),
      fromName: normalizeOptionalString(template.fromName),
      cc: normalizeOptionalRecipients(template.cc),
      bcc: normalizeOptionalRecipients(template.bcc),
      sentVia: "send-email-template",
    };

    const sendEmailUrl = `${getBaseUrl(request)}/api/send-email`;
    console.log("[send-email-template] delegating to /api/send-email", {
      sendEmailUrl,
      recipientEmail: normalizedRecipientEmail,
      templateId: normalizedTemplateId,
      hasCardData: !!cardData,
    });

    const sendEmailResponse = await fetch(sendEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendEmailPayload),
    });

    let sendEmailResult: any = null;
    try {
      sendEmailResult = await sendEmailResponse.json();
    } catch {
      sendEmailResult = null;
    }

    if (!sendEmailResponse.ok) {
      const upstreamError =
        typeof sendEmailResult?.error === "string"
          ? sendEmailResult.error
          : "Failed to send email";
      const upstreamMessage =
        typeof sendEmailResult?.message === "string"
          ? sendEmailResult.message
          : undefined;

      console.error("[send-email-template] /api/send-email failed", {
        status: sendEmailResponse.status,
        error: upstreamError,
        message: upstreamMessage,
      });

      return NextResponse.json(
        {
          error: "Failed to send email template",
          details: upstreamMessage || upstreamError,
        },
        { status: sendEmailResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      recipientEmail: normalizedRecipientEmail,
      templateId: normalizedTemplateId,
      ...(sendEmailResult?.emailId ? { emailId: sendEmailResult.emailId } : {}),
      ...(sendEmailResult?.resendId ? { resendId: sendEmailResult.resendId } : {}),
    });
  } catch (error) {
    console.error("[send-email-template] unexpected error", error);
    return NextResponse.json(
      {
        error: "Failed to send email template",
        details:
          error instanceof Error ? error.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Send Email Template API Endpoint",
    method: "POST",
    delivery: "Delegates outbound delivery to /api/send-email (Resend-backed)",
    usage: {
      url: "/api/send-email-template",
      body: {
        recipientEmail: "recipient@example.com",
        templateId: "email-template-id",
        cardId: "optional-card-id",
      },
    },
  });
}
