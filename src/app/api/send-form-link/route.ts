import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return emailRegex.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatResendFrom(email: string, name?: string): string {
  if (!name) return email;
  const safeName = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${safeName}" <${email}>`;
}

function resolveEffectiveSender(
  from: string | undefined,
  fromName: string | undefined,
  defaultFromEmail: string,
  defaultFromName: string | undefined
): { effectiveFromEmail: string; effectiveFromName: string | undefined } {
  const normalizedFrom = from?.trim();
  const useDefault =
    !normalizedFrom ||
    normalizedFrom.toLowerCase() === "system" ||
    !isValidEmail(normalizedFrom);

  if (useDefault) {
    return {
      effectiveFromEmail: defaultFromEmail,
      effectiveFromName: fromName || defaultFromName,
    };
  }

  return {
    effectiveFromEmail: normalizedFrom,
    effectiveFromName: fromName || defaultFromName,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { cardId, formId, recipientEmail, formName, cardTitle, from, fromName } =
      await request.json();

    if (!cardId || !formId || !recipientEmail) {
      return NextResponse.json(
        { error: "Missing required fields: cardId, formId, recipientEmail" },
        { status: 400 }
      );
    }

    // Get base URL from request headers (for proxied/sandbox environments)
    const forwardedHost = request.headers.get('x-forwarded-host');
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';

    const baseUrl = forwardedHost
      ? `${protocol}://${forwardedHost}`
      : (host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"));

    // Generate the form link
    const formLink = `${baseUrl}/form/${cardId}/${formId}`;

    console.log("Base URL for form link:", baseUrl);

    if (!RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: "Email service not configured",
          message: "Please set RESEND_API_KEY to enable email sending",
        },
        { status: 503 }
      );
    }

    const defaultFromEmail = process.env.DEFAULT_FROM_EMAIL || "";
    const defaultFromName = process.env.DEFAULT_FROM_NAME || undefined;

    if (!defaultFromEmail || !isValidEmail(defaultFromEmail)) {
      return NextResponse.json(
        {
          error: "Email service not configured",
          message: "Please set DEFAULT_FROM_EMAIL to a valid sender address",
        },
        { status: 503 }
      );
    }

    const { effectiveFromEmail, effectiveFromName } = resolveEffectiveSender(
      from,
      fromName,
      defaultFromEmail,
      defaultFromName
    );

    const resendFrom = formatResendFrom(effectiveFromEmail, effectiveFromName);

    const emailBody = `Hello,

We need some additional information from you regarding: ${cardTitle || "your request"}.

Please fill out the following form: ${formName || "Client Information Form"}

Click here to access the form: ${formLink}

Thank you for your cooperation!

Best regards,
Your Team`;

    const emailSubject = `Action Required: ${formName || "Please Fill Out This Form"} - ${cardTitle || ""}`;

    const emailHtml = `<div>${escapeHtml(emailBody).replace(/\n/g, "<br />")}</div>`;

    const resend = new Resend(RESEND_API_KEY);
    console.log("Sending form link email via Resend:", {
      to: recipientEmail,
      subject: emailSubject,
      cardId,
    });

    const { data: resendData, error: resendError } = await resend.emails.send({
      from: resendFrom,
      to: recipientEmail,
      subject: emailSubject,
      html: emailHtml,
      text: emailBody,
    });

    if (resendError) {
      console.error("❌ Resend error:", resendError);
      return NextResponse.json(
        {
          error: "Failed to send form link",
          details: resendError.message,
        },
        { status: 500 }
      );
    }

    console.log("✅ Form link email sent successfully");

    return NextResponse.json({
      success: true,
      message: "Form link sent via email",
      formLink,
      resendId: resendData?.id,
    });
  } catch (error: any) {
    console.error("❌ Error sending form link:", error);
    return NextResponse.json(
      {
        error: "Failed to send form link",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
