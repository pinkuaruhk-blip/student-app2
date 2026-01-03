/**
 * Automation Engine
 * Handles trigger detection and action execution for workflow automations
 */

import { db } from "./db";
import { id as generateId } from "@instantdb/react";
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
  try {
    // Query all enabled automations for this pipe with this trigger type
    const data = await db.query({
      automations: {
        $: {
          where: {
            "pipe.id": params.pipeId,
            triggerType: params.triggerType,
            enabled: true,
          },
        },
      },
    });

    const automations = data?.automations || [];

    // Filter automations that match the trigger config
    const matchingAutomations = automations.filter((automation: any) => {
      return matchesTriggerConfig(
        automation.triggerType,
        automation.triggerConfig,
        params.context
      );
    });

    // Execute each matching automation in sequence
    for (const automation of matchingAutomations) {
      await executeAutomation(automation, params.cardId);
    }
  } catch (error) {
    console.error("Error checking/executing automations:", error);
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

  try {
    // Check conditions if they exist
    if (automation.conditions && automation.conditions.rules.length > 0) {
      conditionsMet = await evaluateConditions(automation.conditions, cardId);

      if (!conditionsMet) {
        status = "skipped";
        // Log the automation as skipped - no actions will be executed
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
        return;
      }
    }

    // Execute each action in sequence
    for (const action of automation.actions || []) {
      try {
        const result = await executeAction(action, cardId);
        actionsExecuted.push({
          type: action.type,
          config: action.config,
          status: "success",
          result,
        });
      } catch (error: any) {
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
  }

  // Log the automation execution
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
}

/**
 * Evaluate conditions against card data
 */
async function evaluateConditions(conditions: any, cardId: string): Promise<boolean> {
  // Query card to get all fields
  const data = await db.query({
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
  const data = await db.query({
    cards: {
      $: { where: { id: cardId } },
      stage: {},
    },
  });

  const card = data?.cards?.[0];
  if (!card) throw new Error("Card not found");

  const oldStage = card.stage;

  // Query new stage
  const stageData = await db.query({
    stages: {
      $: { where: { id: config.targetStageId } },
    },
  });

  const newStage = stageData?.stages?.[0];
  if (!newStage) throw new Error("Target stage not found");

  // Create history entry and update card
  const historyId = generateId();
  await db.transact([
    db.tx.cards[cardId]
      .update({ updatedAt: Date.now() })
      .link({ stage: config.targetStageId }),
    db.tx.card_history[historyId]
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
  const data = await db.query({
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
    const templateData = await db.query({
      email_templates: {
        $: { where: { id: config.templateId } },
      },
    });

    const template = templateData?.email_templates?.[0];
    if (template) {
      // Extract sender information from template
      fromEmail = template.fromEmail;
      fromName = template.fromName;
      cc = template.cc;
      bcc = template.bcc;

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
  const response = await fetch("/api/send-email", {
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
    throw new Error(`Failed to send email: ${await response.text()}`);
  }

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
  const data = await db.query({
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
  const templateData = await db.query({
    email_templates: {
      $: { where: { id: config.templateId } },
    },
  });

  const template = templateData?.email_templates?.[0];
  if (!template) throw new Error("Email template not found");

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
  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: recipientEmail,
      from: template.fromEmail,
      fromName: template.fromName,
      cc: template.cc,
      bcc: template.bcc,
      subject,
      body,
      cardId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${await response.text()}`);
  }

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
  const data = await db.query({
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
    await db.transact([
      db.tx.card_fields[existingField.id].update({
        value: config.value,
      }),
    ]);
  } else {
    // Create new field
    const fieldId = generateId();
    await db.transact([
      db.tx.card_fields[fieldId]
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
