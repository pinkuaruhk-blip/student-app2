import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";

/**
 * GET - Retrieve Kanban display settings from database
 * POST - Save Kanban display settings to database
 */

export async function GET() {
  try {
    // Query system settings from database
    const systemSettings = await adminDb.query({
      system_settings: {},
    });

    const settings = systemSettings?.system_settings?.[0];
    const kanbanDisplaySettings = settings?.kanbanDisplaySettings || [];

    return NextResponse.json({ settings: kanbanDisplaySettings });
  } catch (error: any) {
    console.error("Failed to read Kanban display settings:", error);
    return NextResponse.json({ settings: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { settings } = await request.json();

    if (!Array.isArray(settings)) {
      return NextResponse.json(
        { error: "Settings must be an array" },
        { status: 400 }
      );
    }

    // Get existing system settings or create new ID
    const systemSettingsResult = await adminDb.query({
      system_settings: {},
    });

    const existingSettings = systemSettingsResult?.system_settings?.[0];
    const settingsId = existingSettings?.id || id();

    // Save to database
    await adminDb.transact([
      adminDb.tx.system_settings[settingsId].update({
        kanbanDisplaySettings: settings,
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Display settings saved successfully",
      count: settings.length,
    });
  } catch (error: any) {
    console.error("Failed to save Kanban display settings:", error);
    return NextResponse.json(
      { error: "Failed to save display settings", details: error.message },
      { status: 500 }
    );
  }
}
