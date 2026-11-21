// Public form API. Signed-out recipients load and submit a stage form here,
// because Instant permission rules no longer let a browser read or write data
// without a staff sign-in.

import { NextRequest, NextResponse } from "next/server";
import { id as generateId } from "@instantdb/admin";
import { adminDb } from "@/lib/db-admin";
import { loadPublicFormContext, toPublicFormPayload } from "@/lib/public-form";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_000_000;
const MAX_EMAIL_LENGTH = 320;
const NO_STORE = { "Cache-Control": "no-store" };

type RouteContext = { params: Promise<{ cardId: string; formId: string }> };

function notFound() {
  return NextResponse.json({ error: "Form or card not found" }, { status: 404, headers: NO_STORE });
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { cardId, formId } = await params;
  try {
    const ctx = await loadPublicFormContext(cardId, formId);
    if (!ctx) return notFound();
    return NextResponse.json(toPublicFormPayload(ctx), { headers: NO_STORE });
  } catch (error) {
    console.error("[public-form] GET failed", { cardId, formId, error: String(error) });
    return NextResponse.json({ error: "Could not load the form" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { cardId, formId } = await params;

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Submission is too large" }, { status: 413, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }

  const { responses, submitterEmail } = (body ?? {}) as Record<string, unknown>;
  if (!responses || typeof responses !== "object" || Array.isArray(responses)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }
  if (
    submitterEmail !== undefined &&
    submitterEmail !== null &&
    (typeof submitterEmail !== "string" || submitterEmail.length > MAX_EMAIL_LENGTH)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: NO_STORE });
  }

  try {
    const ctx = await loadPublicFormContext(cardId, formId);
    if (!ctx) return notFound();

    if (ctx.existingSubmission) {
      return NextResponse.json(
        { error: "This form has already been submitted" },
        { status: 409, headers: NO_STORE }
      );
    }

    // Keep only answers to fields on this form.
    const allowed = new Set(
      ctx.form.fields.filter((field) => field.type !== "content").map((field) => field.name)
    );
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(responses as Record<string, unknown>)) {
      if (allowed.has(key)) cleaned[key] = value;
    }

    const submissionId = generateId();
    await adminDb.transact([
      adminDb.tx.form_submissions[submissionId]
        .update({
          responses: cleaned,
          submittedAt: Date.now(),
          submitterEmail: submitterEmail ? String(submitterEmail) : undefined,
        })
        .link({ card: cardId, form: formId }),
    ]);

    return NextResponse.json({ submissionId }, { headers: NO_STORE });
  } catch (error) {
    console.error("[public-form] POST failed", { cardId, formId, error: String(error) });
    return NextResponse.json({ error: "Could not save the submission" }, { status: 500, headers: NO_STORE });
  }
}
