// Server-side checks for API routes. Routes that use the admin key bypass
// Instant permission rules, so each one must decide who may call it.

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";

export type StaffUser = { id: string; email: string };

function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// Requires a signed-in staff user: the browser sends its Instant refresh token
// (see staffFetch), Instant confirms it, and the email must be in ALLOWED_EMAILS.
// Returns the user, or a response the route should return as-is.
export async function requireStaff(request: NextRequest): Promise<StaffUser | NextResponse> {
  const allowed = allowedEmails();
  if (allowed.length === 0) {
    console.error("[staff-auth] ALLOWED_EMAILS is not set; refusing staff requests");
    return NextResponse.json({ error: "Server is not configured" }, { status: 503 });
  }

  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let user: { id?: string; email?: string | null } | null = null;
  try {
    user = await adminDb.auth.verifyToken(token);
  } catch {
    user = null;
  }

  const email = user?.email?.toLowerCase();
  if (!user?.id || !email || !allowed.includes(email)) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  return { id: user.id, email };
}

// Debug and maintenance routes: available in local development only.
export function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
