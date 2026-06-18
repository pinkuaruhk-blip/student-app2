# n8n Integration Guide

This guide covers n8n integrations that are still valid:
- n8n form intake via `/api/intake/n8n`
- optional event forwarding via `N8N_EVENTS_URL`
- optional inbound email/reply processing via `/api/receive-email`

Outbound email sending is no longer handled by n8n webhooks.

## 1) n8n Form Intake Setup

Use this URL in n8n HTTP Request nodes:

```
/api/intake/n8n?pipeId=YOUR_PIPE_ID&stageId=YOUR_STAGE_ID
```

Expected payload example:

```json
{
  "title": "Card title",
  "商店名稱": "Shop Name",
  "聯絡人": "Contact Name",
  "電郵": "contact@example.com",
  "電話": "12345678"
}
```

## 2) Optional Events Back to n8n

If you want card lifecycle events forwarded to n8n, set:

```bash
N8N_EVENTS_URL=https://your-n8n-instance.com/webhook/events
```

## 3) Email Integration (Updated)

### Outbound Email

- Current outbound path: `POST /api/send-email` (Resend-backed).
- Do not configure `N8N_EMAIL_URL` or n8n send-email webhooks for outbound.

### Inbound Replies (Optional n8n)

If you still use n8n to ingest incoming replies:

1. Use an inbound email trigger node (IMAP/provider).
2. POST to `/api/receive-email` with:

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

3. Confirm replies are logged to the correct card mailbox.

## 4) Migration Notes

If you previously used outbound n8n email webhook flow:

- Remove `N8N_EMAIL_URL` from env examples/config docs.
- Keep inbound `/api/receive-email` and non-email n8n flows intact.
- Keep `/api/intake/n8n` for form-intake workflows unless intentionally replaced.
