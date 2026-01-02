import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { recipientEmail, templateId, cardId } = await request.json();

    if (!recipientEmail || !templateId) {
      return NextResponse.json(
        { error: "Missing recipientEmail or templateId" },
        { status: 400 }
      );
    }

    // TODO: Implement actual email template system
    // For now, just log the email that would be sent
    console.log("📧 Sending email template:");
    console.log(`  To: ${recipientEmail}`);
    console.log(`  Template ID: ${templateId}`);
    console.log(`  Card ID: ${cardId}`);

    // In a real implementation, you would:
    // 1. Load the email template from a database or template store
    // 2. Replace placeholders with actual card data
    // 3. Use an email service to send the email

    // For now, send via n8n webhook if configured
    const n8nWebhookUrl = process.env.N8N_SEND_EMAIL_WEBHOOK_URL;

    if (n8nWebhookUrl) {
      const emailPayload = {
        to: recipientEmail,
        subject: `Template ${templateId}`,
        body: `This email was sent using template: ${templateId}`,
        cardId,
        templateId,
      };

      console.log("Sending email via n8n:", emailPayload);

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

      console.log("✅ Email sent successfully via n8n");

      return NextResponse.json({
        success: true,
        message: "Email sent successfully",
        recipientEmail,
        templateId,
      });
    }

    // If no n8n webhook, just simulate success
    console.log("⚠️ No email service configured, simulating success");

    return NextResponse.json({
      success: true,
      message: "Email sent successfully (simulation)",
      recipientEmail,
      templateId,
    });
  } catch (error: any) {
    console.error("❌ Error sending email template:", error);
    return NextResponse.json(
      {
        error: "Failed to send email template",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
