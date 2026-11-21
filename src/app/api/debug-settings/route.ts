import { NextRequest, NextResponse } from "next/server";
import { devOnly } from "@/lib/staff-auth";
import { adminDb } from "@/lib/db-admin";

export async function GET(request: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    console.log("🔍 Querying system_settings from admin DB...");

    const data = await adminDb.query({
      system_settings: {},
    });

    console.log("📊 Query result:", JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: true,
      settings: data?.system_settings || [],
      count: data?.system_settings?.length || 0,
      raw: data,
    });
  } catch (error: any) {
    console.error("❌ Error querying settings:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const blocked = devOnly();
  if (blocked) return blocked;

  try {
    const { defaultFromEmail, defaultFromName } = await request.json();

    console.log("💾 Saving settings via admin API:", { defaultFromEmail, defaultFromName });

    const { id } = await import("@instantdb/admin");
    const settingsId = id();

    await adminDb.transact([
      adminDb.tx.system_settings[settingsId].update({
        defaultFromEmail: defaultFromEmail || undefined,
        defaultFromName: defaultFromName || undefined,
      }),
    ]);

    console.log("✅ Settings saved with ID:", settingsId);

    return NextResponse.json({
      success: true,
      settingsId,
      message: "Settings saved successfully",
    });
  } catch (error: any) {
    console.error("❌ Error saving settings:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
