// ============================================================
// TEMPORARY DIAGNOSTIC ENDPOINT — REMOVE AFTER INVESTIGATION
// Purpose: Compare working vs broken pipe data to find the
//          root cause of "Error loading board" regression.
// Read-only. Does not modify any InstantDB data.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";

const ALLOWED_EMAIL_STATUSES = new Set([
  "sent",
  "delivered",
  "delayed",
  "bounced",
  "failed",
  "complained",
  "suppressed",
]);

function maskEmail(email: string | undefined | null): string {
  if (!email) return "(empty)";
  const at = email.indexOf("@");
  if (at <= 1) return "***@***";
  return email[0] + "***@" + email.slice(at + 1);
}

export async function GET(request: NextRequest) {
  const pipeId = request.nextUrl.searchParams.get("pipeId");

  if (!pipeId) {
    return NextResponse.json(
      { error: "pipeId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Mirror the exact query shape used by the board page (pipes/[id]/page.tsx lines 263-283)
    const data = await adminDb.query({
      pipes: {
        $: { where: { id: pipeId } },
        email_templates: {},
        stages: {
          forms: {},
          cards: {
            fields: {},
            emails: {},
            form_submissions: {
              form: {},
            },
          },
        },
      },
      system_settings: {},
    });

    const pipe = data?.pipes?.[0];

    if (!pipe) {
      return NextResponse.json({
        pipeId,
        pipeExists: false,
        queryReturnedPipesCount: data?.pipes?.length ?? 0,
        systemSettingsCount: data?.system_settings?.length ?? 0,
        note: "Pipe not found. The board page will show 'Error loading board' because !pipe is true.",
      });
    }

    const stages: any[] = pipe.stages ?? [];
    const emailTemplates: any[] = pipe.email_templates ?? [];
    const systemSettings: any[] = data?.system_settings ?? [];

    // Flatten nested entities
    const allCards: any[] = [];
    const allFields: any[] = [];
    const allEmails: any[] = [];
    const allFormSubmissions: any[] = [];
    const allForms: any[] = [];

    for (const stage of stages) {
      for (const card of stage.cards ?? []) {
        allCards.push({ ...card, _stageId: stage.id, _stageName: stage.name });
        for (const field of card.fields ?? []) {
          allFields.push({ ...field, _cardId: card.id });
        }
        for (const email of card.emails ?? []) {
          allEmails.push({ ...email, _cardId: card.id });
        }
        for (const sub of card.form_submissions ?? []) {
          allFormSubmissions.push({ ...sub, _cardId: card.id });
          if (sub.form) {
            const forms = Array.isArray(sub.form) ? sub.form : [sub.form];
            for (const f of forms) {
              if (f?.id) allForms.push(f);
            }
          }
        }
      }
    }

    // --- Relation warnings ---
    const relationWarnings: string[] = [];

    // Stages without name or with malformed position
    const stageIssues: Array<{ stageId: string; issues: string[] }> = [];
    const stagePositions: number[] = [];
    for (const stage of stages) {
      const issues: string[] = [];
      if (!stage.name) issues.push("missing name");
      if (stage.position === undefined || stage.position === null) {
        issues.push("missing position");
      } else if (typeof stage.position !== "number" || !isFinite(stage.position)) {
        issues.push(`malformed position: ${typeof stage.position} ${String(stage.position).slice(0, 50)}`);
      } else {
        stagePositions.push(stage.position);
      }
      if (issues.length > 0) stageIssues.push({ stageId: stage.id, issues });
    }

    const hasDuplicatePositions = new Set(stagePositions).size !== stagePositions.length;
    if (hasDuplicatePositions) {
      relationWarnings.push(`Duplicate stage positions detected: [${stagePositions.sort().join(", ")}]`);
    }

    // Cards not linked to a stage (shouldn't happen via the nested query but check anyway)
    const cardsWithoutStage = allCards.filter((c) => !c._stageId);
    if (cardsWithoutStage.length > 0) {
      relationWarnings.push(`${cardsWithoutStage.length} card(s) missing stage link`);
    }

    // Cards without title
    const cardsWithoutTitle = allCards.filter((c) => !c.title);
    if (cardsWithoutTitle.length > 0) {
      relationWarnings.push(`${cardsWithoutTitle.length} card(s) missing title`);
    }

    // --- Email checks ---
    const suspiciousEmails: Array<{ emailId: string; issues: string[] }> = [];

    for (const email of allEmails) {
      const issues: string[] = [];

      if (!email.direction) issues.push("missing direction");
      if (!email.from) issues.push("missing from");
      if (!email.to) issues.push("missing to");
      if (!email.subject && email.subject !== "") issues.push("missing subject");
      if (!email.body && email.body !== "") issues.push("missing body");

      if (email.sentAt === undefined || email.sentAt === null) {
        issues.push("missing sentAt");
      } else if (typeof email.sentAt !== "number") {
        issues.push(`sentAt not a number: ${typeof email.sentAt}`);
      }

      if (email.status && !ALLOWED_EMAIL_STATUSES.has(email.status.toLowerCase())) {
        issues.push(`unexpected status: "${email.status}"`);
      }

      if (email.bounceMessage && typeof email.bounceMessage === "string" && email.bounceMessage.length > 500) {
        issues.push(`very large bounceMessage: ${email.bounceMessage.length} chars`);
      }

      if (!email._cardId) issues.push("missing card link");

      if (issues.length > 0) {
        suspiciousEmails.push({ emailId: email.id, issues });
      }
    }

    // --- Form submission checks ---
    const suspiciousFormSubmissions: Array<{ submissionId: string; issues: string[] }> = [];

    for (const sub of allFormSubmissions) {
      const issues: string[] = [];

      if (!sub._cardId) issues.push("missing card link");

      const linkedForms = sub.form
        ? (Array.isArray(sub.form) ? sub.form : [sub.form])
        : [];
      if (linkedForms.length === 0 || !linkedForms[0]?.id) {
        issues.push("missing form link");
      }

      if (sub.responses === undefined || sub.responses === null) {
        issues.push("missing responses");
      } else if (typeof sub.responses !== "object") {
        issues.push(`malformed responses: ${typeof sub.responses}`);
      }

      if (issues.length > 0) {
        suspiciousFormSubmissions.push({ submissionId: sub.id, issues });
      }
    }

    // --- Missing required fields summary ---
    const missingRequiredFields: Record<string, number> = {};
    for (const entry of suspiciousEmails) {
      for (const issue of entry.issues) {
        if (issue.startsWith("missing ")) {
          missingRequiredFields[issue] = (missingRequiredFields[issue] ?? 0) + 1;
        }
      }
    }

    return NextResponse.json({
      pipeId,
      pipeExists: true,
      pipeName: pipe.name ?? "(no name)",

      stageCount: stages.length,
      cardCount: allCards.length,
      fieldCount: allFields.length,
      emailCount: allEmails.length,
      formSubmissionCount: allFormSubmissions.length,
      linkedFormCount: allForms.length,
      emailTemplateCount: emailTemplates.length,
      systemSettingsCount: systemSettings.length,

      stageIssues: stageIssues.length > 0 ? stageIssues : "none",
      stagePositions,

      missingRequiredFields:
        Object.keys(missingRequiredFields).length > 0
          ? missingRequiredFields
          : "none",

      suspiciousEmails:
        suspiciousEmails.length > 0
          ? suspiciousEmails.slice(0, 50)
          : "none",
      suspiciousEmailsTotal: suspiciousEmails.length,

      suspiciousFormSubmissions:
        suspiciousFormSubmissions.length > 0
          ? suspiciousFormSubmissions.slice(0, 50)
          : "none",
      suspiciousFormSubmissionsTotal: suspiciousFormSubmissions.length,

      relationWarnings:
        relationWarnings.length > 0 ? relationWarnings : "none",

      emailSample: allEmails.slice(0, 3).map((e) => ({
        id: e.id,
        direction: e.direction,
        from: maskEmail(e.from),
        to: maskEmail(e.to),
        hasSubject: Boolean(e.subject),
        hasBody: Boolean(e.body),
        sentAt: e.sentAt,
        sentAtType: typeof e.sentAt,
        status: e.status ?? "(none)",
        provider: e.provider ?? "(none)",
        resendId: e.resendId ? "(set)" : "(none)",
        linkedCardId: e._cardId ?? "(none)",
      })),
    });
  } catch (err: any) {
    console.error("[debug-pipe-health] Query failed:", err);
    return NextResponse.json(
      {
        pipeId,
        error: err.message ?? String(err),
        errorType: err.constructor?.name,
        note: "The admin query itself failed. This may indicate a schema mismatch or InstantDB connectivity issue.",
      },
      { status: 500 }
    );
  }
}
