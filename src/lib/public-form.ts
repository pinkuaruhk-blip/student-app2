// Server-only loader for the public form page (/form/[cardId]/[formId]).
// Uses the admin SDK, so it bypasses Instant permission rules. It must only
// return what a form recipient is meant to see.

import { adminDb } from "@/lib/db-admin";
import { replacePlaceholders } from "@/lib/placeholders";

const MAX_ID_LENGTH = 128;

// Kept for the browser so it renders in the recipient's own locale and time zone.
const DATE_TOKENS: Array<[RegExp, string]> = [
  [/\{\{current_date\}\}/g, "\u0000CURRENT_DATE\u0000"],
  [/\{\{current_datetime\}\}/g, "\u0000CURRENT_DATETIME\u0000"],
];

type Json = Record<string, any>;

export type PublicFormField = Json & {
  name: string;
  type: string;
  label: string;
  content?: string;
  prefillFromField?: { formId: string; fieldName: string };
};

export type PublicFormContext = {
  card: Json;
  form: Json & { fields: PublicFormField[] };
  existingSubmission: Json | undefined;
  globalVariables: Array<{ name: string; value: string }>;
};

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

// Loads the card and form, and returns null unless this is a client form in
// the same pipe as the card. Every failure looks the same to the caller.
export async function loadPublicFormContext(
  cardId: unknown,
  formId: unknown
): Promise<PublicFormContext | null> {
  if (!isId(cardId) || !isId(formId)) return null;

  const data = await adminDb.query({
    cards: {
      $: { where: { id: cardId } },
      fields: {},
      stage: { pipe: {} },
      form_submissions: { form: {} },
    },
    stage_forms: {
      $: { where: { id: formId } },
      stage: { pipe: {} },
    },
    system_settings: {},
  });

  const card = data.cards?.[0] as Json | undefined;
  const form = data.stage_forms?.[0] as Json | undefined;
  if (!card || !form) return null;
  if (form.formType === "admin") return null;
  if (!Array.isArray(form.fields)) return null;

  const cardPipeId = card.stage?.pipe?.id;
  const formPipeId = form.stage?.pipe?.id;
  if (!cardPipeId || cardPipeId !== formPipeId) return null;

  const submissions: Json[] = Array.isArray(card.form_submissions) ? card.form_submissions : [];
  const existingSubmission = submissions.find((sub) => sub.form?.id === formId);
  const globalVariables = (data.system_settings?.[0] as Json | undefined)?.globalVariables;

  return {
    card,
    form: form as PublicFormContext["form"],
    existingSubmission,
    globalVariables: Array.isArray(globalVariables) ? globalVariables : [],
  };
}

function renderText(text: string, ctx: PublicFormContext): string {
  let protectedText = text;
  for (const [pattern, token] of DATE_TOKENS) protectedText = protectedText.replace(pattern, token);

  const rendered = replacePlaceholders(protectedText, {
    card: {
      title: ctx.card.title,
      description: ctx.card.description,
      fields: ctx.card.fields || [],
    },
    stage: { name: ctx.card.stage?.name },
    pipe: { name: ctx.card.stage?.pipe?.name },
    form: { name: ctx.form.name },
    formSubmissions: ctx.card.form_submissions || [],
    globalVariables: ctx.globalVariables,
  });

  return rendered
    .replace(/\u0000CURRENT_DATE\u0000/g, "{{current_date}}")
    .replace(/\u0000CURRENT_DATETIME\u0000/g, "{{current_datetime}}");
}

// The only data the public page receives. Content fields arrive with their
// placeholders already filled in, so the card itself never leaves the server.
export function toPublicFormPayload(ctx: PublicFormContext) {
  const submissions: Json[] = ctx.card.form_submissions || [];
  const prefill: Record<string, unknown> = {};

  const fields = ctx.form.fields.map((field) => {
    if (field.prefillFromField) {
      const { formId, fieldName } = field.prefillFromField;
      const source = submissions.find((sub) => sub.form?.id === formId);
      const value = source?.responses?.[fieldName];
      if (value) prefill[field.name] = value;
    }
    if (field.type !== "content") return field;
    return {
      ...field,
      label: renderText(field.label || "", ctx),
      content: renderText(field.content || "", ctx),
    };
  });

  return {
    cardTitle: ctx.card.title ?? "",
    form: { id: ctx.form.id, name: ctx.form.name, fields },
    prefill,
    alreadySubmitted: Boolean(ctx.existingSubmission),
  };
}
