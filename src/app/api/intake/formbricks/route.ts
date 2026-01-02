import { NextRequest, NextResponse } from "next/server";
import { init, id } from "@instantdb/admin";

// Initialize InstantDB Admin SDK
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "f0827431-76de-4f51-a2c3-bae2e1558bcc";
const ADMIN_KEY = process.env.INSTANT_ADMIN_KEY;
const FORMBRICKS_SECRET = process.env.FORMBRICKS_SHARED_SECRET;
const FORMBRICKS_API_HOST = process.env.FORMBRICKS_API_HOST || "https://app.formbricks.com";
const FORMBRICKS_API_KEY = process.env.FORMBRICKS_API_KEY;

if (!ADMIN_KEY) {
  console.error("INSTANT_ADMIN_KEY is not set");
}

const db = init({
  appId: APP_ID,
  adminToken: ADMIN_KEY,
});

/**
 * Load field mappings from file
 */
async function loadFieldMappings(): Promise<Record<string, string>> {
  try {
    const fs = await import('fs/promises');
    const mappingsPath = '/home/vibecode/workspace/data/formbricks-field-mappings.json';
    const content = await fs.readFile(mappingsPath, 'utf-8');
    const mappings = JSON.parse(content);

    const fieldLabelMap: Record<string, string> = {};
    for (const mapping of mappings) {
      fieldLabelMap[mapping.fieldId] = mapping.fieldLabel;
    }

    console.log("📋 Loaded manual field mappings:", Object.keys(fieldLabelMap).length, "fields");
    return fieldLabelMap;
  } catch (error: any) {
    console.log("No manual field mappings found (this is ok)");
    return {};
  }
}

/**
 * Fetch survey schema from Formbricks API to get field labels
 */
async function fetchSurveyFieldLabels(surveyId: string): Promise<Record<string, string>> {
  if (!FORMBRICKS_API_KEY) {
    console.warn("FORMBRICKS_API_KEY not set, cannot fetch field labels");
    return {};
  }

  try {
    const response = await fetch(`${FORMBRICKS_API_HOST}/api/v1/management/surveys/${surveyId}`, {
      headers: {
        "x-api-key": FORMBRICKS_API_KEY,
      },
    });

    if (!response.ok) {
      console.error("Failed to fetch survey:", response.status, response.statusText);
      return {};
    }

    const surveyData = await response.json();
    const fieldLabelMap: Record<string, string> = {};

    // Extract field labels from survey questions
    // Response format: { data: { questions: [...] } }
    const questions = surveyData.data?.questions || surveyData.questions || [];

    for (const question of questions) {
      const fieldId = question.id;
      // Headline can be a string or object with "default" property
      let fieldLabel = '';
      if (typeof question.headline === 'string') {
        fieldLabel = question.headline;
      } else if (question.headline?.default) {
        fieldLabel = question.headline.default;
      } else {
        fieldLabel = question.label || question.name || fieldId;
      }

      fieldLabelMap[fieldId] = fieldLabel;
    }

    console.log("📋 Fetched field labels:", Object.keys(fieldLabelMap).length, "fields");
    return fieldLabelMap;
  } catch (error: any) {
    console.error("Error fetching survey schema:", error.message);
    return {};
  }
}


/**
 * POST /api/intake/formbricks
 *
 * Receives a Formbricks submission and creates a card with fields
 * Supports multiple payload formats and logs everything for debugging
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log the entire payload to understand Formbricks structure
    console.log("=== Formbricks Webhook Received ===");
    console.log("Full payload:", JSON.stringify(body, null, 2));
    console.log("Query params:", {
      pipeId: request.nextUrl.searchParams.get("pipeId"),
      stageId: request.nextUrl.searchParams.get("stageId"),
    });
    console.log("==================================");

    // Save to file for debugging
    try {
      const fs = await import('fs/promises');
      const logPath = '/home/vibecode/workspace/logs/formbricks-webhook.json';
      await fs.writeFile(logPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        body,
        queryParams: {
          pipeId: request.nextUrl.searchParams.get("pipeId"),
          stageId: request.nextUrl.searchParams.get("stageId"),
        }
      }, null, 2));
      console.log("📝 Payload saved to:", logPath);
    } catch (err) {
      console.error("Failed to save log:", err);
    }

    // IMPORTANT: Check if this is a duplicate/test webhook
    // Formbricks sometimes sends test webhooks or triggers multiple times
    const responseId = body.response?.id || body.responseId || body.id;

    console.log("Response ID:", responseId);

    // Accept secret from multiple sources for flexibility
    const secret =
      request.headers.get("X-FORMBRICKS-SECRET") || // Header (if available)
      request.nextUrl.searchParams.get("secret") ||  // Query parameter
      body.secret ||                                   // Body field
      body.data?.secret;                               // Nested in data

    // Verify secret (disabled for testing - see logs)
    if (FORMBRICKS_SECRET && secret && secret !== FORMBRICKS_SECRET) {
      console.warn("Secret mismatch:", { received: secret, expected: FORMBRICKS_SECRET });
    }

    if (!ADMIN_KEY) {
      return NextResponse.json(
        { error: "Server configuration error: INSTANT_ADMIN_KEY not set" },
        { status: 500 }
      );
    }

    // Formbricks sends data in a specific structure
    // body.data.data contains field IDs as keys with their values
    let formData: any = {};

    if (body.data?.data) {
      // Formbricks format: { data: { data: { fieldId: value } } }
      formData = body.data.data;
      console.log("✅ Using Formbricks data.data structure");
    } else if (body.response?.data) {
      formData = body.response.data;
      console.log("✅ Using response.data structure");
    } else if (body.data) {
      formData = body.data;
      console.log("✅ Using data structure");
    } else {
      formData = body;
      console.log("✅ Using body directly");
    }

    console.log("Extracted formData keys:", Object.keys(formData));

    // Extract values with multiple fallbacks (including query params)
    // For Formbricks, we need to find meaningful values from the random field IDs
    const formValues = Object.values(formData).filter(v => v && v !== '');

    const cardTitle =
      formData.title ||
      formData.name ||
      formData.subject ||
      formValues[0] ||  // First non-empty value as fallback
      "Untitled Card";

    const cardDescription =
      formData.description ||
      formData.message ||
      formData.notes ||
      "";

    const cardPipeId =
      request.nextUrl.searchParams.get("pipeId") ||  // Query param first
      formData.pipeId ||
      formData.pipe_id ||
      formData.pipeline;

    const cardStageId =
      request.nextUrl.searchParams.get("stageId") ||  // Query param first
      formData.stageId ||
      formData.stage_id ||
      formData.stage;

    console.log("Extracted values:", {
      title: cardTitle,
      pipeId: cardPipeId,
      stageId: cardStageId,
      totalFields: Object.keys(formData).length,
    });

    // Load manual field mappings from settings page
    const manualFieldLabelMap = await loadFieldMappings();

    // Fetch field labels from Formbricks API (fallback)
    const surveyId = body.data?.surveyId;
    let apiFieldLabelMap: Record<string, string> = {};

    if (surveyId && FORMBRICKS_API_KEY) {
      apiFieldLabelMap = await fetchSurveyFieldLabels(surveyId);
    }

    // Validate required fields
    if (!cardPipeId || !cardStageId) {
      return NextResponse.json(
        {
          error: "Missing required fields: pipeId and stageId",
          hint: "You need to configure default pipe/stage IDs. Visit /admin to get IDs, then either:",
          options: [
            "1. Add pipeId and stageId to the webhook URL as query params",
            "2. Include them as hidden fields in your form",
            "3. Use the configuration page (coming soon)"
          ],
          example: "/api/intake/formbricks?pipeId=YOUR_PIPE_ID&stageId=YOUR_STAGE_ID",
          received: {
            pipeId: cardPipeId,
            stageId: cardStageId,
            title: cardTitle,
          },
          fullPayload: body,
        },
        { status: 400 }
      );
    }

    const cardId = id();
    const now = Date.now();

    // Build transaction using Admin SDK format
    const txs: any[] = [
      // Create card and link to pipe and stage
      db.tx.cards[cardId].update({
        title: cardTitle,
        description: cardDescription,
        createdAt: now,
        updatedAt: now,
      }).link({ pipe: cardPipeId, stage: cardStageId }),
    ];

    // Extract custom fields automatically from form data
    const skipKeys = [
      'pipeId', 'pipe_id', 'pipeline',
      'stageId', 'stage_id', 'stage',
      'title', 'name', 'subject',
      'description', 'message', 'notes',
      'secret', 'data', 'response', 'meta',
      'id', 'createdAt', 'updatedAt', 'personId', 'surveyId', 'finished',
      // Formbricks metadata fields to skip
      'event', 'webhookId', 'displayId', 'ttc', 'tags', 'variables', 'endingId', 'contact', 'contactAttributes', 'singleUseId', 'language'
    ];

    // Filter and collect non-empty fields first
    const fieldsToAdd: Array<{ key: string; value: any }> = [];

    for (const [key, value] of Object.entries(formData)) {
      // Skip if: in skipKeys, undefined, null, empty string, or empty array/object
      if (skipKeys.includes(key)) continue;
      if (value === undefined || value === null || value === '') continue;
      if (typeof value === 'object' && (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0)) continue;

      fieldsToAdd.push({ key, value });
    }

    // Sort fields by the original key order (Formbricks sends in form order)
    // Add fields with sequential numbering or mapped labels
    fieldsToAdd.forEach((field, index) => {
      const fieldId = id();
      let fieldType = 'text';
      let fieldValue = field.value;

      // Determine field type
      if (typeof field.value === 'number') {
        fieldType = 'number';
      } else if (typeof field.value === 'boolean') {
        fieldType = 'text';
        fieldValue = field.value ? 'Yes' : 'No';
      } else if (typeof field.value === 'object') {
        fieldType = 'text';
        fieldValue = JSON.stringify(field.value);
      }

      // Priority: 1. Manual mapping, 2. API-fetched label, 3. "Field N"
      const fieldLabel = manualFieldLabelMap[field.key] || apiFieldLabelMap[field.key] || `Field ${index + 1}`;

      txs.push(
        db.tx.card_fields[fieldId].update({
          key: fieldLabel,
          type: fieldType,
          value: fieldValue,
          position: index, // Add position for ordering
        }).link({ card: cardId })
      );
    });

    console.log(`📦 Creating card with ${fieldsToAdd.length} custom fields`);

    // Execute transaction
    await db.transact(txs);

    console.log("✅ Card created successfully:", cardId);

    // Trigger automations for card entering stage
    try {
      console.log("🤖 Triggering automations for new card entering stage...");
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
      const automationResponse = await fetch(`${baseUrl}/api/execute-automations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerType: "card_enters_stage",
          cardId,
          pipeId: cardPipeId,
          context: {
            stageId: cardStageId,
          },
        }),
      });

      const automationResult = await automationResponse.json();
      console.log("✅ Automation result:", automationResult);
    } catch (error) {
      console.error("❌ Error triggering automations:", error);
      // Don't fail the card creation if automation fails
    }

    return NextResponse.json({
      success: true,
      cardId,
      message: "Card created successfully",
    });
  } catch (error: any) {
    console.error("❌ Error in /api/intake/formbricks:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for testing - shows what IDs are needed
export async function GET(request: NextRequest) {
  const pipeId = request.nextUrl.searchParams.get("pipeId");
  const stageId = request.nextUrl.searchParams.get("stageId");

  return NextResponse.json({
    message: "Formbricks Webhook Endpoint",
    method: "POST",
    configured: {
      pipeId: pipeId || "NOT SET",
      stageId: stageId || "NOT SET",
    },
    instructions: [
      "1. Visit /admin to get your Pipe ID and Stage ID",
      "2. Configure webhook URL with query parameters:",
      `   ${request.nextUrl.origin}/api/intake/formbricks?pipeId=YOUR_PIPE_ID&stageId=YOUR_STAGE_ID`,
      "3. When Formbricks submits a form, it will create a card automatically",
    ],
  });
}
