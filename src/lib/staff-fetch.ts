// Browser-side fetch for staff-only API routes. Attaches the signed-in user's
// Instant refresh token so the route can verify who is calling (requireStaff).

import { db } from "@/lib/db";

export async function staffFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const user = await db.getAuth();
  const headers = new Headers(init.headers);
  if (user?.refresh_token) {
    headers.set("Authorization", `Bearer ${user.refresh_token}`);
  }
  return fetch(input, { ...init, headers });
}
