import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "f0827431-76de-4f51-a2c3-bae2e1558bcc";
const ADMIN_KEY = process.env.INSTANT_ADMIN_KEY;

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_KEY,
});

/**
 * Delete duplicate cards - keeps only the oldest card
 * Visit: http://localhost:3000/api/cleanup?confirm=yes
 */
export async function GET(request: NextRequest) {
  try {
    const confirm = request.nextUrl.searchParams.get("confirm");

    if (confirm !== "yes") {
      return NextResponse.json({
        message: "Add ?confirm=yes to delete duplicate cards",
        warning: "This will keep only the OLDEST card and delete the rest",
      });
    }

    // Query all cards
    const result = await db.query({
      cards: {},
    });

    const cards = result.cards || [];

    if (cards.length <= 1) {
      return NextResponse.json({
        message: "No duplicates to clean up",
        totalCards: cards.length,
      });
    }

    // Sort by createdAt and keep the oldest one
    const sortedCards = cards.sort((a: any, b: any) => a.createdAt - b.createdAt);
    const keepCard = sortedCards[0];
    const deleteCards = sortedCards.slice(1);

    // Delete duplicates
    const txs = deleteCards.map((card: any) => db.tx.cards[card.id].delete());
    await db.transact(txs);

    return NextResponse.json({
      success: true,
      kept: {
        id: keepCard.id,
        title: keepCard.title,
        createdAt: new Date(keepCard.createdAt).toISOString(),
      },
      deleted: deleteCards.length,
      deletedIds: deleteCards.map((c: any) => c.id),
    });
  } catch (error: any) {
    return NextResponse.json({
      error: "Failed to cleanup",
      details: error.message,
    }, { status: 500 });
  }
}
