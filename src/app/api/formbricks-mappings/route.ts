import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const MAPPINGS_FILE = "/home/vibecode/workspace/data/formbricks-field-mappings.json";

/**
 * GET - Retrieve field mappings
 * POST - Save field mappings
 */

export async function GET() {
  try {
    if (!existsSync(MAPPINGS_FILE)) {
      return NextResponse.json({ mappings: [] });
    }

    const content = await readFile(MAPPINGS_FILE, "utf-8");
    const mappings = JSON.parse(content);

    return NextResponse.json({ mappings });
  } catch (error: any) {
    console.error("Failed to read mappings:", error);
    return NextResponse.json({ mappings: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { mappings } = await request.json();

    if (!Array.isArray(mappings)) {
      return NextResponse.json(
        { error: "Mappings must be an array" },
        { status: 400 }
      );
    }

    // Ensure data directory exists
    const dataDir = "/home/vibecode/workspace/data";
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    await writeFile(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));

    return NextResponse.json({
      success: true,
      message: "Mappings saved successfully",
      count: mappings.length,
    });
  } catch (error: any) {
    console.error("Failed to save mappings:", error);
    return NextResponse.json(
      { error: "Failed to save mappings", details: error.message },
      { status: 500 }
    );
  }
}
