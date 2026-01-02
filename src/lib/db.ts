// InstantDB client configuration
// This initializes the InstantDB client for use in React components

import { init } from "@instantdb/react";
import schema from "../../instant.schema";

// Initialize InstantDB client with app ID and schema
// Using the provided app ID: f0827431-76de-4f51-a2c3-bae2e1558bcc
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || "f0827431-76de-4f51-a2c3-bae2e1558bcc";

// Create the db instance with typed schema
export const db = init({
  appId: APP_ID,
  schema,
});

// Export types for use throughout the application
export type DB = typeof db;
export type { Schema } from "../../instant.schema";
