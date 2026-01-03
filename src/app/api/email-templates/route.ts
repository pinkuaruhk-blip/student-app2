import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const TEMPLATES_FILE = "/home/vibecode/workspace/data/email-templates.json";

/**
 * GET - Retrieve email templates
 * POST - Save email template
 * DELETE - Delete email template
 */

export async function GET() {
  try {
    if (!existsSync(TEMPLATES_FILE)) {
      return NextResponse.json({ templates: [] });
    }

    const content = await readFile(TEMPLATES_FILE, "utf-8");
    const templates = JSON.parse(content);

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("Failed to read email templates:", error);
    return NextResponse.json({ templates: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { template } = await request.json();

    if (!template || !template.id) {
      return NextResponse.json(
        { error: "Template data is required" },
        { status: 400 }
      );
    }

    // Load existing templates
    let templates: any[] = [];
    if (existsSync(TEMPLATES_FILE)) {
      const content = await readFile(TEMPLATES_FILE, "utf-8");
      templates = JSON.parse(content);
    }

    // Update or add template
    const existingIndex = templates.findIndex((t: any) => t.id === template.id);
    if (existingIndex >= 0) {
      templates[existingIndex] = template;
    } else {
      templates.push(template);
    }

    // Ensure data directory exists
    const dataDir = "/home/vibecode/workspace/data";
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }

    await writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2));

    return NextResponse.json({
      success: true,
      message: "Template saved successfully",
    });
  } catch (error: any) {
    console.error("Failed to save email template:", error);
    return NextResponse.json(
      { error: "Failed to save template", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const templateId = request.nextUrl.searchParams.get("id");

    if (!templateId) {
      return NextResponse.json(
        { error: "Template ID is required" },
        { status: 400 }
      );
    }

    if (!existsSync(TEMPLATES_FILE)) {
      return NextResponse.json({ success: true });
    }

    const content = await readFile(TEMPLATES_FILE, "utf-8");
    let templates = JSON.parse(content);

    templates = templates.filter((t: any) => t.id !== templateId);

    await writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2));

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error: any) {
    console.error("Failed to delete email template:", error);
    return NextResponse.json(
      { error: "Failed to delete template", details: error.message },
      { status: 500 }
    );
  }
}
