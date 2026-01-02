import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";

/**
 * View the last Formbricks webhook payload
 * Visit: http://localhost:3000/api/logs
 */
export async function GET(request: NextRequest) {
  try {
    const logPath = '/home/vibecode/workspace/logs/formbricks-webhook.json';
    const content = await readFile(logPath, 'utf-8');
    const data = JSON.parse(content);

    return NextResponse.json({
      message: "Last Formbricks webhook received",
      ...data,
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({
        message: "No webhook received yet",
        hint: "Submit your Formbricks form and the payload will be saved here",
      });
    }
    return NextResponse.json({
      error: "Failed to read log",
      details: error.message,
    }, { status: 500 });
  }
}
