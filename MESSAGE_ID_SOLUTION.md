# Message-ID Note (Current Behavior)

This document previously described how to configure Message-ID in n8n SMTP sender nodes.

That guidance is now legacy for outbound email.

## Current State

- Outbound email is sent by Resend via `POST /api/send-email`.
- Subject-based card tagging is already supported for reply matching workflows.
- Optional inbound workflows can still post `emailId` and `inReplyTo` to `POST /api/receive-email`.

## What To Configure Now

1. Configure Resend:
   - `RESEND_API_KEY`
   - `DEFAULT_FROM_EMAIL`
2. Optional webhook status tracking:
   - `RESEND_WEBHOOK_SECRET`
3. Optional inbound n8n workflow:
   - Trigger on inbound email
   - POST to `/api/receive-email`

## Why This Changed

Outbound delivery no longer depends on n8n SMTP/Gmail sender nodes, so SMTP header troubleshooting is no longer part of the outbound setup path.
