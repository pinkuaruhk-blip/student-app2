/**
 * Automation Engine (Server-Side)
 * Handles trigger detection and action execution for workflow automations
 * This version runs server-side using the admin SDK
 */

import { adminDb } from "./db-admin";
import { id as generateId } from "@instantdb/admin";
import { processEmailTemplate, getFormLink } from "./email-templates";

/**
 * Check if automations should be triggered and execute them
 */
export async function checkAndExecuteAutomations(params: {
  triggerType:
    | "form_submission"
    | "card_enters_stage"
    | "card_field_value"
    | "manual";
  cardId: string;
  pipeId: string;
  context?: {
    formId?: string;
    stageId?: string;
    fieldKey?: string;
    fieldValue?: any;
  };
}) {
  const report = {
    automationsFound: 0,
    automationsMatched: 0,
    automationsExecuted: [] as string[],
    automationsSkipped: [] as string[],
    automationsFailed: [] as string[],
    details: [] as any[],
    debugInfo: {
      pipeFound: false,
      pipeName: "",
      totalAutomationsInPipe: 0,
      automationsBeforeFilter: [] as any[],
    },
  };

  try {
    console.log("🔍 Querying automations for:", {
      pipeId: params.pipeId,
      triggerType: params.triggerType,
    });

    // First, try to query ALL pipes to see if adminDb works at all
    const allPipesData = await adminDb.query({
      pipes: {},
    });

    console.log("🔍 Total pipes in database:", allPipesData?.pipes?.length || 0);
    if (allPipesData?.pipes && allPipesData.pipes.length > 0) {
      console.log("📋 First 3 pipe IDs:", allPipesData.pipes.slice(0, 3).map((p: any) => p.id));
    }

    // Query the specific pipe and its automations
    const data = await adminDb.query({
      pipes: {
        $: {
          where: {
            id: params.pipeId,
          },
        },
        automations: {},
      },
    });

    console.log("📦 Query for specific pipe - found:", data?.pipes?.length || 0);
    if (data?.pipes && data.pipes.length > 0) {
      console.log("📦 Pipe data:", JSON.stringify(data.pipes[0], null, 2));
    }

    const pipe = data?.pipes?.[0];
    if (!pipe) {
      console.log("⚠️ Pipe not found");
      report.details.push({
        error: "Pipe not found",
        pipeId: params.pipeId,
        totalPipesInDb: allPipesData?.pipes?.length || 0,
        samplePipeIds: allPipesData?.pipes?.slice(0, 3).map((p: any) => p.id) || [],
      });
      report.debugInfo.pipeFound = false;
      return report;
    }

    report.debugInfo.pipeFound = true;
    report.debugInfo.pipeName = pipe.name;
    report.debugInfo.totalAutomationsInPipe = pipe.automations?.length || 0;

    console.log("📍 Pipe found:", pipe.id, "name:", pipe.name);
    console.log("📋 All automations in pipe:", pipe.automations?.length || 0);

    // Log each automation before filtering
    if (pipe.automations && pipe.automations.length > 0) {
      pipe.automations.forEach((auto: any) => {
        console.log(`  - ${auto.name}: enabled=${auto.enabled}, triggerType=${auto.triggerType}`);
        report.debugInfo.automationsBeforeFilter.push({
          name: auto.name,
          id: auto.id,
          enabled: auto.enabled,
          triggerType: auto.triggerType,
        });
      });
    }

    // Filter to only enabled automations with matching trigger type
    const automations = (pipe.automations || []).filter(
      (automation: any) =>
        automation.enabled && automation.triggerType === params.triggerType
    );

    report.automationsFound = automations.length;
    console.log(`📋 Found ${automations.length} enabled automations with trigger type "${params.triggerType}"`);

    if (automations.length === 0) {
      console.log("⚠️ No enabled automations found for this trigger");
      return report;
    }

    // Filter automations that match the trigger config
    const matchingAutomations = automations.filter((automation: any) => {
      const matches = matchesTriggerConfig(
        automation.triggerType,
        automation.triggerConfig,
        params.context
      );
      console.log(`  ${matches ? "✅" : "❌"} Automation "${automation.name}" (${automation.id}):`, {
        triggerConfig: automation.triggerConfig,
        context: params.context,
      });

      report.details.push({
        name: automation.name,
        id: automation.id,
        matched: matches,
        triggerConfig: automation.triggerConfig,
      });

      return matches;
    });

    report.automationsMatched = matchingAutomations.length;
    console.log(`🎯 ${matchingAutomations.length} automations match the trigger config`);

    // Execute each matching automation in sequence
    for (const automation of matchingAutomations) {
      console.log(`▶️ Executing automation: ${automation.name}`);
      const execResult = await executeAutomation(automation, params.cardId);

      if (execResult.status === "success") {
        report.automationsExecuted.push(automation.name);
      } else if (execResult.status === "skipped") {
        report.automationsSkipped.push(automation.name);
      } else if (execResult.status === "error") {
        report.automationsFailed.push(automation.name);
      }

      // Add execution details
      const detail = report.details.find((d: any) => d.id === automation.id);
      if (detail) {
        detail.execution = execResult;
      }
    }

    return report;
  } catch (error) {
    console.error("❌ Error checking/executing automations:", error);
    report.details.push({
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Check if trigger config matches the context
 */
function matchesTriggerConfig(
  triggerType: string,
  triggerConfig: any,
  context?: any
): boolean {
  if (!context) return true;

  switch (triggerType) {
    case "form_submission":
      return triggerConfig.formId === context.formId;

    case "card_enters_stage":
      return triggerConfig.stageId === context.stageId;

    case "card_field_value":
      if (triggerConfig.fieldKey !== context.fieldKey) return false;
      const operator = triggerConfig.operator || "equals";
      const expectedValue = triggerConfig.value;
      const actualValue = context.fieldValue;

      switch (operator) {
        case "equals":
          return String(actualValue) === String(expectedValue);
        case "not_equals":
          return String(actualValue) !== String(expectedValue);
        case "contains":
          return String(actualValue).includes(String(expectedValue));
        default:
          return false;
      }

    case "manual":
      return true;

    default:
      return false;
  }
}

/**
 * Execute an automation's actions in sequence
 */
async function executeAutomation(automation: any, cardId: string) {
  const logId = generateId();
  const actionsExecuted: any[] = [];
  let status = "success";
  let errorMessage: string | undefined;
  let conditionsMet: boolean | undefined;

  console.log(`  🔄 Starting execution of automation: ${automation.name}`);
  console.log(`  📝 Log ID: ${logId}`);

  try {
    // Check conditions if they exist
    if (automation.conditions && automation.conditions.rules.length > 0) {
      console.log(`  🔍 Evaluating ${automation.conditions.rules.length} conditions...`);
      conditionsMet = await evaluateConditions(automation.conditions, cardId);
      console.log(`  ${conditionsMet ? "✅" : "❌"} Conditions result: ${conditionsMet}`);

      if (!conditionsMet) {
        status = "skipped";
        console.log(`  ⏭️ Skipping automation - conditions not met`);
        // Log the automation as skipped - no actions will be executed
        await adminDb.transact([
          adminDb.tx.automation_logs[logId]
            .update({
              executedAt: Date.now(),
              status,
              triggerType: automation.triggerType,
              conditionsMet,
              actionsExecuted: [],
              errorMessage: "Conditions not met",
            })
            .link({ card: cardId, automation: automation.id }),
        ]);
        console.log(`  ✅ Logged skipped automation`);
        return { status, conditionsMet, actionsExecuted, errorMessage: "Conditions not met", logId };
      }
    }

    console.log(`  🎬 Executing ${automation.actions?.length || 0} actions...`);

    // Execute each action in sequence
    for (const action of automation.actions || []) {
      console.log(`    ▶️ Action: ${action.type}`);
      try {
        const result = await executeAction(action, cardId);
        console.log(`    ✅ Action completed:`, result);
        actionsExecuted.push({
          type: action.type,
          config: action.config,
          status: "success",
          result,
        });
      } catch (error: any) {
        console.error(`    ❌ Action failed:`, error.message);
        actionsExecuted.push({
          type: action.type,
          config: action.config,
          status: "error",
          error: error.message,
        });
        throw error; // Stop execution on first error
      }
    }
  } catch (error: any) {
    status = "error";
    errorMessage = error.message;
    console.error(`  ❌ Automation execution failed:`, error.message);
  }

  // Log the automation execution
  console.log(`  💾 Creating automation log...`);
  console.log(`    Status: ${status}`);
  console.log(`    Actions executed: ${actionsExecuted.length}`);
  console.log(`    Card ID: ${cardId}`);
  console.log(`    Automation ID: ${automation.id}`);

  try {
    await adminDb.transact([
      adminDb.tx.automation_logs[logId]
        .update({
          executedAt: Date.now(),
          status,
          triggerType: automation.triggerType,
          conditionsMet,
          actionsExecuted,
          errorMessage,
        })
        .link({ card: cardId, automation: automation.id }),
    ]);
    console.log(`  ✅ Automation log created successfully with ID: ${logId}`);
  } catch (logError: any) {
    console.error(`  ❌ Failed to create automation log:`, logError);
    console.error(`  Stack:`, logError.stack);
  }

  return { status, conditionsMet, actionsExecuted, errorMessage, logId };
}

/**
 * Evaluate conditions against card data
 */
async function evaluateConditions(conditions: any, cardId: string): Promise<boolean> {
  // Query card to get all fields
  const data = await adminDb.query({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
    },
  });

  const card = data?.cards?.[0];
  if (!card) return false;

  const { logic, rules } = conditions;

  // Evaluate each condition rule
  const results = rules.map((rule: any) => {
    // Find the field value
    const field = card.fields?.find((f: any) => f.key === rule.fieldKey);
    const fieldValue = field?.value;

    return evaluateConditionRule(rule, fieldValue);
  });

  // Apply logic (AND/OR)
  if (logic === "AND") {
    return results.every((r: boolean) => r === true);
  } else {
    // OR
    return results.some((r: boolean) => r === true);
  }
}

/**
 * Evaluate a single condition rule
 */
function evaluateConditionRule(rule: any, fieldValue: any): boolean {
  const { operator, value: expectedValue } = rule;

  switch (operator) {
    case "equals":
      return String(fieldValue) === String(expectedValue);

    case "not_equals":
      return String(fieldValue) !== String(expectedValue);

    case "contains":
      return String(fieldValue).includes(String(expectedValue));

    case "greater_than":
      return Number(fieldValue) > Number(expectedValue);

    case "less_than":
      return Number(fieldValue) < Number(expectedValue);

    case "is_filled":
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== "";

    case "is_empty":
      return fieldValue === undefined || fieldValue === null || fieldValue === "";

    default:
      return false;
  }
}

/**
 * Execute a single action
 */
async function executeAction(action: any, cardId: string): Promise<any> {
  switch (action.type) {
    case "move_card":
      return await executeMoveCardAction(action.config, cardId);

    case "send_form_link":
      return await executeSendFormLinkAction(action.config, cardId);

    case "send_email":
      return await executeSendEmailAction(action.config, cardId);

    case "update_field":
      return await executeUpdateFieldAction(action.config, cardId);

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

/**
 * Move card to another stage
 */
async function executeMoveCardAction(
  config: { targetStageId: string },
  cardId: string
): Promise<any> {
  // Query card to get current stage
  const data = await adminDb.query({
    cards: {
      $: { where: { id: cardId } },
      stage: {},
    },
  });

  const card = data?.cards?.[0];
  if (!card) throw new Error("Card not found");

  const oldStage = card.stage;

  // Query new stage
  const stageData = await adminDb.query({
    stages: {
      $: { where: { id: config.targetStageId } },
    },
  });

  const newStage = stageData?.stages?.[0];
  if (!newStage) throw new Error("Target stage not found");

  // Create history entry and update card
  const historyId = generateId();
  await adminDb.transact([
    adminDb.tx.cards[cardId]
      .update({ updatedAt: Date.now() })
      .link({ stage: config.targetStageId }),
    adminDb.tx.card_history[historyId]
      .update({
        movedAt: Date.now(),
        fromStageId: oldStage?.id || null,
        toStageId: config.targetStageId,
        fromStageName: oldStage?.name || null,
        toStageName: newStage.name,
      })
      .link({ card: cardId }),
  ]);

  return {
    movedFrom: oldStage?.name,
    movedTo: newStage.name,
  };
}

/**
 * Send form link to recipient (using email template)
 */
async function executeSendFormLinkAction(
  config: { formId: string; recipientField: string; templateId?: string },
  cardId: string
): Promise<any> {
  // Query card with all necessary data
  const data = await adminDb.query({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
      stage: {
        pipe: {},
        forms: {},
      },
    },
  });

  const card = data?.cards?.[0];
  if (!card) throw new Error("Card not found");

  // Find the recipient field
  const recipientField = card.fields?.find(
    (f: any) => f.key === config.recipientField
  );
  const recipientEmail = recipientField?.value;

  if (!recipientEmail) {
    throw new Error(`Recipient field "${config.recipientField}" not found or empty`);
  }

  // Find the form
  const form = card.stage?.forms?.find((f: any) => f.id === config.formId);
  if (!form) throw new Error("Form not found");

  // Generate form link
  const formLink = getFormLink(cardId, config.formId);

  // Load email template if specified, otherwise use default
  let subject = `Action Required: Please fill out ${form.name}`;
  let body = `<p>Hello,</p><p>We need some information from you.</p><p>Please fill out the form: <a href="${formLink}">${form.name}</a></p><p>Thank you!</p>`;
  let fromEmail: string | undefined;
  let fromName: string | undefined;
  let cc: string | undefined;
  let bcc: string | undefined;

  if (config.templateId) {
    // Force recompile
    // Query template with explicit field selection
    const templateData = await adminDb.query({
      email_templates: {
        $: {
          where: { id: config.templateId },
        },
      },
    });

    const template = templateData?.email_templates?.[0];
    console.log("📧 Full template object:", template);

    if (template) {
      // Extract sender information from template
      fromEmail = template.fromEmail;
      fromName = template.fromName;
      cc = template.cc;
      bcc = template.bcc;
      console.log("📧 fromEmail from template:", fromEmail);
      console.log("📧 fromName from template:", fromName);

      // Process template with placeholder data
      const templateData = {
        card: {
          title: card.title,
          description: card.description,
          fields: card.fields,
        },
        form: {
          id: form.id,
          name: form.name,
          link: formLink,
        },
        stage: {
          name: card.stage?.name,
        },
        pipe: {
          name: card.stage?.pipe?.name,
        },
      };

      subject = processEmailTemplate(template.subject, templateData);
      body = processEmailTemplate(template.body, templateData);
    }
  }

  // Send email via API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log(`📧 Sending email to: ${recipientEmail}`);
  console.log(`📧 Using API URL: ${baseUrl}/api/send-email`);

  const response = await fetch(`${baseUrl}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: recipientEmail,
      from: fromEmail,
      fromName: fromName,
      cc: cc,
      bcc: bcc,
      subject,
      body,
      cardId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Send email API error:`, errorText);
    throw new Error(`Failed to send email: ${errorText}`);
  }

  const responseData = await response.json();
  console.log(`✅ Email sent successfully:`, responseData);

  return {
    recipientEmail,
    formLink,
    templateUsed: config.templateId || "default",
  };
}

/**
 * Send email template
 */
async function executeSendEmailAction(
  config: { templateId: string; recipientField: string; formId?: string },
  cardId: string
): Promise<any> {
  // Query card with all necessary data
  const data = await adminDb.query({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
      stage: {
        pipe: {},
        forms: {},
      },
    },
  });

  const card = data?.cards?.[0];
  if (!card) throw new Error("Card not found");

  // Find the recipient field
  const recipientField = card.fields?.find(
    (f: any) => f.key === config.recipientField
  );
  const recipientEmail = recipientField?.value;

  if (!recipientEmail) {
    throw new Error(`Recipient field "${config.recipientField}" not found or empty`);
  }

  // Load email template
  const templateData = await adminDb.query({
    email_templates: {
      $: {
        where: { id: config.templateId },
      },
    },
  });

  const template = templateData?.email_templates?.[0];
  console.log("📧 Full template object (send_email):", template);

  if (!template) throw new Error("Email template not found");

  // Extract sender information from template
  const fromEmail = template.fromEmail;
  const fromName = template.fromName;
  const cc = template.cc;
  const bcc = template.bcc;
  console.log("📧 fromEmail from template:", fromEmail);
  console.log("📧 fromName from template:", fromName);

  // Build template data
  const emailTemplateData: any = {
    card: {
      title: card.title,
      description: card.description,
      fields: card.fields,
    },
    stage: {
      name: card.stage?.name,
    },
    pipe: {
      name: card.stage?.pipe?.name,
    },
  };

  // If formId is specified, add form data
  if (config.formId) {
    const form = card.stage?.forms?.find((f: any) => f.id === config.formId);
    if (form) {
      emailTemplateData.form = {
        id: form.id,
        name: form.name,
        link: getFormLink(cardId, config.formId),
      };
    }
  }

  // Process template
  const subject = processEmailTemplate(template.subject, emailTemplateData);
  const body = processEmailTemplate(template.body, emailTemplateData);

  // Send email via API
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log(`📧 Sending email to: ${recipientEmail}`);
  console.log(`📧 Using API URL: ${baseUrl}/api/send-email`);

  const response = await fetch(`${baseUrl}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: recipientEmail,
      from: fromEmail,
      fromName: fromName,
      cc: cc,
      bcc: bcc,
      subject,
      body,
      cardId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Send email API error:`, errorText);
    throw new Error(`Failed to send email: ${errorText}`);
  }

  const responseData = await response.json();
  console.log(`✅ Email sent successfully:`, responseData);

  return {
    recipientEmail,
    templateId: config.templateId,
    subject,
  };
}

/**
 * Update card field value
 */
async function executeUpdateFieldAction(
  config: { fieldKey: string; value: any },
  cardId: string
): Promise<any> {
  // Query card to find the field
  const data = await adminDb.query({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
    },
  });

  const card = data?.cards?.[0];
  if (!card) throw new Error("Card not found");

  // Find existing field
  const existingField = card.fields?.find((f: any) => f.key === config.fieldKey);

  if (existingField) {
    // Update existing field
    await adminDb.transact([
      adminDb.tx.card_fields[existingField.id].update({
        value: config.value,
      }),
    ]);
  } else {
    // Create new field
    const fieldId = generateId();
    await adminDb.transact([
      adminDb.tx.card_fields[fieldId]
        .update({
          key: config.fieldKey,
          type: "text",
          value: config.value,
        })
        .link({ card: cardId }),
    ]);
  }

  return {
    fieldKey: config.fieldKey,
    newValue: config.value,
  };
}
