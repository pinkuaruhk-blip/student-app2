import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { cardId, formId, recipientEmail, formName, cardTitle } = await request.json();

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

    // Send email via n8n
    const n8nWebhookUrl = process.env.N8N_SEND_EMAIL_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      return NextResponse.json(
        { error: "N8N_SEND_EMAIL_WEBHOOK_URL not configured" },
        { status: 500 }
      );
    }

    const emailBody = `Hello,

We need some additional information from you regarding: ${cardTitle || "your request"}.

Please fill out the following form: ${formName || "Client Information Form"}

Click here to access the form: ${formLink}

Thank you for your cooperation!

Best regards,
Your Team`;

    const emailPayload = {
      to: recipientEmail,
      subject: `Action Required: ${formName || "Please Fill Out This Form"} - ${cardTitle || ""}`,
      body: emailBody,
      cardId,
    };

    console.log("Sending form link email via n8n:", emailPayload);

    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.statusText}`);
    }

    console.log("✅ Form link email sent successfully");

    return NextResponse.json({
      success: true,
      message: "Form link sent via email",
      formLink,
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
