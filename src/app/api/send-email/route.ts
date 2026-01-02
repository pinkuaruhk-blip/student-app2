import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";
import { replacePlaceholders } from "@/lib/placeholders";

const N8N_EMAIL_URL = process.env.N8N_EMAIL_URL;

/**
 * POST /api/send-email
 *
 * Sends email data to n8n for actual email delivery
 * n8n handles the SMTP/email service integration
 * Also logs the email to the database for tracking
 */
export async function POST(request: NextRequest) {
  const debugLogs: string[] = [];
  const log = (message: string, ...args: any[]) => {
    console.log(message, ...args);
    debugLogs.push(message + (args.length ? " " + JSON.stringify(args) : ""));
  };

  try {
    const { to, from, fromName, subject, body, cardId, cardData, cc, bcc, sentVia } = await request.json();

    log("=== Send Email Request ===");
    log("To:", to);
    log("From:", from || "system");
    log("CC:", cc || "none");
    log("BCC:", bcc || "none");
    log("Subject:", subject);
    log("Card ID:", cardId);
    log("========================");

    // Validate required fields
    if (!to || !subject || !body) {
      return NextResponse.json(
        {
          error: "Missing required fields: to, subject, body",
          received: { to, subject: !!subject, body: !!body },
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: "Invalid email address format", email: to },
        { status: 400 }
      );
    }

    if (!N8N_EMAIL_URL) {
      return NextResponse.json(
        {
          error: "Email service not configured",
          message: "Please set N8N_EMAIL_URL in .env.local to enable email sending",
          hint: "Set up an n8n workflow with webhook trigger to handle email sending"
        },
        { status: 503 }
      );
    }

    // Get default email configuration from environment variables
    const defaultFromEmail = process.env.DEFAULT_FROM_EMAIL || "system";
    const defaultFromName = process.env.DEFAULT_FROM_NAME || undefined;

    log("Default from env:", defaultFromEmail);
    log("Default name from env:", defaultFromName || "(none)");

    // Apply sender fallback hierarchy: template > system defaults > hardcoded
    const effectiveFromEmail = from || defaultFromEmail;
    const effectiveFromName = fromName || defaultFromName;

    log("From:", effectiveFromEmail);
    log("From Name:", effectiveFromName || "(none)");

    // Format the "from" field for database storage
    // Store as "Name <email>" if name is available, otherwise just "email"
    const formattedFrom = effectiveFromName
      ? `${effectiveFromName} <${effectiveFromEmail}>`
      : effectiveFromEmail;

    // Get base URL from request for absolute URLs in email
    // Check for forwarded host headers first (for proxied/sandbox environments)
    const forwardedHost = request.headers.get('x-forwarded-host');
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';

    const baseUrl = forwardedHost
      ? `${protocol}://${forwardedHost}`
      : (host ? `${protocol}://${host}` : request.nextUrl.origin);

    log("Base URL for email links:", baseUrl);

    // Replace placeholders in subject and body with actual card data
    let processedSubject = subject;
    let processedBody = body;

    if (cardData) {
      // Fetch form submissions for this card to support form placeholders
      let formSubmissions = [];
      if (cardId) {
        try {
          const { init } = await import("@instantdb/admin");
          const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
          const ADMIN_TOKEN = process.env.INSTANT_ADMIN_KEY;

          const db = init({
            appId: APP_ID!,
            adminToken: ADMIN_TOKEN!,
          });

          // Query from card side to get form submissions via relationship
          const cardWithSubmissions = await db.query({
            cards: {
              $: { where: { id: cardId } },
              form_submissions: {
                form: {},
              },
            },
          });

          const card = cardWithSubmissions?.cards?.[0];
          const submissions = card?.form_submissions || [];

          log(`Raw submissions count: ${submissions.length}`);
          submissions.forEach((sub: any, idx: number) => {
            const formObj = Array.isArray(sub.form) ? sub.form[0] : sub.form;
            log(`  Raw sub ${idx}:`, {
              hasForm: !!sub.form,
              isArray: Array.isArray(sub.form),
              formId: formObj?.id,
              formName: formObj?.name,
            });
          });

          formSubmissions = submissions.map((sub: any) => {
            // Form is returned as an array, take first element
            const formObj = Array.isArray(sub.form) ? sub.form[0] : sub.form;
            return {
              form: {
                id: formObj?.id,
                name: formObj?.name,
              },
              responses: sub.responses || {},
            };
          });

          log(`Found ${formSubmissions.length} form submissions for card ${cardId}`);
          formSubmissions.forEach((sub, index) => {
            log(`  Submission ${index + 1}:`, {
              formId: sub.form?.id,
              formName: sub.form?.name,
              formObject: sub.form,
              responseKeys: Object.keys(sub.responses || {}),
            });
          });
        } catch (error) {
          log("Error fetching form submissions:", error);
        }
      }

      const placeholderData = {
        card: {
          title: cardData.title,
          description: cardData.description,
          fields: cardData.fields || [],
        },
        stage: cardData.stage ? {
          name: cardData.stage.name,
        } : undefined,
        pipe: cardData.stage?.pipe ? {
          name: cardData.stage.pipe.name,
        } : undefined,
        formSubmissions: formSubmissions,
      };

      processedSubject = replacePlaceholders(subject, placeholderData, baseUrl);
      processedBody = replacePlaceholders(body, placeholderData, baseUrl);

      log("Placeholders replaced in subject and body");
    }

    // Fetch and replace global variables from system settings
    try {
      const systemSettings = await adminDb.query({
        system_settings: {},
      });

      const settings = systemSettings?.system_settings?.[0];
      const globalVariables = settings?.globalVariables || [];

      if (Array.isArray(globalVariables) && globalVariables.length > 0) {
        log(`Found ${globalVariables.length} global variables`);

        // Replace global variables in subject and body
        globalVariables.forEach((variable: { name: string; value: string }) => {
          const placeholder = `{{${variable.name}}}`;
          processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), variable.value);
          processedBody = processedBody.replace(new RegExp(placeholder, 'g'), variable.value);
          log(`  Replaced ${placeholder} with ${variable.value}`);
        });

        log("Global variables replaced in subject and body");
      }
    } catch (error) {
      log("Error fetching global variables (continuing without them):", error);
    }

    // Generate unique email ID for tracking
    const emailId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Add card ID to subject for reply matching (if cardId is provided)
    // Format: "Original Subject [#cardId]"
    const subjectWithCardId = cardId ? `${processedSubject} [#${cardId}]` : processedSubject;

    log("Subject with card ID:", subjectWithCardId);
    log("Sending to n8n:", N8N_EMAIL_URL);

    // Send to n8n for actual email delivery
    let response;
    try {
      response = await fetch(N8N_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          from: effectiveFromEmail,
          fromName: effectiveFromName,
          replyTo: effectiveFromEmail, // Use from as reply-to address
          cc: cc || undefined, // Include CC if provided
          bcc: bcc || undefined, // Include BCC if provided
          subject: subjectWithCardId, // Use subject with card ID and placeholders replaced
          body: processedBody, // Use body with placeholders replaced
          html: processedBody, // Include HTML field for email clients
          text: processedBody.replace(/<[^>]*>/g, ""), // Strip HTML for plain text version
          isHtml: true, // Flag to indicate HTML content
          cardId,
          cardData,
          emailId, // Include email ID for tracking
          timestamp: Date.now(),
        }),
      });
    } catch (fetchError: any) {
      log("❌ Failed to reach n8n:", fetchError.message);
      return NextResponse.json(
        {
          error: "Cannot connect to n8n",
          message: "Failed to reach n8n webhook. Is n8n running?",
          details: fetchError.message,
          n8nUrl: N8N_EMAIL_URL,
          debugLogs: debugLogs,
        },
        { status: 503 }
      );
    }

    log("n8n response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      log("❌ n8n error response:", errorText);
      return NextResponse.json(
        {
          error: "n8n webhook error",
          message: `n8n returned ${response.status}: ${response.statusText}`,
          details: errorText,
          n8nUrl: N8N_EMAIL_URL,
          debugLogs: debugLogs,
        },
        { status: response.status }
      );
    }

    // Log sent email to database if cardId is provided
    if (cardId) {
      try {
        const cardEmailId = id();
        log("Saving email to database, cardId:", cardId, "emailId:", cardEmailId);

        await adminDb.transact([
          adminDb.tx.card_emails[cardEmailId].update({
            direction: "sent",
            from: formattedFrom,
            to,
            cc: cc || undefined,
            subject: subjectWithCardId, // Store subject with card ID and placeholders replaced
            body: processedBody, // Store body with placeholders replaced
            sentAt: Date.now(),
            emailId,
            read: true, // Sent emails are already "read" by the sender
            sentVia: sentVia || undefined,
          }).link({ card: cardId }),
        ]);

        log("✅ Email logged to database");
      } catch (dbError: any) {
        log("⚠️ Failed to log email to database:", dbError.message);
        // Don't fail the request if database logging fails
      }
    }

    log("✅ Email sent successfully via n8n");

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      to,
      subject: processedSubject, // Return processed subject (without card ID)
      emailId,
      debugLogs: debugLogs, // Include debug logs in response
    });
  } catch (error: any) {
    console.error("❌ Error sending email:", error);
    debugLogs.push("❌ Error: " + error.message);
    return NextResponse.json(
      {
        error: "Failed to send email",
        details: error.message,
        hint: "Check n8n workflow is running and N8N_EMAIL_URL is correct",
        debugLogs: debugLogs,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for documentation
export async function GET() {
  return NextResponse.json({
    message: "Send Email API Endpoint",
    method: "POST",
    configured: {
      n8nEmailUrl: N8N_EMAIL_URL ? "✓ Configured" : "✗ Not configured",
    },
    usage: {
      url: "/api/send-email",
      body: {
        to: "recipient@example.com (from 電郵 field)",
        subject: "Email subject with {{placeholders}}",
        body: "Email body with {{placeholders}}",
        cardId: "Card ID for reference",
        cardData: "Complete card data for placeholders",
      },
    },
    instructions: [
      "1. Create an n8n workflow with Webhook trigger",
      "2. Add Email node (Gmail, SMTP, etc.) in n8n",
      "3. Set N8N_EMAIL_URL in .env.local to your n8n webhook URL",
      "4. Restart the app",
      "5. Send emails from cards using templates"
    ],
  });
}
