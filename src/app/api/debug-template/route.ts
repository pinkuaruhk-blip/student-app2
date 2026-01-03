import { NextRequest, NextResponse } from "next/server";
import { init } from "@instantdb/admin";

export async function GET(request: NextRequest) {
  try {
    const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID;
    const ADMIN_TOKEN = process.env.INSTANT_ADMIN_KEY;

    if (!APP_ID || !ADMIN_TOKEN) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 500 });
    }

    const db = init({ appId: APP_ID, adminToken: ADMIN_TOKEN });

    // Query specific template that's being used
    const templateId = "bab05759-341c-407a-8041-ac91b48b4b51";
    const result = await db.query({
      email_templates: {
        $: {
          where: { id: templateId }
        }
      }
    });

    const template = result?.email_templates?.[0];

    return NextResponse.json({
      found: !!template,
      template: template ? {
        id: template.id,
        name: template.name,
        fromEmail: template.fromEmail,
        fromName: template.fromName,
        toEmail: template.toEmail,
        bcc: template.bcc,
        subject: template.subject,
        body: template.body?.substring(0, 200),
      } : null,
      fullTemplate: template,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
