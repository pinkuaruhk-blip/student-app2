import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";

/**
 * GET - Retrieve field definitions from database
 * POST - Save field definitions to database
 */

export async function GET() {
  try {
    // Query all field definitions from database
    const result = await adminDb.query({
      field_definitions: {},
    });

    const fieldDefs = result?.field_definitions || [];

    // Sort by position and return
    const fields = fieldDefs
      .sort((a: any, b: any) => a.position - b.position)
      .map((field: any) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        position: field.position,
      }));

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

    // First, get all existing field definitions to delete them
    const existingResult = await adminDb.query({
      field_definitions: {},
    });

    const existingFields = existingResult?.field_definitions || [];

    // Build transaction: delete all existing, create new ones
    const txs = [];

    // Delete all existing field definitions
    for (const field of existingFields) {
      txs.push(adminDb.tx.field_definitions[field.id].delete());
    }

    // Create new field definitions
    for (const field of fields) {
      const fieldId = id();
      txs.push(
        adminDb.tx.field_definitions[fieldId].update({
          name: field.name,
          label: field.label,
          type: field.type,
          position: field.position,
        })
      );
    }

    // Execute transaction
    await adminDb.transact(txs);

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
