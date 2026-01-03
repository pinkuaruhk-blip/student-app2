import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";

// Initialize InstantDB Admin SDK locally
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "f0827431-76de-4f51-a2c3-bae2e1558bcc";
const ADMIN_KEY = process.env.INSTANT_ADMIN_KEY;

if (!ADMIN_KEY) {
  console.error("❌ INSTANT_ADMIN_KEY not configured!");
}

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    // Check if admin key is configured
    if (!ADMIN_KEY) {
      console.error("❌ INSTANT_ADMIN_KEY not configured!");
      return NextResponse.json(
        {
          error: "Server configuration error",
          message: "INSTANT_ADMIN_KEY is not set in .env.local",
          instruction: "Get your admin token from https://instantdb.com/dash and add it to .env.local",
        },
        { status: 500 }
      );
    }

    const { triggerType, cardId, pipeId, context } = await request.json();

    console.log("=== Execute Automations Request ===");
    console.log("Trigger Type:", triggerType);
    console.log("Card ID:", cardId);
    console.log("Pipe ID:", pipeId);
    console.log("Context:", context);

    if (!triggerType || !cardId || !pipeId) {
      return NextResponse.json(
        { error: "Missing required fields: triggerType, cardId, pipeId" },
        { status: 400 }
      );
    }

    // Query automations directly using local db instance
    console.log("🔍 Querying pipe with ID:", pipeId);

    const data = await db.query({
      pipes: {
        $: { where: { id: pipeId } },
        automations: {},
      },
    });

    const pipe = data?.pipes?.[0];
    console.log("📦 Pipe found:", !!pipe, pipe?.name);

    if (!pipe) {
      return NextResponse.json({
        success: false,
        error: "Pipe not found",
        pipeId,
      });
    }

    // Filter matching automations
    const matchingAutomations = (pipe.automations || []).filter((auto: any) => {
      if (!auto.enabled || auto.triggerType !== triggerType) return false;

      // Check trigger config
      if (triggerType === "card_enters_stage") {
        return auto.triggerConfig?.stageId === context?.stageId;
      }

      return true;
    });

    console.log(`📋 Found ${matchingAutomations.length} matching automations`);

    // Execute each matching automation
    const executedAutomations = [];
    const failedAutomations = [];

    for (const automation of matchingAutomations) {
      console.log(`▶️ Executing automation: ${automation.name}`);

      try {
        // Execute each action in the automation
        for (const action of automation.actions || []) {
          console.log(`  🎬 Executing action: ${action.type}`);

          if (action.type === "move_card") {
            // Move card to target stage
            const targetStageId = action.config?.targetStageId;
            if (targetStageId) {
              await db.transact([
                db.tx.cards[cardId].update({ updatedAt: Date.now() }).link({ stage: targetStageId }),
              ]);
              console.log(`  ✅ Moved card to stage: ${targetStageId}`);

              // Trigger follow-up automations for the new stage
              setTimeout(async () => {
                try {
                  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
                  await fetch(`${baseUrl}/api/execute-automations`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      triggerType: "card_enters_stage",
                      cardId,
                      pipeId,
                      context: { stageId: targetStageId },
                    }),
                  });
                } catch (err) {
                  console.error("  ❌ Error triggering follow-up automations:", err);
                }
              }, 100);
            }
          } else if (action.type === "send_email") {
            // Send email
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

            // Fetch email template first
            const templateId = action.config?.templateId;
            if (!templateId) {
              throw new Error("Template ID is required for send_email action");
            }

            console.log(`  📧 Fetching email template: ${templateId}`);
            const templateData = await db.query({
              email_templates: {
                $: { where: { id: templateId } },
              },
            });

            const template = templateData?.email_templates?.[0];
            if (!template) {
              throw new Error(`Email template not found: ${templateId}`);
            }

            console.log(`  📧 Template found: ${template.name}`);

            // Get the recipient email from the card field (if specified)
            const recipientFieldKey = action.config?.recipientField;
            let recipientEmail = null;

            if (recipientFieldKey) {
              const cardDataQuery = await db.query({
                cards: {
                  $: { where: { id: cardId } },
                  fields: {},
                  stage: {
                    pipe: {},
                  },
                },
              });

              const card = cardDataQuery?.cards?.[0];
              const recipientField = card?.fields?.find((f: any) => f.key === recipientFieldKey);
              recipientEmail = recipientField?.value;

              if (recipientEmail) {
                console.log(`  📧 Found recipient email from card field: ${recipientEmail}`);
              }
            }

            // Use template's toEmail if no recipient email from card field
            if (!recipientEmail && template.toEmail) {
              recipientEmail = template.toEmail;
              console.log(`  📧 Using template's To Email: ${recipientEmail}`);
            }

            // If still no recipient email, throw error
            if (!recipientEmail) {
              throw new Error(`No recipient email found. Either specify a recipient field in automation config or set "To Email" in the email template.`);
            }

            // Get full card data for placeholder processing
            const cardDataQuery = await db.query({
              cards: {
                $: { where: { id: cardId } },
                fields: {},
                stage: {
                  pipe: {},
                },
              },
            });
            const card = cardDataQuery?.cards?.[0];

            console.log(`  📧 Sending email to: ${recipientEmail}`);

            const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: recipientEmail,
                from: template.fromEmail || undefined,
                fromName: template.fromName || undefined,
                bcc: template.bcc || undefined,
                subject: template.subject,
                body: template.body,
                cardId,
                cardData: card,
              }),
            });

            if (!emailResponse.ok) {
              const errorText = await emailResponse.text();
              throw new Error(`Email send failed: ${errorText}`);
            }
            console.log(`  ✅ Email sent`);
          }
        }

        executedAutomations.push(automation.name);
        console.log(`✅ Automation completed: ${automation.name}`);
      } catch (error: any) {
        console.error(`❌ Automation failed: ${automation.name}`, error);
        failedAutomations.push({ name: automation.name, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Automations executed",
      details: {
        automationsFound: pipe.automations?.length || 0,
        automationsMatched: matchingAutomations.length,
        automationsExecuted: executedAutomations,
        automationsFailed: failedAutomations,
      },
    });
  } catch (error: any) {
    console.error("❌ Error executing automations:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      {
        error: "Failed to execute automations",
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
