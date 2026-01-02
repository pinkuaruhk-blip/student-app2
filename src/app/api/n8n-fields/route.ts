import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const FIELDS_FILE = "/home/vibecode/workspace/data/n8n-field-definitions.json";

/**
 * GET - Retrieve field definitions
 * POST - Save field definitions
 */

export async function GET() {
  try {
    if (!existsSync(FIELDS_FILE)) {
      return NextResponse.json({ fields: [] });
    }

    const content = await readFile(FIELDS_FILE, "utf-8");
    const fields = JSON.parse(content);

    return NextResponse.json({ fields });
  } catch (error: any) {
    console.error("Failed to read field definitions:", error);
    return NextResponse.json({ fields: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { fields } = await request.json();

    if (!Array.isArray(fields)) {
      return NextResponse.json(
        { error: "Fields must be an array" },
        { status: 400 }
      );
    }

    // Ensure data directory exists
    const dataDir = "/home/vibecode/workspace/data";
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    await writeFile(FIELDS_FILE, JSON.stringify(fields, null, 2));

    return NextResponse.json({
      success: true,
      message: "Field definitions saved successfully",
      count: fields.length,
    });
  } catch (error: any) {
    console.error("Failed to save field definitions:", error);
    return NextResponse.json(
      { error: "Failed to save field definitions", details: error.message },
      { status: 500 }
    );
  }
}
