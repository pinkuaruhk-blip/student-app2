// InstantDB permissions for FlowLane.
//
// Only the four staff addresses below can read or write data from a browser,
// whatever token they hold. Everything else is denied, including signed-out
// visitors and any entity or attribute not listed here.
// Server routes that use the admin key bypass these rules; they need their own auth.
//
// These rules take effect only after `npx instant-cli push perms`.

import type { InstantRules } from "@instantdb/react";
import type schema from "./instant.schema";

// Lowercase, exact match against the email on the Instant token.
const STAFF_EMAILS = [
  "car.tong@klobsterltd.com",
  "cartong@tezukurinomise.com",
  "keith.lee@klobsterltd.com",
  "keithlee@tezukurinomise.com",
];

const isStaff = `auth.id != null && auth.email in [${STAFF_EMAILS.map(
  (e) => `'${e}'`
).join(", ")}]`;

const staffOnly = {
  bind: ["isStaff", isStaff],
  allow: { $default: "isStaff" },
};

const rules = {
  // Anything without its own rule is closed.
  $default: { allow: { $default: "false" } },

  // No new attributes or namespaces from a browser.
  attrs: { allow: { create: "false" } },

  pipes: staffOnly,
  stages: staffOnly,
  cards: staffOnly,
  card_fields: staffOnly,
  card_comments: staffOnly,
  card_emails: staffOnly,
  card_sms: staffOnly,
  stage_forms: staffOnly,
  form_submissions: staffOnly,
  card_history: staffOnly,
  automations: staffOnly,
  automation_logs: staffOnly,
  email_templates: staffOnly,
  sms_templates: staffOnly,
  system_settings: staffOnly,
  field_definitions: staffOnly,
} satisfies InstantRules<typeof schema>;

export default rules;
