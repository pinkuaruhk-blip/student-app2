/**
 * Automation Engine (Client-Side)
 * Handles trigger detection and action execution for workflow automations
 * This version runs client-side using the regular db client
 */

import { db } from "./db";
import { id as generateId } from "@instantdb/react";
import { processEmailTemplate, getFormLink } from "./email-templates";

function maskEmail(email: string | null | undefined): string {
  if (!email) return "(empty)";
  const str = String(email);
  const at = str.indexOf("@");
  if (at <= 1) return str[0] + "***" + str.slice(at);
  return str[0] + "***" + str.slice(at);
}

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
  };

  try {
    console.log("🔍 Querying automations for:", {
      pipeId: params.pipeId,
      triggerType: params.triggerType,
    });

    // Query the pipe and its automations using client SDK
    const { data } = await db.queryOnce({
      pipes: {
        $: {
          where: {
            id: params.pipeId,
          },
        },
        automations: {},
      },
    });

    const pipe = data?.pipes?.[0];
    if (!pipe) {
      console.log("⚠️ Pipe not found");
      return report;
    }

    console.log("📍 Pipe found:", pipe.id, "name:", pipe.name);

    // Filter to only enabled automations with matching trigger type
    const automations = (pipe.automations || []).filter(
      (automation: any) =>
        automation.enabled && automation.triggerType === params.triggerType
    );

    report.automationsFound = automations.length;
    console.log(`📋 Found ${automations.length} enabled automations`);

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
      console.log(`  ${matches ? "✅" : "❌"} Automation "${automation.name}":`, {
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
    console.log(`🎯 ${matchingAutomations.length} automations match`);

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

      const detail = report.details.find((d: any) => d.id === automation.id);
      if (detail) {
        detail.execution = execResult;
      }
    }

    return report;
  } catch (error) {
    console.error("❌ Error checking/executing automations:", error);
    throw error;
  }
}

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

async function executeAutomation(automation: any, cardId: string) {
  const logId = generateId();
  const actionsExecuted: any[] = [];
  let status = "success";
  let errorMessage: string | undefined;
  let conditionsMet: boolean | undefined;

  console.log(`  🔄 Starting execution: ${automation.name}`);

  try {
    // Check conditions if they exist
    if (automation.conditions && automation.conditions.rules.length > 0) {
      console.log(`  🔍 Evaluating ${automation.conditions.rules.length} conditions...`);
      conditionsMet = await evaluateConditions(automation.conditions, cardId);
      console.log(`  ${conditionsMet ? "✅" : "❌"} Conditions: ${conditionsMet}`);

      if (!conditionsMet) {
        status = "skipped";
        await db.transact([
          db.tx.automation_logs[logId]
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
        return { status, conditionsMet, actionsExecuted, logId };
      }
    }

    console.log(`  🎬 Executing ${automation.actions?.length || 0} actions...`);

    // Execute each action
    for (const action of automation.actions || []) {
      console.log(`    ▶️ Action: ${action.type}`);
      try {
        const result = await executeAction(action, cardId);
        console.log(`    ✅ Action completed`);
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
        throw error;
      }
    }
  } catch (error: any) {
    status = "error";
    errorMessage = error.message;
    console.error(`  ❌ Automation failed:`, error.message);
  }

  // Log the automation execution
  console.log(`  💾 Creating automation log...`);
  try {
    await db.transact([
      db.tx.automation_logs[logId]
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
    console.log(`  ✅ Log created: ${logId}`);
  } catch (logError: any) {
    console.error(`  ❌ Failed to create log:`, logError);
  }

  return { status, conditionsMet, actionsExecuted, errorMessage, logId };
}

async function evaluateConditions(conditions: any, cardId: string): Promise<boolean> {
  const { data } = await db.queryOnce({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
      form_submissions: {
        form: {},
      },
    },
  });

  const card = data?.cards?.[0];
  if (!card) return false;

  const { logic, rules } = conditions;

  const results = rules.map((rule: any) => {
    // Check if this is a form submission field (format: form:FormName.fieldname)
    if (rule.fieldKey.startsWith("form:")) {
      const match = rule.fieldKey.match(/^form:([^.]+)\.(.+)$/);
      if (!match) return false;

      const [, formName, fieldName] = match;

      // Find the form submission
      const submission = card.form_submissions?.find(
        (sub: any) => sub.form?.name?.toLowerCase() === formName.toLowerCase()
      );

      // If no submission exists, treat it as empty field
      if (!submission || !submission.responses) {
        // For "is_empty" operator, no submission means field IS empty
        if (rule.operator === "is_empty") {
          return true;
        }
        // For all other operators, no submission means condition fails
        return false;
      }

      const fieldValue = submission.responses[fieldName];
      return evaluateConditionRule(rule, fieldValue);
    } else {
      // Card field
      const field = card.fields?.find((f: any) => f.key === rule.fieldKey);
      const fieldValue = field?.value;
      return evaluateConditionRule(rule, fieldValue);
    }
  });

  if (logic === "AND") {
    return results.every((r: boolean) => r);
  } else {
    return results.some((r: boolean) => r);
  }
}

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
      return fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== "";
    case "is_empty":
      return !fieldValue || String(fieldValue).trim() === "";
    default:
      return false;
  }
}

async function executeAction(action: any, cardId: string): Promise<any> {
  switch (action.type) {
    case "send_form_link":
      return await executeSendFormLinkAction(action.config, cardId);
    case "send_email":
      return await executeSendEmailAction(action.config, cardId);
    case "move_card":
      return await executeMoveCardAction(action.config, cardId);
    case "update_field":
      return await executeUpdateFieldAction(action.config, cardId);
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

async function executeSendFormLinkAction(
  config: { formId: string; recipientField?: string; templateId?: string },
  cardId: string
): Promise<any> {
  const { data } = await db.queryOnce({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
      stage: { pipe: {}, forms: {} },
    },
  });

  const card = data?.cards?.[0];
  if (!card) throw new Error("Card not found");

  const form = card.stage?.forms?.find((f: any) => f.id === config.formId);
  if (!form) throw new Error("Form not found");

  const formLink = getFormLink(cardId, config.formId);

  let subject = `Form: ${form.name}`;
  let body = `Please complete this form: ${formLink}`;
  let template = null;

  // Get recipient email from card field (if specified)
  let recipientEmail = null;
  if (config.recipientField) {
    const recipientField = card.fields?.find((f: any) => f.key === config.recipientField);
    recipientEmail = recipientField?.value;
  }

  // Load and process email template if specified
  if (config.templateId) {
    const { data: templateData } = await db.queryOnce({
      email_templates: { $: { where: { id: config.templateId } } },
    });

    template = templateData?.email_templates?.[0];
    if (template) {
      const emailData = {
        card: {
          title: card.title,
          description: card.description,
          fields: card.fields,
        },
        form: {
          link: formLink,
          name: form.name,
        },
        stage: {
          name: card.stage?.name,
        },
        pipe: {
          name: card.stage?.pipe?.name,
        },
      };

      subject = processEmailTemplate(template.subject, emailData);
      body = processEmailTemplate(template.body, emailData);

      // Use template's toEmail if no recipient email from card field
      if (!recipientEmail && template.toEmail) {
        recipientEmail = template.toEmail;
      }
    }
  }

  // If still no recipient email, throw error
  if (!recipientEmail) {
    throw new Error(`No recipient email found. Either specify a recipient field in automation config or set "To Email" in the email template.`);
  }

  // Send via API
  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: recipientEmail,
      from: template?.fromEmail || undefined,
      fromName: template?.fromName || undefined,
      cc: template?.cc || undefined,
      bcc: template?.bcc || undefined,
      subject,
      body,
      cardId,
      cardData: card,
      sentVia: "automation",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send email: ${errorText}`);
  }

  return { recipientEmail, subject };
}

async function executeSendEmailAction(
  config: { recipientField?: string; templateId: string },
  cardId: string
): Promise<any> {
  const TAG = "[send_email:client]";
  console.log(`${TAG} === DIAGNOSTIC START ===`);
  console.log(`${TAG} cardId=${cardId}, templateId=${config.templateId}, recipientField=${config.recipientField ?? "(not set)"}`);

  const { data } = await db.queryOnce({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
      stage: { pipe: {} },
    },
    email_templates: { $: { where: { id: config.templateId } } },
  });

  const card = data?.cards?.[0];
  if (!card) {
    console.error(`${TAG} Card NOT found for id=${cardId}`);
    throw new Error("Card not found");
  }
  console.log(`${TAG} card found, title="${card.title}", fields count=${card.fields?.length ?? 0}`);

  const template = data?.email_templates?.[0];
  console.log(`${TAG} template found=${!!template}, templateId=${config.templateId}`);
  if (!template) {
    console.error(`${TAG} Email template NOT found for templateId=${config.templateId}`);
    throw new Error("Email template not found");
  }
  console.log(`${TAG} template name="${template.name}", toEmail=${maskEmail(template.toEmail)}`);

  let recipientEmail: string | null = null;
  let recipientSource = "none";

  if (config.recipientField) {
    const recipientField = card.fields?.find((f: any) => f.key === config.recipientField);
    console.log(`${TAG} recipientField key="${config.recipientField}", field found=${!!recipientField}, value present=${!!recipientField?.value}`);
    recipientEmail = recipientField?.value ?? null;
    if (recipientEmail) recipientSource = `cardField:${config.recipientField}`;
  } else {
    console.log(`${TAG} recipientField not configured in action config`);
  }

  if (!recipientEmail && template.toEmail) {
    recipientEmail = template.toEmail;
    recipientSource = "template.toEmail";
    console.log(`${TAG} falling back to template.toEmail`);
  }

  console.log(`${TAG} recipientResolved=${!!recipientEmail}, source=${recipientSource}, masked=${maskEmail(recipientEmail)}`);

  if (!recipientEmail) {
    console.error(`${TAG} NO recipient email resolved — aborting`);
    throw new Error(`No recipient email found. Either specify a recipient field in automation config or set "To Email" in the email template.`);
  }

  const emailData = {
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

  const subject = processEmailTemplate(template.subject, emailData);
  const body = processEmailTemplate(template.body, emailData);

  console.log(`${TAG} calling /api/send-email, to=${maskEmail(recipientEmail)}, subject="${subject}"`);

  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: recipientEmail,
      from: template.fromEmail || undefined,
      fromName: template.fromName || undefined,
      cc: template.cc || undefined,
      bcc: template.bcc || undefined,
      subject,
      body,
      cardId,
      cardData: card,
      sentVia: "automation",
    }),
  });

  console.log(`${TAG} /api/send-email response status=${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`${TAG} /api/send-email FAILED: status=${response.status}, body=${errorText}`);
    throw new Error(`Failed to send email: ${errorText}`);
  }

  console.log(`${TAG} === DIAGNOSTIC END (success) ===`);
  return { recipientEmail, subject };
}

async function executeMoveCardAction(
  config: { targetStageId: string },
  cardId: string
): Promise<any> {
  // Get card's pipe ID before moving
  const { data } = await db.queryOnce({
    cards: {
      $: { where: { id: cardId } },
      stage: { pipe: {} },
    },
  });

  const card = data?.cards?.[0];
  if (!card) throw new Error("Card not found");

  const pipeId = card.stage?.pipe?.id;
  if (!pipeId) throw new Error("Pipe ID not found");

  // Move the card
  await db.transact([
    db.tx.cards[cardId].update({ updatedAt: Date.now() }).link({ stage: config.targetStageId }),
  ]);

  console.log(`  🔄 Card moved to stage ${config.targetStageId}, checking for follow-up automations...`);

  // Trigger automations for the new stage (without waiting for completion to avoid blocking)
  setTimeout(async () => {
    try {
      await checkAndExecuteAutomations({
        triggerType: "card_enters_stage",
        cardId,
        pipeId,
        context: {
          stageId: config.targetStageId,
        },
      });
    } catch (error) {
      console.error("  ❌ Error triggering follow-up automations:", error);
    }
  }, 100); // Small delay to ensure database is updated

  return { targetStageId: config.targetStageId };
}

async function executeUpdateFieldAction(
  config: { fieldKey: string; value: any },
  cardId: string
): Promise<any> {
  const { data } = await db.queryOnce({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
    },
  });

  const card = data?.cards?.[0];
  if (!card) throw new Error("Card not found");

  const field = card.fields?.find((f: any) => f.key === config.fieldKey);
  if (!field) throw new Error(`Field "${config.fieldKey}" not found`);

  await db.transact([
    db.tx.card_fields[field.id].update({
      value: config.value,
    }),
  ]);

  return { fieldKey: config.fieldKey, value: config.value };
}
