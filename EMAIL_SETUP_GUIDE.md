# Complete Email System Setup Guide

This guide reflects the current architecture:
- Outbound email: Resend via `POST /api/send-email`
- Optional inbound replies: n8n (or any integration) posting to `POST /api/receive-email`

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Part 1: Outbound Email Setup (Resend)](#part-1-outbound-email-setup-resend)
4. [Part 2: Optional Inbound Reply Workflow (n8n)](#part-2-optional-inbound-reply-workflow-n8n)
5. [Part 3: Testing](#part-3-testing)
6. [Troubleshooting](#troubleshooting)

## Overview

1. User sends email from a card.
2. App calls `POST /api/send-email`.
3. Resend delivers outbound email.
4. App logs email in `card_emails`.
5. Optional: Resend webhooks update delivery status (`delivered`, `bounced`, `suppressed`, `failed`).
6. Optional: n8n receives reply email and posts to `POST /api/receive-email`.
7. App matches and logs inbound reply in the card mailbox.

## Prerequisites

- Access to app and card/email template UI.
- Resend account with a valid API key and verified sender domain.
- Optional: n8n instance for inbound email/reply processing.

## Part 1: Outbound Email Setup (Resend)

### Step 1.1: Environment Variables

Set in `.env.local`:

```bash
RESEND_API_KEY=re_...
DEFAULT_FROM_EMAIL=you@yourdomain.com
DEFAULT_FROM_NAME=Your Team

# Optional but recommended for delivery-status updates:
RESEND_WEBHOOK_SECRET=whsec_...
```

Optional non-email n8n variable (keep only if used):

```bash
N8N_EVENTS_URL=https://your-n8n-instance.com/webhook/events
```

### Step 1.2: Template Setup

1. Go to `/settings/email-templates`.
2. Create/edit templates using placeholders such as `{{title}}`, `{{電郵}}`, and card field keys.
3. Save template.

### Step 1.3: Send a Test Outbound Email

1. Open a card with a valid `電郵` field.
2. Click Send Email and choose a template.
3. Confirm API success.
4. Confirm mailbox logs the sent message.

### Step 1.4: Delivery Status Webhook (Optional but Recommended)

1. Configure Resend webhook to call `POST /api/resend/webhook`.
2. Add `RESEND_WEBHOOK_SECRET`.
3. Verify status transitions for sent emails:
   - `delivered`
   - `bounced`
   - `suppressed`
   - `failed`

## Part 2: Optional Inbound Reply Workflow (n8n)

This section is only for inbound email/reply handling. It does not send outbound email.

### Step 2.1: Build n8n Inbound Workflow

1. Add an email trigger node (IMAP/provider).
2. Add HTTP Request node:
   - Method: `POST`
   - URL: `https://<your-app>/api/receive-email`
   - Content-Type: `application/json`
3. Send JSON payload:

```json
{
  "from": "={{ $json.from }}",
  "to": "={{ $json.to }}",
  "subject": "={{ $json.subject }}",
  "body": "={{ $json.text || $json.html }}",
  "emailId": "={{ $json.messageId }}",
  "inReplyTo": "={{ $json.inReplyTo }}"
}
```

4. Activate workflow.

### Step 2.2: Validate Inbound Matching

`/api/receive-email` can match by:
1. `cardId` (if provided)
2. `inReplyTo` (recommended)
3. sender email vs card `電郵` field

## Part 3: Testing

### Test A: Outbound Success Path

1. Send valid outbound email from card.
2. Confirm send success response and mailbox persistence.
3. Confirm delivery status updates if webhook is configured.

### Test B: Outbound Suppressed/Failed Path

1. Send to a known suppressed/invalid recipient.
2. Confirm failure/suppression message is Resend-aware.
3. Confirm no n8n/SMTP wording appears in user-facing copy.

### Test C: Inbound Reply Path

1. Reply to a previously sent email.
2. Confirm n8n posts to `/api/receive-email`.
3. Confirm reply appears in the correct card mailbox.

## Troubleshooting

### Outbound email not sending

- Check `RESEND_API_KEY` and `DEFAULT_FROM_EMAIL`.
- Verify sender domain in Resend dashboard.
- Check server logs for `/api/send-email`.

### Outbound status not updating

- Verify `RESEND_WEBHOOK_SECRET`.
- Verify Resend webhook endpoint and signature headers.
- Check `/api/resend/webhook` logs.

### Inbound reply not logged

- Check n8n trigger and execution logs.
- Verify payload fields sent to `/api/receive-email`.
- Verify sender address and/or `inReplyTo` values.

## Notes

- Outbound does not depend on `N8N_EMAIL_URL` or `N8N_SEND_EMAIL_WEBHOOK_URL`.
- Keep `/api/receive-email` and related inbound integrations if your team uses reply automation.
