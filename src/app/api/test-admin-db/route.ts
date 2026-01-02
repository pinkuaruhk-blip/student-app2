import { NextResponse } from "next/server";
import { init } from "@instantdb/admin";
import schema from "../../../../instant.schema";

export async function GET() {
  try {
    const appId = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
    const adminKey = process.env.INSTANT_ADMIN_KEY;

    console.log("🧪 Testing admin DB access...");
    console.log("App ID:", appId);
    console.log("Admin Key first 10 chars:", adminKey?.substring(0, 10));
    console.log("Admin Key length:", adminKey?.length);

    // Test 1: Initialize WITH schema
    const testAdminDbWithSchema = init({
      appId: appId!,
      adminToken: adminKey!,
      schema,
    });

    const resultWithSchema = await testAdminDbWithSchema.query({
      automations: {},
      pipes: {},
    });

    // Test 2: Initialize WITHOUT schema
    const testAdminDbNoSchema = init({
      appId: appId!,
      adminToken: adminKey!,
    });

    const resultNoSchema = await testAdminDbNoSchema.query({
      automations: {},
      pipes: {},
    });

    const { data, error } = resultWithSchema;

    if (error) {
      return NextResponse.json({
        success: false,
        error: "Query failed",
        details: error,
        envCheck: {
          appId,
          adminKeyPrefix: adminKey?.substring(0, 10),
          adminKeyLength: adminKey?.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Admin DB is working",
      tests: {
        withSchema: {
          automations: resultWithSchema.data?.automations?.length || 0,
          pipes: resultWithSchema.data?.pipes?.length || 0,
          error: resultWithSchema.error || null,
        },
        withoutSchema: {
          automations: resultNoSchema.data?.automations?.length || 0,
          pipes: resultNoSchema.data?.pipes?.length || 0,
          error: resultNoSchema.error || null,
        },
      },
      sampleData: {
        automationIds: data?.automations?.slice(0, 3).map((a: any) => ({ id: a.id, name: a.name })) || [],
        pipeIds: data?.pipes?.slice(0, 3).map((p: any) => p.id) || [],
      },
      envCheck: {
        adminKeySet: !!adminKey,
        adminKeyPrefix: adminKey?.substring(0, 10),
        adminKeyLength: adminKey?.length,
        appId,
      },
    });
  } catch (error: any) {
    console.error("❌ Admin DB test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
