// InstantDB Admin SDK for server-side operations
// Use this in API routes instead of the React client

import { init } from "@instantdb/admin";
import schema from "../../instant.schema";

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "f0827431-76de-4f51-a2c3-bae2e1558bcc";

// Admin token is required for server-side operations
// This should be set in .env.local as INSTANT_ADMIN_KEY
const ADMIN_TOKEN = process.env.INSTANT_ADMIN_KEY;

if (!ADMIN_TOKEN) {
  console.warn("⚠️ INSTANT_ADMIN_KEY not set. Server-side database operations will fail.");
  console.warn("Get your admin token from: https://instantdb.com/dash");
}

// Create the admin db instance with typed schema
export const adminDb = init({
  appId: APP_ID,
  adminToken: ADMIN_TOKEN!,
  schema,
});

// Export types
export type AdminDB = typeof adminDb;
