import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const SETTINGS_FILE = "/home/vibecode/workspace/data/kanban-display-settings.json";

/**
 * GET - Retrieve Kanban display settings
 * POST - Save Kanban display settings
 */

export async function GET() {
  try {
    if (!existsSync(SETTINGS_FILE)) {
      return NextResponse.json({ settings: [] });
    }

    const content = await readFile(SETTINGS_FILE, "utf-8");
    const settings = JSON.parse(content);

    return NextResponse.json({ settings });
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

    // Ensure data directory exists
    const dataDir = "/home/vibecode/workspace/data";
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));

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
