import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;
const ADMIN_KEY = process.env.INSTANT_ADMIN_KEY!;

if (!APP_ID || !ADMIN_KEY) {
  throw new Error("Missing InstantDB environment variables");
}

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_KEY,
});

const BATCH_SIZE = 200;

export async function POST(req: NextRequest) {
  try {
    const { pipeId } = await req.json();

    if (!pipeId || typeof pipeId !== "string") {
      return NextResponse.json({ error: "Pipe ID is required" }, { status: 400 });
    }

    // Walk down from the SPECIFIC pipe only. This guarantees we never touch
    // cards belonging to any other pipe.
    const result = await db.query({
      pipes: {
        $: { where: { id: pipeId } },
        cards: {
          fields: {},
          comments: {},
          emails: {},
          sms: {},
          history: {},
          form_submissions: {},
          automation_logs: {},
        },
      },
    });

    const pipe = result.pipes[0];
    if (!pipe) {
      return NextResponse.json({ error: "Pipe not found" }, { status: 404 });
    }

    const cards = pipe.cards || [];
    if (cards.length === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 });
    }

    // Build delete ops: children first, then the card itself.
    const ops: any[] = [];
    for (const card of cards as any[]) {
      for (const f of card.fields || []) ops.push(db.tx.card_fields[f.id].delete());
      for (const c of card.comments || []) ops.push(db.tx.card_comments[c.id].delete());
      for (const e of card.emails || []) ops.push(db.tx.card_emails[e.id].delete());
      for (const s of card.sms || []) ops.push(db.tx.card_sms[s.id].delete());
      for (const h of card.history || []) ops.push(db.tx.card_history[h.id].delete());
      for (const fs of card.form_submissions || []) ops.push(db.tx.form_submissions[fs.id].delete());
      for (const al of card.automation_logs || []) ops.push(db.tx.automation_logs[al.id].delete());
      ops.push(db.tx.cards[card.id].delete());
    }

    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      await db.transact(ops.slice(i, i + BATCH_SIZE));
    }

    return NextResponse.json({ success: true, deletedCount: cards.length });
  } catch (error) {
    console.error("Error deleting all cards:", error);
    return NextResponse.json(
      { error: "Failed to delete cards", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
