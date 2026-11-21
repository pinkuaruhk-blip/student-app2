// Server-side checks for API routes. Routes that use the admin key bypass
// Instant permission rules, so each one must decide who may call it.

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/db-admin";

const INTERNAL_HEADER = "x-flowlane-internal";
const N8N_SECRET_HEADER = "x-flowlane-secret";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// A key only this server can produce, derived from the Instant admin key, so
// server-to-server calls need no extra environment variable.
function internalKey(): string | null {
  const adminKey = process.env.INSTANT_ADMIN_KEY;
  if (!adminKey) return null;
  return createHmac("sha256", adminKey).update("flowlane-internal-v1").digest("hex");
}

// Headers for this server's own calls to its API routes (e.g. /api/send-email).
export function internalHeaders(): Record<string, string> {
  const key = internalKey();
  return key ? { [INTERNAL_HEADER]: key } : {};
}

function hasInternalKey(request: NextRequest): boolean {
  const key = internalKey();
  const sent = request.headers.get(INTERNAL_HEADER);
  return Boolean(key && sent && safeEqual(sent, key));
}

function hasN8nSecret(request: NextRequest): boolean {
  const secret = (process.env.N8N_SHARED_SECRET || "").trim();
  const sent = request.headers.get(N8N_SECRET_HEADER);
  return Boolean(secret && sent && safeEqual(sent.trim(), secret));
}

// Routes called by n8n. The secret must be set on the server and sent in the
// X-FlowLane-Secret header; it is never logged.
export function requireN8nSecret(request: NextRequest): NextResponse | null {
  if (!(process.env.N8N_SHARED_SECRET || "").trim()) {
    console.error("[staff-auth] N8N_SHARED_SECRET is not set; refusing n8n requests");
    return NextResponse.json({ error: "Server is not configured" }, { status: 503 });
  }
  if (!hasN8nSecret(request)) {
    return NextResponse.json({ error: "Invalid or missing secret" }, { status: 401 });
  }
  return null;
}

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

// Routes used by staff pages, by this server itself, and possibly by n8n
// (e.g. /api/send-email). Any one of the three proofs is enough.
export async function requireStaffOrServer(
  request: NextRequest
): Promise<StaffUser | "server" | "n8n" | NextResponse> {
  if (hasInternalKey(request)) return "server";
  if (hasN8nSecret(request)) return "n8n";
  return requireStaff(request);
}

// Debug and maintenance routes: available in local development only.
export function devOnly(): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
