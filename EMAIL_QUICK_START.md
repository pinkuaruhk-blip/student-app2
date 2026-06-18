# Email System Quick Start Checklist

Use this checklist to verify the current email architecture:
- Outbound email is sent by `POST /api/send-email` using Resend.
- Optional inbound reply processing can still use n8n and `POST /api/receive-email`.

## Phase 1: Environment Setup (5 minutes)

- [ ] Confirm outbound email variables in `.env.local`:
  ```bash
  RESEND_API_KEY=re_...
  DEFAULT_FROM_EMAIL=you@yourdomain.com
  # Optional:
  DEFAULT_FROM_NAME=Your Team
  RESEND_WEBHOOK_SECRET=whsec_...
  ```

- [ ] Keep optional n8n event variable if you use event forwarding:
  ```bash
  N8N_EVENTS_URL=https://your-n8n-instance.com/webhook/events
  ```

- [ ] Restart the app after env changes.

## Phase 2: Outbound Email (Resend) (10 minutes)

- [ ] Create or verify an email template at `/settings/email-templates`.
- [ ] Open a card with a valid `電郵` field.
- [ ] Send an email from the card modal.
- [ ] Verify success response and mailbox entry with `sent` status.
- [ ] If configured, verify delivery updates from `/api/resend/webhook`.

## Phase 3: Optional Inbound Reply Workflow (n8n) (15-20 minutes)

- [ ] In n8n, configure an email trigger (IMAP or provider node).
- [ ] Add an HTTP Request node that posts to:
  `https://<your-app>/api/receive-email`
- [ ] Send JSON body:
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
- [ ] Verify replies appear in card mailbox.

## Troubleshooting Quick Reference

| Issue | Check | Fix |
|---|---|---|
| Cannot send outbound email | `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL` | Set valid values and restart |
| Outbound shows failed/suppressed | Resend dashboard + webhook events | Verify recipient and suppression/bounce details |
| Reply not appearing | n8n inbound workflow active | Check n8n execution logs and `/api/receive-email` payload |
| Card match failed for reply | `inReplyTo` or sender mismatch | Pass full headers and confirm `電郵` field value |

## Related Docs

- `/EMAIL_SETUP_GUIDE.md`
- `/EMAIL_SYSTEM_ARCHITECTURE.md`
- `/N8N_INTEGRATION.md`
