# Legacy n8n Message-ID Guide

This file is kept as a marker for old documentation links.

The old SMTP-node Message-ID instructions are obsolete for outbound delivery because outbound now uses Resend.

## Use This Instead

- Outbound setup: `/EMAIL_SETUP_GUIDE.md`
- Architecture overview: `/EMAIL_SYSTEM_ARCHITECTURE.md`
- n8n form and inbound integration: `/N8N_INTEGRATION.md`

## Important

- Do not configure n8n SMTP sender nodes for outbound email unless you are intentionally running a custom legacy flow.
- Keep `/api/receive-email` unchanged if your inbound workflow still posts replies there.
