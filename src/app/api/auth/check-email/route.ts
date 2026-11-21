import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const allowedEmails = process.env.ALLOWED_EMAILS;

  // No allowlist configured: deny everyone rather than let anyone in.
  if (!allowedEmails || allowedEmails.trim() === "") {
    console.error("[check-email] ALLOWED_EMAILS is not set; denying sign-in");
    return NextResponse.json(
      { allowed: false, error: "Sign-in is not configured on this server." },
      { status: 503 }
    );
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
