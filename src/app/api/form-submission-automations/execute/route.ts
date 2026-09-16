import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { id as generateId } from "@instantdb/admin";
import { checkAndExecuteAutomations as executeCardEntersStageAutomations } from "@/lib/automation-engine-server";

const VERIFY_ATTEMPTS = 8;
const VERIFY_RETRY_DELAY_MS = 250;
const MAX_SUBMISSION_AGE_MS = 15 * 60 * 1000;
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
const MAX_ID_LENGTH = 128;

const ALLOWED_ACTION_TYPES = new Set(["move_card", "update_field"]);
const DISALLOWED_SKIP_REASON = "action_type_not_allowed_from_public_route";

type JsonRecord = Record<string, unknown>;

type RouteStatus =
  | "success"
  | "skipped"
  | "error"
  | "invalid_request"
  | "submission_not_available"
  | "submission_not_recent";

type AutomationRunResult = {
  automationId: string;
  automationName: string;
  status: "success" | "skipped" | "error";
  alreadyExecuted?: boolean;
  skippedReason?: string;
  conditionsMet?: boolean;
  moveSucceeded?: boolean;
  targetStageId?: string;
  targetStageName?: string;
  errorMessage?: string;
};

type FollowUpResult = {
  status: "completed" | "failed" | "not_run";
  stageId?: string;
  automationsMatched?: number;
  automationsExecuted?: number;
  automationsSkipped?: number;
  automationsFailed?: number;
  error?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function asRecord(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) return asRecord(value[0]);
  if (value && typeof value === "object") return value as JsonRecord;
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    const message = error.message.trim();
    if (message.length > 0 && message.length <= 200) return message;
  }
  return "Unexpected error";
}

function jsonError(status: number, routeStatus: RouteStatus, error: string) {
  return NextResponse.json(
    {
      success: false,
      status: routeStatus,
      error,
    },
    { status }
  );
}

function normalizeFormName(name: string | undefined | null): string {
  if (!name) return "";
  return name.trim().normalize("NFC").toLowerCase();
}

function getLinkedForm(submission: unknown): { id?: string; name?: string } | undefined {
  const record = asRecord(submission);
  if (!record?.form) return undefined;
  const form = asRecord(record.form);
  if (!form) return undefined;
  return form;
}

function asFormRef(raw: unknown): { id: string; name: string } | null {
  const form = asRecord(raw);
  const id = asString(form?.id);
  if (!form || !id) return null;
  return { id, name: typeof form.name === "string" ? form.name : "" };
}

function collectSafeFormIdsByNormalizedName(
  forms: Array<{ id: string; name: string }>
): Map<string, string> {
  const collisions = new Set<string>();
  const map = new Map<string, string>();
  for (const form of forms) {
    const key = normalizeFormName(form.name);
    if (!key) continue;
    const existing = map.get(key);
    if (existing && existing !== form.id) {
      collisions.add(key);
      continue;
    }
    map.set(key, form.id);
  }
  for (const key of collisions) {
    map.delete(key);
  }
  return map;
}

function resolveFormIdForCondition(
  parsedFormName: string,
  contextFormId: string | undefined,
  triggerFormName: string | undefined,
  formIdsByNormalizedName: Map<string, string>
): string | undefined {
  const normalized = normalizeFormName(parsedFormName);
  if (!normalized) return undefined;

  if (contextFormId && normalizeFormName(triggerFormName) === normalized) {
    return contextFormId;
  }

  return formIdsByNormalizedName.get(normalized);
}

function findSubmissionForFormCondition(
  submissions: unknown[] | undefined,
  parsedFormName: string,
  targetFormId?: string
) {
  const list = submissions || [];
  if (targetFormId) {
    const byFormId = list.find((sub) => getLinkedForm(sub)?.id === targetFormId);
    if (byFormId) return asRecord(byFormId);
  }

  const normalized = normalizeFormName(parsedFormName);
  if (!normalized) return undefined;
  return asRecord(
    list.find(
      (sub) => normalizeFormName(getLinkedForm(sub)?.name) === normalized
    )
  );
}

function evaluateConditionRule(rule: JsonRecord, fieldValue: unknown): boolean {
  const operator = asString(rule.operator);
  const expectedValue = rule.value;

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
      return (
        fieldValue !== null &&
        fieldValue !== undefined &&
        String(fieldValue).trim() !== ""
      );
    case "is_empty":
      return !fieldValue || String(fieldValue).trim() === "";
    default:
      return false;
  }
}

function evaluateConditionsOnCard(
  conditions: unknown,
  card: JsonRecord,
  context?: { formId?: string }
): boolean {
  const conditionRecord = asRecord(conditions);
  const rules = asArray(conditionRecord?.rules);
  const logic = asString(conditionRecord?.logic) || "AND";

  const stage = asRecord(card.stage);
  const stageForms = asArray(stage?.forms)
    .map((form) => asFormRef(form))
    .filter((form): form is { id: string; name: string } => Boolean(form));
  const submissions = asArray(card.form_submissions);
  const submissionForms = submissions
    .map((sub) => asFormRef(getLinkedForm(sub)))
    .filter((form): form is { id: string; name: string } => Boolean(form));
  const formIdsByNormalizedName = collectSafeFormIdsByNormalizedName([
    ...stageForms,
    ...submissionForms,
  ]);

  const triggerSubmission = context?.formId
    ? submissions.find((sub) => getLinkedForm(sub)?.id === context.formId)
    : undefined;
  const triggerFormName =
    getLinkedForm(triggerSubmission)?.name ||
    stageForms.find((form) => form.id === context?.formId)?.name;

  const results = rules.map((rawRule) => {
    const rule = asRecord(rawRule);
    if (!rule) return false;
    const fieldKey = asString(rule.fieldKey);
    if (!fieldKey) return false;

    if (fieldKey.startsWith("form:")) {
      const match = fieldKey.match(/^form:([^.]+)\.(.+)$/);
      if (!match) return false;

      const [, formName, fieldName] = match;
      const targetFormId = resolveFormIdForCondition(
        formName,
        context?.formId,
        triggerFormName,
        formIdsByNormalizedName
      );
      const submission = findSubmissionForFormCondition(
        submissions,
        formName,
        targetFormId
      );

      if (!submission || submission.responses == null) {
        return rule.operator === "is_empty";
      }

      const responses = asRecord(submission.responses) || {};
      return evaluateConditionRule(rule, responses[fieldName]);
    }

    const field = asArray(card.fields)
      .map((item) => asRecord(item))
      .find((item) => item && asString(item.key) === fieldKey);
    return evaluateConditionRule(rule, field?.value);
  });

  if (logic === "AND") {
    return results.every(Boolean);
  }
  return results.some(Boolean);
}

function withSubmissionMeta(submissionId: string, actions: JsonRecord[]): JsonRecord[] {
  return [
    {
      type: "execution_meta",
      status: "meta",
      submissionId,
      source: "form_submission_automations_execute",
    },
    ...actions,
  ];
}

function actionsContainSubmissionId(actionsExecuted: unknown, submissionId: string): boolean {
  if (actionsExecuted == null) return false;
  try {
    return JSON.stringify(actionsExecuted).includes(submissionId);
  } catch {
    return false;
  }
}

function logAutomationId(log: JsonRecord): string | undefined {
  const linked = asRecord(log.automation);
  return asString(linked?.id);
}

function isRecentTimestamp(value: unknown, now: number, windowMs: number): boolean {
  const timestamp = asNumber(value);
  if (timestamp == null) return false;
  return Math.abs(now - timestamp) <= windowMs;
}

function alreadyExecutedLog(
  logs: JsonRecord[],
  automationId: string,
  submissionId: string,
  now: number
): boolean {
  return logs.some((log) => {
    if (logAutomationId(log) !== automationId) return false;
    if (actionsContainSubmissionId(log.actionsExecuted, submissionId)) {
      const status = asString(log.status);
      return status === "success" || status === "skipped";
    }
    if (asString(log.triggerType) !== "form_submission") return false;
    if (!isRecentTimestamp(log.executedAt, now, IDEMPOTENCY_WINDOW_MS)) return false;
    const status = asString(log.status);
    return status === "success" || status === "skipped";
  });
}

function sortAutomations(automations: JsonRecord[]): JsonRecord[] {
  return [...automations].sort((a, b) => {
    const positionA = asNumber(a.position) ?? Number.MAX_SAFE_INTEGER;
    const positionB = asNumber(b.position) ?? Number.MAX_SAFE_INTEGER;
    if (positionA !== positionB) return positionA - positionB;
    const createdA = asNumber(a.createdAt) ?? 0;
    const createdB = asNumber(b.createdAt) ?? 0;
    if (createdA !== createdB) return createdA - createdB;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

function parseJsonField(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function mergeSubmissions(existing: unknown, triggerSubmission: JsonRecord): unknown[] {
  const list = asArray(existing);
  const triggerId = asString(triggerSubmission.id);
  if (!triggerId) return list;
  const alreadyPresent = list.some((item) => asString(asRecord(item)?.id) === triggerId);
  return alreadyPresent ? list : [...list, triggerSubmission];
}

async function queryVerificationPayload(cardId: string, formId: string, submissionId: string) {
  return adminDb.query({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
      stage: {
        pipe: { automations: {}, stages: {} },
        forms: {},
      },
      form_submissions: { form: {} },
    },
    form_submissions: {
      $: { where: { id: submissionId } },
      card: {},
      form: {},
    },
    stage_forms: {
      $: { where: { id: formId } },
      stage: {},
    },
  });
}

type VerifiedContext = {
  card: JsonRecord;
  submission: JsonRecord;
  form: JsonRecord;
  pipeId: string;
  expectedSourceStageId?: string;
  pipeStages: JsonRecord[];
  automations: JsonRecord[];
};

async function loadVerifiedContext(
  cardId: string,
  formId: string,
  submissionId: string
): Promise<VerifiedContext | null> {
  const data = await queryVerificationPayload(cardId, formId, submissionId);
  const card = asRecord(asArray(data?.cards)[0]);
  if (!card || asString(card.id) !== cardId) return null;

  const queriedSubmission = asRecord(asArray(data?.form_submissions)[0]);
  const nestedSubmission = asArray(card.form_submissions)
    .map((item) => asRecord(item))
    .find((item) => item && asString(item.id) === submissionId);
  const submission = queriedSubmission || nestedSubmission;
  if (!submission || asString(submission.id) !== submissionId) return null;

  const linkedCard = asRecord(submission.card);
  const linkedCardId = asString(linkedCard?.id);
  if (linkedCardId && linkedCardId !== cardId) return null;
  if (!linkedCardId && !nestedSubmission) return null;

  const linkedForm = asRecord(submission.form);
  const linkedFormId = asString(linkedForm?.id);
  if (linkedFormId && linkedFormId !== formId) return null;
  if (!linkedFormId && nestedSubmission) {
    const nestedFormId = asString(getLinkedForm(nestedSubmission)?.id);
    if (nestedFormId !== formId) return null;
  }
  if (!linkedFormId && !nestedSubmission) return null;

  const form = asRecord(asArray(data?.stage_forms)[0]) || linkedForm;
  if (!form || asString(form.id) !== formId) return null;

  const stage = asRecord(card.stage);
  const pipe = asRecord(stage?.pipe);
  const pipeId = asString(pipe?.id);
  if (!pipeId) return null;

  const formStage = asRecord(form.stage);
  const expectedSourceStageId = asString(formStage?.id) || asString(stage?.id);

  card.form_submissions = mergeSubmissions(card.form_submissions, submission);

  return {
    card,
    submission,
    form,
    pipeId,
    expectedSourceStageId,
    pipeStages: asArray(pipe?.stages)
      .map((item) => asRecord(item))
      .filter((item): item is JsonRecord => Boolean(item)),
    automations: asArray(pipe?.automations)
      .map((item) => asRecord(item))
      .filter((item): item is JsonRecord => Boolean(item)),
  };
}

async function loadCardForEvaluation(
  cardId: string,
  triggerSubmission: JsonRecord
): Promise<JsonRecord | null> {
  const data = await adminDb.query({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
      stage: {
        forms: {},
        pipe: { stages: {} },
      },
      form_submissions: { form: {} },
    },
  });
  const card = asRecord(asArray(data?.cards)[0]);
  if (!card) return null;
  card.form_submissions = mergeSubmissions(card.form_submissions, triggerSubmission);
  return card;
}

async function loadCardLogs(cardId: string): Promise<JsonRecord[]> {
  const data = await adminDb.query({
    cards: {
      $: { where: { id: cardId } },
      automation_logs: { automation: {} },
    },
  });
  const card = asRecord(asArray(data?.cards)[0]);
  return asArray(card?.automation_logs)
    .map((item) => asRecord(item))
    .filter((item): item is JsonRecord => Boolean(item));
}

async function writeAutomationLog(params: {
  cardId: string;
  automationId: string;
  triggerType: string;
  status: "success" | "skipped" | "error";
  conditionsMet?: boolean;
  actionsExecuted: JsonRecord[];
  errorMessage?: string;
  submissionId: string;
}) {
  const logId = generateId();
  await adminDb.transact([
    adminDb.tx.automation_logs[logId]
      .update({
        executedAt: Date.now(),
        status: params.status,
        triggerType: params.triggerType,
        conditionsMet: params.conditionsMet,
        actionsExecuted: withSubmissionMeta(params.submissionId, params.actionsExecuted),
        errorMessage: params.errorMessage,
      })
      .link({ card: params.cardId, automation: params.automationId }),
  ]);
  return logId;
}

function findStage(
  stages: JsonRecord[],
  stageId: string
): JsonRecord | null {
  return stages.find((stage) => asString(stage.id) === stageId) || null;
}

async function queryStage(stageId: string): Promise<JsonRecord | null> {
  const data = await adminDb.query({
    stages: {
      $: { where: { id: stageId } },
    },
  });
  return asRecord(asArray(data?.stages)[0]);
}

async function executeMoveCard(params: {
  cardId: string;
  targetStageId: string;
  expectedSourceStageId?: string;
  pipeStages: JsonRecord[];
}): Promise<{
  status: "success" | "skipped";
  reason?: "card_already_in_target_stage" | "card_stage_changed_externally";
  fromStageId?: string;
  fromStageName?: string;
  toStageId: string;
  toStageName?: string;
}> {
  const data = await adminDb.query({
    cards: {
      $: { where: { id: params.cardId } },
      stage: {},
    },
  });
  const card = asRecord(asArray(data?.cards)[0]);
  if (!card) throw new Error("Card not found");

  const currentStage = asRecord(card.stage);
  const currentStageId = asString(currentStage?.id);
  const currentStageName = asString(currentStage?.name);
  const targetStage =
    findStage(params.pipeStages, params.targetStageId) ||
    (await queryStage(params.targetStageId));
  if (!targetStage) throw new Error("Target stage not found");
  const targetStageName = asString(targetStage.name);

  if (currentStageId && currentStageId === params.targetStageId) {
    return {
      status: "skipped",
      reason: "card_already_in_target_stage",
      fromStageId: currentStageId,
      fromStageName: currentStageName,
      toStageId: params.targetStageId,
      toStageName: targetStageName,
    };
  }

  if (
    currentStageId &&
    params.expectedSourceStageId &&
    currentStageId !== params.expectedSourceStageId
  ) {
    return {
      status: "skipped",
      reason: "card_stage_changed_externally",
      fromStageId: currentStageId,
      fromStageName: currentStageName,
      toStageId: params.targetStageId,
      toStageName: targetStageName,
    };
  }

  const historyId = generateId();
  await adminDb.transact([
    adminDb.tx.cards[params.cardId]
      .update({ updatedAt: Date.now() })
      .link({ stage: params.targetStageId }),
    adminDb.tx.card_history[historyId]
      .update({
        movedAt: Date.now(),
        fromStageId: currentStageId || null,
        toStageId: params.targetStageId,
        fromStageName: currentStageName || null,
        toStageName: targetStageName,
      })
      .link({ card: params.cardId }),
  ]);

  return {
    status: "success",
    fromStageId: currentStageId,
    fromStageName: currentStageName,
    toStageId: params.targetStageId,
    toStageName: targetStageName,
  };
}

async function executeUpdateField(params: {
  cardId: string;
  fieldKey: string;
  value: unknown;
}): Promise<{ fieldKey: string }> {
  const data = await adminDb.query({
    cards: {
      $: { where: { id: params.cardId } },
      fields: {},
    },
  });
  const card = asRecord(asArray(data?.cards)[0]);
  if (!card) throw new Error("Card not found");

  const field = asArray(card.fields)
    .map((item) => asRecord(item))
    .find((item) => item && asString(item.key) === params.fieldKey);
  const fieldId = asString(field?.id);
  if (!field || !fieldId) throw new Error(`Field "${params.fieldKey}" not found`);

  await adminDb.transact([
    adminDb.tx.card_fields[fieldId].update({
      value: params.value,
    }),
  ]);

  return { fieldKey: params.fieldKey };
}

async function triggerCardEntersStageFollowUp(params: {
  cardId: string;
  pipeId: string;
  stageId: string;
}): Promise<FollowUpResult> {
  try {
    console.log("[form-submission-automations] card_enters_stage follow-up", {
      cardId: params.cardId,
      pipeId: params.pipeId,
      stageId: params.stageId,
    });
    const report = await executeCardEntersStageAutomations({
      triggerType: "card_enters_stage",
      cardId: params.cardId,
      pipeId: params.pipeId,
      context: { stageId: params.stageId },
    });
    return {
      status: "completed",
      stageId: params.stageId,
      automationsMatched: report.automationsMatched,
      automationsExecuted: report.automationsExecuted.length,
      automationsSkipped: report.automationsSkipped.length,
      automationsFailed: report.automationsFailed.length,
    };
  } catch (error) {
    console.error("[form-submission-automations] follow-up failed", {
      cardId: params.cardId,
      pipeId: params.pipeId,
      stageId: params.stageId,
      errorMessage: safeErrorMessage(error),
    });
    return {
      status: "failed",
      stageId: params.stageId,
      error: safeErrorMessage(error),
    };
  }
}

async function executeMatchedAutomation(params: {
  automation: JsonRecord;
  cardId: string;
  formId: string;
  submissionId: string;
  triggerSubmission: JsonRecord;
  expectedSourceStageId?: string;
  pipeStages: JsonRecord[];
}): Promise<AutomationRunResult> {
  const automationId = asString(params.automation.id) || "";
  const automationName = asString(params.automation.name) || "Untitled automation";
  const triggerType = asString(params.automation.triggerType) || "form_submission";
  const actionsExecuted: JsonRecord[] = [];
  let status: "success" | "skipped" | "error" = "success";
  let errorMessage: string | undefined;
  let conditionsMet: boolean | undefined;
  let skippedReason: string | undefined;
  let moveSucceeded = false;
  let targetStageId: string | undefined;
  let targetStageName: string | undefined;

  try {
    const conditions = parseJsonField(params.automation.conditions);
    const conditionRules = asArray(asRecord(conditions)?.rules);
    if (conditionRules.length > 0) {
      const card = await loadCardForEvaluation(params.cardId, params.triggerSubmission);
      if (!card) throw new Error("Card not found");
      conditionsMet = evaluateConditionsOnCard(conditions, card, {
        formId: params.formId,
      });
      if (!conditionsMet) {
        status = "skipped";
        skippedReason = "conditions_not_met";
        errorMessage = "Conditions not met";
        await writeAutomationLog({
          cardId: params.cardId,
          automationId,
          triggerType,
          status,
          conditionsMet,
          actionsExecuted,
          errorMessage,
          submissionId: params.submissionId,
        });
        return {
          automationId,
          automationName,
          status,
          skippedReason,
          conditionsMet,
          errorMessage,
        };
      }
    }

    const actions = asArray(parseJsonField(params.automation.actions));
    if (actions.length === 0) {
      await writeAutomationLog({
        cardId: params.cardId,
        automationId,
        triggerType,
        status: "success",
        conditionsMet,
        actionsExecuted,
        submissionId: params.submissionId,
      });
      return {
        automationId,
        automationName,
        status: "success",
        conditionsMet,
      };
    }

    for (const rawAction of actions) {
      const action = asRecord(rawAction);
      const actionType = asString(action?.type);
      const config = asRecord(action?.config) || {};

      if (!action || !actionType) {
        actionsExecuted.push({
          type: "unknown",
          status: "skipped",
          reason: DISALLOWED_SKIP_REASON,
        });
        continue;
      }

      if (!ALLOWED_ACTION_TYPES.has(actionType)) {
        actionsExecuted.push({
          type: actionType,
          status: "skipped",
          reason: DISALLOWED_SKIP_REASON,
        });
        continue;
      }

      try {
        if (actionType === "move_card") {
          const moveTargetStageId = asString(config.targetStageId);
          if (!moveTargetStageId) throw new Error("Missing targetStageId");
          targetStageId = moveTargetStageId;
          const moveResult = await executeMoveCard({
            cardId: params.cardId,
            targetStageId: moveTargetStageId,
            expectedSourceStageId: params.expectedSourceStageId,
            pipeStages: params.pipeStages,
          });
          targetStageName = moveResult.toStageName;
          if (moveResult.status === "skipped") {
            skippedReason = moveResult.reason;
            status = "skipped";
            errorMessage = moveResult.reason;
            actionsExecuted.push({
              type: "move_card",
              status: "skipped",
              reason: moveResult.reason,
              config: { targetStageId: moveTargetStageId },
              result: {
                fromStageId: moveResult.fromStageId,
                toStageId: moveResult.toStageId,
                fromStageName: moveResult.fromStageName,
                toStageName: moveResult.toStageName,
              },
            });
            continue;
          }
          moveSucceeded = true;
          actionsExecuted.push({
            type: "move_card",
            status: "success",
            config: { targetStageId: moveTargetStageId },
            result: {
              fromStageId: moveResult.fromStageId,
              toStageId: moveResult.toStageId,
              fromStageName: moveResult.fromStageName,
              toStageName: moveResult.toStageName,
            },
          });
          continue;
        }

        if (actionType === "update_field") {
          const fieldKey = asString(config.fieldKey);
          if (!fieldKey) throw new Error("Missing fieldKey");
          const result = await executeUpdateField({
            cardId: params.cardId,
            fieldKey,
            value: config.value,
          });
          actionsExecuted.push({
            type: "update_field",
            status: "success",
            config: { fieldKey },
            result,
          });
        }
      } catch (actionError) {
        const actionErrorMessage = safeErrorMessage(actionError);
        actionsExecuted.push({
          type: actionType,
          status: "error",
          error: actionErrorMessage,
          config: actionType === "move_card" ? { targetStageId: asString(config.targetStageId) } : { fieldKey: asString(config.fieldKey) },
        });
        throw actionError;
      }
    }

    const executedAllowed = actionsExecuted.some(
      (item) =>
        ALLOWED_ACTION_TYPES.has(String(item.type)) && item.status === "success"
    );
    const skippedNotAllowed = actionsExecuted.some(
      (item) => item.reason === DISALLOWED_SKIP_REASON
    );
    if (!executedAllowed && skippedNotAllowed && status === "success") {
      status = "skipped";
      skippedReason = DISALLOWED_SKIP_REASON;
      errorMessage = DISALLOWED_SKIP_REASON;
    }
  } catch (error) {
    status = "error";
    errorMessage = safeErrorMessage(error);
    console.error("[form-submission-automations] automation failed", {
      cardId: params.cardId,
      formId: params.formId,
      submissionId: params.submissionId,
      automationId,
      automationName,
      errorMessage,
    });
  }

  try {
    await writeAutomationLog({
      cardId: params.cardId,
      automationId,
      triggerType,
      status,
      conditionsMet,
      actionsExecuted,
      errorMessage,
      submissionId: params.submissionId,
    });
  } catch (logError) {
    console.error("[form-submission-automations] failed to write automation log", {
      cardId: params.cardId,
      formId: params.formId,
      submissionId: params.submissionId,
      automationId,
      errorMessage: safeErrorMessage(logError),
    });
  }

  return {
    automationId,
    automationName,
    status,
    skippedReason,
    conditionsMet,
    moveSucceeded,
    targetStageId,
    targetStageName,
    errorMessage,
  };
}

export async function POST(request: NextRequest) {
  let cardId: string | undefined;
  let formId: string | undefined;
  let submissionId: string | undefined;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "invalid_request", "Invalid request");
    }

    const record = asRecord(body);
    cardId = asString(record?.cardId);
    formId = asString(record?.formId);
    submissionId = asString(record?.submissionId);

    if (!isId(cardId) || !isId(formId) || !isId(submissionId)) {
      return jsonError(400, "invalid_request", "Invalid request");
    }

    console.log("[form-submission-automations] execute start", {
      cardId,
      formId,
      submissionId,
    });

    let verified: VerifiedContext | null = null;
    for (let attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++) {
      verified = await loadVerifiedContext(cardId, formId, submissionId);
      if (verified) break;
      if (attempt < VERIFY_ATTEMPTS) {
        await sleep(VERIFY_RETRY_DELAY_MS);
      }
    }

    if (!verified) {
      console.error("[form-submission-automations] submission not available", {
        cardId,
        formId,
        submissionId,
      });
      return jsonError(200, "submission_not_available", "Submission not available");
    }

    const submittedAt = asNumber(verified.submission.submittedAt);
    if (
      submittedAt == null ||
      !isRecentTimestamp(submittedAt, Date.now(), MAX_SUBMISSION_AGE_MS)
    ) {
      console.log("[form-submission-automations] submission not recent", {
        cardId,
        formId,
        submissionId,
      });
      return NextResponse.json({
        success: false,
        status: "submission_not_recent",
        skipped: true,
        cardId,
        formId,
        submissionId,
      });
    }

    const pipeData = await adminDb.query({
      pipes: {
        $: { where: { id: verified.pipeId } },
        automations: {},
        stages: {},
      },
    });
    const pipeRecord = asRecord(asArray(pipeData?.pipes)[0]);
    const pipeAutomations = asArray(pipeRecord?.automations)
      .map((item) => asRecord(item))
      .filter((item): item is JsonRecord => Boolean(item));
    const pipeStages = asArray(pipeRecord?.stages)
      .map((item) => asRecord(item))
      .filter((item): item is JsonRecord => Boolean(item));
    if (pipeAutomations.length > 0) {
      verified.automations = pipeAutomations;
    }
    if (pipeStages.length > 0) {
      verified.pipeStages = pipeStages;
    }

    const matchedAutomations = sortAutomations(
      verified.automations.filter((automation) => {
        if (automation.enabled !== true) return false;
        if (asString(automation.triggerType) !== "form_submission") return false;
        const triggerConfig = asRecord(parseJsonField(automation.triggerConfig));
        return asString(triggerConfig?.formId) === formId;
      })
    );

    const results: AutomationRunResult[] = [];
    const followUps: FollowUpResult[] = [];
    let conditionMatchCount = 0;

    for (const automation of matchedAutomations) {
      const automationId = asString(automation.id);
      if (!automationId) continue;

      const logs = await loadCardLogs(cardId);
      if (alreadyExecutedLog(logs, automationId, submissionId, Date.now())) {
        results.push({
          automationId,
          automationName: asString(automation.name) || "Untitled automation",
          status: "skipped",
          alreadyExecuted: true,
          skippedReason: "already_executed",
        });
        continue;
      }

      const result = await executeMatchedAutomation({
        automation,
        cardId,
        formId,
        submissionId,
        triggerSubmission: verified.submission,
        expectedSourceStageId: verified.expectedSourceStageId,
        pipeStages: verified.pipeStages,
      });
      results.push(result);

      if (result.conditionsMet !== false && result.skippedReason !== "already_executed") {
        if (result.conditionsMet === true || result.conditionsMet === undefined) {
          conditionMatchCount += 1;
        }
      }

      if (result.moveSucceeded && result.targetStageId) {
        const followUp = await triggerCardEntersStageFollowUp({
          cardId,
          pipeId: verified.pipeId,
          stageId: result.targetStageId,
        });
        followUps.push(followUp);
      }
    }

    if (conditionMatchCount > 1) {
      console.warn("[form-submission-automations] multiple automations matched conditions", {
        cardId,
        formId,
        submissionId,
        conditionMatchCount,
        automations: results
          .filter((item) => item.conditionsMet !== false)
          .map((item) => ({
            id: item.automationId,
            name: item.automationName,
            status: item.status,
          })),
      });
    }

    const matchedCount = matchedAutomations.length;
    const succeededCount = results.filter((item) => item.status === "success").length;
    const skippedCount = results.filter((item) => item.status === "skipped").length;
    const failedCount = results.filter((item) => item.status === "error").length;
    const alreadyExecutedCount = results.filter((item) => item.alreadyExecuted).length;

    console.log("[form-submission-automations] execute complete", {
      cardId,
      formId,
      submissionId,
      matchedCount,
      succeededCount,
      skippedCount,
      failedCount,
      alreadyExecutedCount,
      followUpCount: followUps.length,
    });

    return NextResponse.json({
      success: failedCount === 0,
      status: failedCount > 0 ? "error" : "success",
      cardId,
      formId,
      submissionId,
      matchedCount,
      succeededCount,
      skippedCount,
      failedCount,
      alreadyExecutedCount,
      automations: results.map((item) => ({
        id: item.automationId,
        name: item.automationName,
        status: item.status,
        alreadyExecuted: item.alreadyExecuted === true,
        skippedReason: item.skippedReason,
        conditionsMet: item.conditionsMet,
        targetStageId: item.targetStageId,
        targetStageName: item.targetStageName,
        errorMessage: item.errorMessage,
      })),
      followUp: followUps.length > 0 ? followUps : [{ status: "not_run" }],
    });
  } catch (error) {
    console.error("[form-submission-automations] unhandled error", {
      cardId,
      formId,
      submissionId,
      errorMessage: safeErrorMessage(error),
    });
    return jsonError(500, "error", "Failed to execute automations");
  }
}
