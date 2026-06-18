import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";
import { replacePlaceholders } from "@/lib/placeholders";
import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return emailRegex.test(value);
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
  const useDefault =
    !from ||
    from === "system" ||
    !isValidEmail(from);

  if (useDefault) {
    return {
      effectiveFromEmail: defaultFromEmail,
      effectiveFromName: fromName || defaultFromName,
    };
  }

  return {
    effectiveFromEmail: from,
    effectiveFromName: fromName || defaultFromName,
  };
}

/**
 * POST /api/send-email
 *
 * Sends email via Resend and logs the email to the database for tracking
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
    if (!isValidEmail(to)) {
      return NextResponse.json(
        { error: "Invalid email address format", email: to },
        { status: 400 }
      );
    }

    if (!RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: "Email service not configured",
          message: "Please set RESEND_API_KEY to enable email sending",
          debugLogs,
        },
        { status: 503 }
      );
    }

    // Fetch system settings from database (used for email defaults and global variables)
    let systemSettingsData = null;
    try {
      const systemSettings = await adminDb.query({
        system_settings: {},
      });
      systemSettingsData = systemSettings?.system_settings?.[0];
    } catch (error) {
      log("⚠️ Error fetching system settings from database:", error);
    }

    // Get email configuration from database first, then fall back to environment variables
    let defaultFromEmail = process.env.DEFAULT_FROM_EMAIL || "";
    let defaultFromName = process.env.DEFAULT_FROM_NAME || undefined;

    // Use database values if available, otherwise fall back to env vars
    if (systemSettingsData?.defaultFromEmail) {
      defaultFromEmail = systemSettingsData.defaultFromEmail;
      log("Using defaultFromEmail from database:", defaultFromEmail);
    } else {
      log("Using defaultFromEmail from env:", defaultFromEmail || "(none)");
    }

    if (systemSettingsData?.defaultFromName) {
      defaultFromName = systemSettingsData.defaultFromName;
      log("Using defaultFromName from database:", defaultFromName);
    } else {
      log("Using defaultFromName from env:", defaultFromName || "(none)");
    }

    if (!defaultFromEmail || !isValidEmail(defaultFromEmail)) {
      return NextResponse.json(
        {
          error: "Email service not configured",
          message: "Please set DEFAULT_FROM_EMAIL to a valid sender address",
          debugLogs,
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

    log("Effective From:", effectiveFromEmail);
    log("Effective From Name:", effectiveFromName || "(none)");

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
      let formSubmissions: any[] = [];
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

    // Replace global variables from system settings (already fetched above)
    const globalVariables = systemSettingsData?.globalVariables || [];

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

    // Generate unique email ID for tracking
    const emailId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Add card ID to subject for reply matching (if cardId is provided)
    // Format: "Original Subject [#cardId]"
    const subjectWithCardId = cardId ? `${processedSubject} [#${cardId}]` : processedSubject;

    log("Subject with card ID:", subjectWithCardId);
    log("Sending via Resend");

    const resend = new Resend(RESEND_API_KEY);
    const resendFrom = formatResendFrom(effectiveFromEmail, effectiveFromName);
    const plainTextBody = processedBody.replace(/<[^>]*>/g, "");

    const { data: resendData, error: resendError } = await resend.emails.send({
      from: resendFrom,
      to,
      cc: cc || undefined,
      bcc: bcc || undefined,
      replyTo: effectiveFromEmail,
      subject: subjectWithCardId,
      html: processedBody,
      text: plainTextBody,
    });

    if (resendError) {
      console.error("❌ Resend error:", resendError);
      log("❌ Resend error:", resendError.message);
      return NextResponse.json(
        {
          error: "Failed to send email",
          message: resendError.message,
          debugLogs,
        },
        { status: 502 }
      );
    }

    log("✅ Resend response id:", resendData?.id);

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

    log("✅ Email sent successfully via Resend");

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      to,
      subject: processedSubject, // Return processed subject (without card ID)
      emailId,
      resendId: resendData?.id,
      debugLogs: debugLogs, // Include debug logs in response
    });
  } catch (error: any) {
    console.error("❌ Error sending email:", error);
    debugLogs.push("❌ Error: " + error.message);
    return NextResponse.json(
      {
        error: "Failed to send email",
        message: error.message,
        debugLogs: debugLogs,
      },
      { status: 500 }
    );
  }
}

// GET endpoint for documentation
export async function GET() {
  const defaultFromEmail = process.env.DEFAULT_FROM_EMAIL;
  return NextResponse.json({
    message: "Send Email API Endpoint",
    method: "POST",
    configured: {
      resendApiKey: RESEND_API_KEY ? "✓ Configured" : "✗ Not configured",
      defaultFromEmail: defaultFromEmail ? "✓ Configured" : "✗ Not configured",
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
      "1. Set RESEND_API_KEY in your environment",
      "2. Set DEFAULT_FROM_EMAIL to a verified Resend sender address",
      "3. Optionally set DEFAULT_FROM_NAME for the sender display name",
      "4. Send emails from cards using templates",
    ],
  });
}
