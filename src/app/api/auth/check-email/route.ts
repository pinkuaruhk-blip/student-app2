import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const allowedEmails = process.env.ALLOWED_EMAILS;

  // If no allowlist is configured, allow all emails (backwards-compatible default)
  if (!allowedEmails || allowedEmails.trim() === "") {
    return NextResponse.json({ allowed: true });
  }

  const allowedList = allowedEmails.split(",").map((e) => e.trim().toLowerCase());
  const isAllowed = allowedList.includes(email.toLowerCase());

  if (!isAllowed) {
    return NextResponse.json(
      { allowed: false, error: "This email is not authorized to access this application." },
      { status: 403 }
    );
  }

  return NextResponse.json({ allowed: true });
}
