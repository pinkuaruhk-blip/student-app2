import { NextRequest, NextResponse } from "next/server";
import { init, id } from "@instantdb/admin";

// Initialize InstantDB Admin SDK
// Force recompile - added fromName support to email templates
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "f0827431-76de-4f51-a2c3-bae2e1558bcc";
const ADMIN_KEY = process.env.INSTANT_ADMIN_KEY;
const N8N_SECRET = process.env.N8N_SHARED_SECRET;

if (!ADMIN_KEY) {
  console.error("INSTANT_ADMIN_KEY is not set");
}

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_KEY,
});

/**
 * Load fixed field definitions from settings
 */
async function loadFieldDefinitions(): Promise<Array<{ name: string; type: string; position: number }>> {
  try {
    const fs = await import('fs/promises');
    const fieldsPath = '/home/vibecode/workspace/data/n8n-field-definitions.json';
    const content = await fs.readFile(fieldsPath, 'utf-8');
    const fields = JSON.parse(content);

    console.log("📋 Loaded fixed field definitions:", fields.length, "fields");
    return fields.sort((a: any, b: any) => a.position - b.position);
  } catch (error: any) {
    console.log("ℹ️  No fixed field definitions found - using dynamic fields");
    return [];
  }
}

/**
 * POST /api/intake/n8n
 *
 * Receives form submissions from n8n and creates a card with fields
 * Much simpler than Formbricks since you control the payload structure
 */
export async function POST(request: NextRequest) {
  // Debug logs array to capture all logs for response
  const debugLogs: string[] = [];
  const log = (message: string) => {
    console.log(message);
    debugLogs.push(message);
  };

  try {
    const body = await request.json();

    // Log the entire payload
    console.log("=== n8n Form Webhook Received ===");
    console.log("Full payload:", JSON.stringify(body, null, 2));
    console.log("Query params:", {
      pipeId: request.nextUrl.searchParams.get("pipeId"),
      stageId: request.nextUrl.searchParams.get("stageId"),
    });
    console.log("==================================");

    // Save to file for debugging
    try {
      const fs = await import('fs/promises');
      const logPath = '/home/vibecode/workspace/logs/n8n-webhook.json';
      await fs.writeFile(logPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        body,
        queryParams: {
          pipeId: request.nextUrl.searchParams.get("pipeId"),
          stageId: request.nextUrl.searchParams.get("stageId"),
        }
      }, null, 2));
      console.log("📝 Payload saved to:", logPath);
    } catch (err) {
      console.error("Failed to save log:", err);
    }

    // Verify secret (optional)
    const secret = request.nextUrl.searchParams.get("secret") || body.secret;
    if (N8N_SECRET && secret && secret !== N8N_SECRET) {
      console.warn("Secret mismatch:", { received: secret, expected: N8N_SECRET });
      return NextResponse.json(
        { error: "Invalid secret" },
        { status: 401 }
      );
    }

    if (!ADMIN_KEY) {
      return NextResponse.json(
        { error: "Server configuration error: INSTANT_ADMIN_KEY not set" },
        { status: 500 }
      );
    }

    // Extract data - n8n can send data however you structure it
    // Common patterns:
    // 1. Flat structure: { title: "x", field1: "y", field2: "z" }
    // 2. Nested in data: { data: { title: "x", field1: "y" } }
    // 3. Array of fields: { fields: [{ name: "x", value: "y" }] }

    const formData = body.data || body;

    // Extract card metadata
    const cardTitle =
      formData.title ||
      formData.Title ||
      formData.name ||
      formData.Name ||
      formData.subject ||
      "Untitled Card";

    const cardDescription =
      formData.description ||
      formData.Description ||
      formData.message ||
      formData.notes ||
      "";

    const cardPipeId =
      request.nextUrl.searchParams.get("pipeId") ||
      formData.pipeId ||
      formData.pipe_id;

    const cardStageId =
      request.nextUrl.searchParams.get("stageId") ||
      formData.stageId ||
      formData.stage_id;

    console.log("Extracted values:", {
      title: cardTitle,
      description: cardDescription,
      pipeId: cardPipeId,
      stageId: cardStageId,
      totalFields: Object.keys(formData).length,
    });

    // Validate required fields
    if (!cardPipeId || !cardStageId) {
      return NextResponse.json(
        {
          error: "Missing required fields: pipeId and stageId",
          hint: "Add them to the webhook URL as query params",
          example: "/api/intake/n8n?pipeId=YOUR_PIPE_ID&stageId=YOUR_STAGE_ID",
          received: {
            pipeId: cardPipeId,
            stageId: cardStageId,
            title: cardTitle,
          },
        },
        { status: 400 }
      );
    }

    const cardId = id();
    const now = Date.now();

    // Build transaction
    const txs: any[] = [
      // Create card and link to pipe and stage
      db.tx.cards[cardId].update({
        title: cardTitle,
        description: cardDescription,
        createdAt: now,
        updatedAt: now,
      }).link({ pipe: cardPipeId, stage: cardStageId }),
    ];

    // Load fixed field definitions
    const fieldDefinitions = await loadFieldDefinitions();

    // Skip metadata fields
    const skipKeys = [
      'pipeId', 'pipe_id', 'pipeline',
      'stageId', 'stage_id', 'stage',
      'title', 'Title', 'name', 'Name', 'subject',
      'description', 'Description', 'message', 'notes',
      'secret', 'data'
    ];

    // Track fields for event/response
    let fieldsCreated = 0;
    const fieldsData: Array<{ key: string; value: any }> = [];

    if (fieldDefinitions.length === 0) {
      // No fixed fields defined - return error
      return NextResponse.json({
        error: "No field definitions found",
        message: "Please define fixed fields at /settings/n8n-fields before creating cards",
        hint: "Visit https://preview-rrwyydajbhzw.share.sandbox.dev/settings/n8n-fields to define your fields"
      }, { status: 400 });
    }

    // Use fixed field definitions only
    console.log("📌 Using fixed field definitions");

    fieldDefinitions.forEach((fieldDef, index) => {
      const fieldId = id();
      const fieldValue = formData[fieldDef.name];

      // Get value from formData, or leave empty if not provided
      // IMPORTANT: Empty/blank fields are allowed!
      let processedValue = fieldValue !== undefined && fieldValue !== null ? fieldValue : "";

      // Process value based on defined type
      if (processedValue !== "") {
        if (fieldDef.type === 'number' && typeof processedValue !== 'number') {
          processedValue = parseFloat(processedValue) || 0;
        } else if (fieldDef.type === 'boolean') {
          processedValue = processedValue ? 'Yes' : 'No';
        } else if (typeof processedValue === 'object') {
          processedValue = JSON.stringify(processedValue);
        }
      }

      txs.push(
        db.tx.card_fields[fieldId].update({
          key: fieldDef.name,
          type: fieldDef.type,
          value: processedValue,
          position: index,
        }).link({ card: cardId })
      );

      fieldsData.push({ key: fieldDef.name, value: processedValue });
    });

    fieldsCreated = fieldDefinitions.length;
    console.log(`📦 Creating card with ${fieldsCreated} fixed fields (some may be empty)`);

    // Execute transaction
    await db.transact(txs);

    console.log("✅ Card created successfully:", cardId);

    // Trigger automations for card entering stage (using the same db instance)
    let automationResult: any = null;
    let automationError: any = null;

    try {
      console.log("🤖 Triggering automations for new card entering stage...");
      console.log("   Card ID:", cardId);
      console.log("   Pipe ID:", cardPipeId);
      console.log("   Stage ID:", cardStageId);

      // First, try querying ALL pipes to see if the db works at all
      console.log("🔍 Testing: Query ALL pipes...");
      const allPipesData = await db.query({
        pipes: {},
      });
      console.log("📊 Total pipes found:", allPipesData?.pipes?.length || 0);
      if (allPipesData?.pipes && allPipesData.pipes.length > 0) {
        console.log("📊 First pipe ID:", allPipesData.pipes[0].id);
        console.log("📊 First pipe name:", allPipesData.pipes[0].name);
      }

      // Now query the specific pipe
      console.log("🔍 Querying specific pipe with ID:", cardPipeId);
      const pipeData = await db.query({
        pipes: {
          $: { where: { id: cardPipeId } },
          automations: {},
        },
      });

      const pipe = pipeData?.pipes?.[0];
      console.log("📦 Specific pipe found:", !!pipe);
      if (pipe) {
        console.log("📦 Pipe name:", pipe.name);
        console.log("📦 Automations count:", pipe.automations?.length || 0);
      }

      if (!pipe) {
        automationResult = {
          success: false,
          error: "Pipe not found",
          debug: {
            queriedPipeId: cardPipeId,
            totalPipesInDb: allPipesData?.pipes?.length || 0,
            samplePipeIds: allPipesData?.pipes?.slice(0, 3).map((p: any) => p.id) || [],
          }
        };
      } else {
        // Get card data with fields for condition evaluation
        const cardData = await db.query({
          cards: {
            $: { where: { id: cardId } },
            fields: {},
          },
        });
        const card = cardData?.cards?.[0];

        // Filter matching automations (checking both trigger AND conditions)
        const matchingAutomations: any[] = [];

        for (const auto of pipe.automations || []) {
          // Check if trigger matches
          if (!auto.enabled || auto.triggerType !== "card_enters_stage" || auto.triggerConfig?.stageId !== cardStageId) {
            continue;
          }

          // Check conditions
          if (auto.conditions && auto.conditions.rules && auto.conditions.rules.length > 0) {
            console.log(`  🔍 Checking conditions for: ${auto.name}`);

            const results = auto.conditions.rules.map((rule: any) => {
              const field = card?.fields?.find((f: any) => f.key === rule.fieldKey);
              const fieldValue = field?.value;

              console.log(`    • Field "${rule.fieldKey}": "${fieldValue}" ${rule.operator} "${rule.value}"`);

              switch (rule.operator) {
                case "equals":
                  return String(fieldValue) === String(rule.value);
                case "not_equals":
                  return String(fieldValue) !== String(rule.value);
                case "contains":
                  return String(fieldValue).includes(String(rule.value));
                case "is_filled":
                  return fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== "";
                case "is_empty":
                  return !fieldValue || String(fieldValue).trim() === "";
                default:
                  return false;
              }
            });

            const conditionsMet = auto.conditions.logic === "AND"
              ? results.every((r: boolean) => r)
              : results.some((r: boolean) => r);

            console.log(`    ${conditionsMet ? "✅" : "❌"} Conditions ${conditionsMet ? "met" : "not met"}`);

            if (conditionsMet) {
              matchingAutomations.push(auto);
            }
          } else {
            // No conditions, auto matches
            matchingAutomations.push(auto);
          }
        }

        console.log(`📋 Found ${matchingAutomations.length} matching automations (with conditions checked)`);

        const executedAutomations: string[] = [];
        const failedAutomations: Array<{ name: string; error: string }> = [];
        const followUpExecuted: string[] = []; // Track follow-up automations

        // Execute each automation
        for (const automation of matchingAutomations) {
          console.log(`▶️ Executing automation: ${automation.name}`);

          try {
            // Execute each action
            for (const action of automation.actions || []) {
              console.log(`  🎬 Executing action: ${action.type}`);

              if (action.type === "move_card") {
                const targetStageId = action.config?.targetStageId;
                if (targetStageId) {
                  await db.transact([
                    db.tx.cards[cardId].update({ updatedAt: Date.now() }).link({ stage: targetStageId }),
                  ]);
                  console.log(`  ✅ Moved card to stage: ${targetStageId}`);

                  // Wait for database to update before checking follow-up automations
                  await new Promise(resolve => setTimeout(resolve, 500));

                  // Trigger follow-up automations for the new stage
                  log(`  🔄 Checking for follow-up automations in new stage: ${targetStageId}...`);

                  // Get card data with fields for condition evaluation
                  const followUpCardData = await db.query({
                    cards: {
                      $: { where: { id: cardId } },
                      fields: {},
                    },
                  });
                  const followUpCard = followUpCardData?.cards?.[0];

                  // Find automations for the new stage
                  log(`  🔍 Checking ${pipe.automations?.length || 0} automations for follow-up`);
                  log(`  🎯 Looking for automations with stageId: ${targetStageId}`);

                  const followUpAutomations: any[] = [];
                  for (const followAuto of pipe.automations || []) {
                    log(`    • Checking automation: "${followAuto.name}"`);
                    log(`      - Enabled: ${followAuto.enabled}`);
                    log(`      - Trigger type: ${followAuto.triggerType}`);
                    log(`      - Trigger stageId: ${followAuto.triggerConfig?.stageId}`);
                    log(`      - Target stageId: ${targetStageId}`);
                    log(`      - Match: ${followAuto.enabled && followAuto.triggerType === "card_enters_stage" && followAuto.triggerConfig?.stageId === targetStageId}`);

                    if (!followAuto.enabled || followAuto.triggerType !== "card_enters_stage" || followAuto.triggerConfig?.stageId !== targetStageId) {
                      continue;
                    }

                    // Check conditions for follow-up automation
                    if (followAuto.conditions && followAuto.conditions.rules && followAuto.conditions.rules.length > 0) {
                      log(`      🔍 Checking conditions for automation...`);
                      const results = followAuto.conditions.rules.map((rule: any) => {
                        const field = followUpCard?.fields?.find((f: any) => f.key === rule.fieldKey);
                        const fieldValue = field?.value;

                        switch (rule.operator) {
                          case "equals":
                            return String(fieldValue) === String(rule.value);
                          case "not_equals":
                            return String(fieldValue) !== String(rule.value);
                          case "contains":
                            return String(fieldValue).includes(String(rule.value));
                          case "is_filled":
                            return fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== "";
                          case "is_empty":
                            return !fieldValue || String(fieldValue).trim() === "";
                          default:
                            return false;
                        }
                      });

                      const conditionsMet = followAuto.conditions.logic === "AND"
                        ? results.every((r: boolean) => r)
                        : results.some((r: boolean) => r);

                      log(`      ${conditionsMet ? "✅" : "❌"} Conditions ${conditionsMet ? "met" : "not met"}`);

                      if (conditionsMet) {
                        followUpAutomations.push(followAuto);
                        log(`      ✅ Added to follow-up automations`);
                      }
                    } else {
                      log(`      ℹ️  No conditions - adding to follow-up automations`);
                      followUpAutomations.push(followAuto);
                    }
                  }

                  log(`  📋 Found ${followUpAutomations.length} follow-up automations`);

                  // Execute follow-up automations
                  for (const followAuto of followUpAutomations) {
                    log(`  ▶️ Executing follow-up: ${followAuto.name}`);

                    try {
                      for (const followAction of followAuto.actions || []) {
                        log(`    🎬 Executing follow-up action: ${followAction.type}`);

                        if (followAction.type === "send_email") {
                          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

                          // Fetch email template first
                          const templateId = followAction.config?.templateId;
                          if (!templateId) {
                            log(`    ❌ Template ID is missing`);
                            throw new Error("Template ID is required for send_email action");
                          }

                          log(`    📧 Fetching email template: ${templateId}`);
                          const templateData = await db.query({
                            email_templates: {
                              $: { where: { id: templateId } },
                            },
                          });

                          const template = templateData?.email_templates?.[0];
                          if (!template) {
                            log(`    ❌ Email template not found: ${templateId}`);
                            throw new Error(`Email template not found: ${templateId}`);
                          }

                          log(`    ✅ Template found: ${template.name}`);

                          // Get the recipient email from the card field (if specified)
                          const recipientFieldKey = followAction.config?.recipientField;
                          let recipientEmail = null;

                          if (recipientFieldKey) {
                            log(`    📧 Looking for recipient email in field: ${recipientFieldKey}`);
                            const recipientField = followUpCard?.fields?.find((f: any) => f.key === recipientFieldKey);
                            recipientEmail = recipientField?.value;

                            if (recipientEmail) {
                              log(`    ✅ Found recipient email: ${recipientEmail}`);
                            }
                          }

                          // Use template's toEmail if no recipient email from card field
                          if (!recipientEmail && template.toEmail) {
                            recipientEmail = template.toEmail;
                            log(`    📧 Using template's To Email: ${recipientEmail}`);
                          }

                          // If still no recipient email, throw error
                          if (!recipientEmail) {
                            log(`    ❌ No recipient email found`);
                            throw new Error(`No recipient email found. Either specify a recipient field in automation config or set "To Email" in the email template.`);
                          }

                          // Get full card data for placeholder processing
                          log(`    🔍 Fetching full card data for placeholders...`);
                          const fullCardData = await db.query({
                            cards: {
                              $: { where: { id: cardId } },
                              fields: {},
                              stage: {
                                pipe: {},
                              },
                            },
                          });

                          const fullCard = fullCardData?.cards?.[0];

                          log(`    📧 Sending email to: ${recipientEmail}`);

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
                              cardData: fullCard,
                            }),
                          });

                          const emailResponseText = await emailResponse.text();

                          if (emailResponse.ok) {
                            log(`    ✅ Follow-up email sent successfully`);
                            console.log(`  ✅ Follow-up email sent`);
                            followUpExecuted.push(`${followAuto.name} (follow-up)`);
                          } else {
                            log(`    ❌ Follow-up email failed: ${emailResponse.status} - ${emailResponseText}`);
                            console.error(`  ❌ Follow-up email failed:`, emailResponse.status, emailResponseText);
                            throw new Error(`Email send failed: ${emailResponse.status} - ${emailResponseText}`);
                          }
                        } else if (followAction.type === "send_form_link") {
                          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

                          // Get form ID
                          const formId = followAction.config?.formId;
                          if (!formId) {
                            log(`    ❌ Form ID is missing`);
                            throw new Error("Form ID is required for send_form_link action");
                          }

                          // Generate form link
                          const formLink = `${baseUrl}/form/${cardId}/${formId}`;
                          log(`    🔗 Generated form link: ${formLink}`);

                          // Get the recipient email from the card field (if specified)
                          const recipientFieldKey = followAction.config?.recipientField;
                          let recipientEmail = null;

                          if (recipientFieldKey) {
                            log(`    📧 Looking for recipient email in field: ${recipientFieldKey}`);
                            const recipientField = followUpCard?.fields?.find((f: any) => f.key === recipientFieldKey);
                            recipientEmail = recipientField?.value;

                            if (recipientEmail) {
                              log(`    ✅ Found recipient email: ${recipientEmail}`);
                            }
                          }

                          // Get form details and full card data
                          const [formDataResult, fullCardDataResult] = await Promise.all([
                            db.query({
                              stage_forms: {
                                $: { where: { id: formId } },
                              },
                            }),
                            db.query({
                              cards: {
                                $: { where: { id: cardId } },
                                fields: {},
                                stage: {
                                  pipe: {},
                                },
                              },
                            }),
                          ]);

                          const form = formDataResult?.stage_forms?.[0];
                          const fullCard = fullCardDataResult?.cards?.[0];

                          let subject = `Form: ${form?.name || "Please complete this form"}`;
                          let body = `Please complete this form: ${formLink}`;
                          let template = null;

                          // Load and process email template if specified
                          const templateId = followAction.config?.templateId;
                          if (templateId) {
                            log(`    📧 Fetching email template: ${templateId}`);
                            const templateData = await db.query({
                              email_templates: {
                                $: { where: { id: templateId } },
                              },
                            });

                            template = templateData?.email_templates?.[0];
                            if (template) {
                              log(`    ✅ Template found: ${template.name}`);

                              subject = template.subject;
                              body = template.body;

                              // Use template's toEmail if no recipient email from card field
                              if (!recipientEmail && template.toEmail) {
                                recipientEmail = template.toEmail;
                                log(`    📧 Using template's To Email: ${recipientEmail}`);
                              }

                              // Replace {{form.link}} and {{form.name}} placeholders
                              subject = subject.replace(/\{\{form\.link\}\}/g, formLink);
                              subject = subject.replace(/\{\{form\.name\}\}/g, form?.name || "Form");
                              body = body.replace(/\{\{form\.link\}\}/g, formLink);
                              body = body.replace(/\{\{form\.name\}\}/g, form?.name || "Form");
                            }
                          }

                          // If still no recipient email, throw error
                          if (!recipientEmail) {
                            log(`    ❌ No recipient email found`);
                            throw new Error(`No recipient email found. Either specify a recipient field in automation config or set "To Email" in the email template.`);
                          }

                          log(`    📧 Sending email to: ${recipientEmail}`);

                          const emailResponse = await fetch(`${baseUrl}/api/send-email`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              to: recipientEmail,
                              from: template?.fromEmail || undefined,
                              fromName: template?.fromName || undefined,
                              bcc: template?.bcc || undefined,
                              subject,
                              body,
                              cardId,
                              cardData: fullCard || followUpCard,
                            }),
                          });

                          const emailResponseText = await emailResponse.text();

                          if (emailResponse.ok) {
                            log(`    ✅ Follow-up form link email sent successfully`);
                            followUpExecuted.push(`${followAuto.name} (follow-up)`);
                          } else {
                            log(`    ❌ Follow-up form link email failed: ${emailResponse.status} - ${emailResponseText}`);
                            throw new Error(`Email send failed: ${emailResponse.status} - ${emailResponseText}`);
                          }
                        }
                        // Note: Not recursively handling move_card to avoid infinite loops
                      }
                    } catch (followError: any) {
                      log(`    ❌ Follow-up automation failed: ${followError.message}`);
                      console.error(`  ❌ Follow-up automation failed:`, followError);
                      failedAutomations.push({ name: `${followAuto.name} (follow-up)`, error: followError.message });
                    }
                  }
                }
              } else if (action.type === "send_email") {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
                  const cardData = await db.query({
                    cards: {
                      $: { where: { id: cardId } },
                      fields: {},
                      stage: {
                        pipe: {},
                      },
                    },
                  });

                  const card = cardData?.cards?.[0];
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
                const cardData = await db.query({
                  cards: {
                    $: { where: { id: cardId } },
                    fields: {},
                    stage: {
                      pipe: {},
                    },
                  },
                });
                const card = cardData?.cards?.[0];

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

        automationResult = {
          success: true,
          automationsFound: pipe.automations?.length || 0,
          automationsMatched: matchingAutomations.length,
          automationsExecuted: executedAutomations,
          followUpAutomationsExecuted: followUpExecuted,
          automationsFailed: failedAutomations,
        };
      }

      console.log("✅ Automation result:", JSON.stringify(automationResult, null, 2));
    } catch (error: any) {
      console.error("❌ Error triggering automations:", error);
      console.error("   Error details:", error.message);
      automationError = error.message;
      automationResult = { success: false, error: error.message };
    }

    // Send event to n8n for workflow automation (optional)
    const n8nEventsUrl = process.env.N8N_EVENTS_URL;
    if (n8nEventsUrl) {
      try {
        await fetch(n8nEventsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "card.created",
            cardId,
            pipeId: cardPipeId,
            stageId: cardStageId,
            title: cardTitle,
            description: cardDescription,
            fields: fieldsData,
            timestamp: now,
          }),
        });
        console.log("📤 Sent card.created event to n8n");
      } catch (err) {
        console.error("Failed to send event to n8n:", err);
      }
    }

    return NextResponse.json({
      success: true,
      cardId,
      message: "Card created successfully",
      fieldsCreated: fieldsCreated,
      automation: automationResult || { error: automationError },
      debugLogs: debugLogs, // Include debug logs in response
    });
  } catch (error: any) {
    console.error("❌ Error in /api/intake/n8n:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const pipeId = request.nextUrl.searchParams.get("pipeId");
  const stageId = request.nextUrl.searchParams.get("stageId");

  return NextResponse.json({
    message: "n8n Form Webhook Endpoint",
    method: "POST",
    configured: {
      pipeId: pipeId || "NOT SET",
      stageId: stageId || "NOT SET",
    },
    instructions: [
      "1. Visit /pipes to get your Pipe ID and Stage ID",
      "2. Configure your n8n workflow to POST to this URL:",
      `   ${request.nextUrl.origin}/api/intake/n8n?pipeId=YOUR_PIPE_ID&stageId=YOUR_STAGE_ID`,
      "3. Structure your n8n form data as: { title: 'Card Title', field1: 'value1', field2: 'value2', ... }",
      "4. Field names from n8n will be used as-is (no need for mappings!)",
    ],
    example: {
      url: `${request.nextUrl.origin}/api/intake/n8n?pipeId=56155c2e-6b82-4942-8661-b2ca2eb7a120&stageId=69cbb51f-a0f5-4426-b71c-3e67fd5b2e17`,
      payload: {
        title: "基督教正生書院",
        "聯絡人": "Keith Lee",
        "電郵": "test@example.com",
        "小學/中學": "中學",
        "申請時間": "2025-08-05",
      }
    }
  });
}
