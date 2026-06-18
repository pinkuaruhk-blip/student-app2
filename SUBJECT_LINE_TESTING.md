# Subject-Line Matching Testing Guide

This guide validates reply matching using card ID markers in subject lines.

## What to Expect

When outbound email is sent from `/api/send-email`, the system includes the card marker in subject format:

```
Subject [#card-id]
```

Replies typically preserve this marker and allow reliable card matching.

## Test Steps

### 1) Send Outbound Email

1. Open a card with a valid `電郵` value.
2. Send email from card modal.
3. Confirm subject includes `[#...]`.

### 2) Verify Mailbox After Send

1. Open card mailbox.
2. Confirm one `sent` record exists.

### 3) Reply From Recipient Inbox

1. Reply to the received email.
2. Keep `[#...]` in subject.

### 4) Inbound Processing

If you use n8n for inbound:
1. n8n trigger receives reply.
2. n8n posts to `/api/receive-email` with `from`, `to`, `subject`, `body`, `emailId`, `inReplyTo`.

### 5) Verify Reply Log

1. Reopen card mailbox.
2. Confirm a `received` message is linked to the same card.

## Troubleshooting

### Subject marker missing on outbound

- Check `/api/send-email` response and server logs.
- Confirm outbound send path is not bypassing the API route.

### Reply not matching card

- Ensure subject still contains `[#card-id]`.
- Ensure inbound integration forwards full subject.
- Verify sender address matches expected card field if fallback matching is used.

## Notes

- `N8N_EMAIL_URL` is no longer used for outbound sending.
- Outbound transport is Resend; n8n is optional for inbound/reply processing only.
