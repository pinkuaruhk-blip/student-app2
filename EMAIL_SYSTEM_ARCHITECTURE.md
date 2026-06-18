# Email System Architecture

## Current Architecture

```
Card UI
  -> POST /api/send-email
      -> Resend API
      -> card_emails (direction=sent, provider=resend)
      -> (optional) POST /api/resend/webhook updates status

Reply Email (client side)
  -> optional n8n/email trigger
      -> POST /api/receive-email
          -> card_emails (direction=received)
          -> linked to matching card
```

## Outbound Flow (Resend)

1. User sends email from card modal.
2. `POST /api/send-email` validates payload and sender config.
3. API sends with Resend and logs message in `card_emails`.
4. API response includes success/failure metadata.
5. If webhook is configured, `POST /api/resend/webhook` updates delivery status:
   - `sent`
   - `delivered`
   - `delayed`
   - `failed`
   - `bounced`
   - `suppressed`
   - `complained`

## Inbound Flow (Optional n8n)

1. Email provider/n8n detects inbound reply.
2. n8n sends normalized payload to `POST /api/receive-email`.
3. App resolves card by `cardId`, `inReplyTo`, or sender address.
4. App logs inbound message in `card_emails`.

## Environment Variables

Required for outbound:

```bash
RESEND_API_KEY=re_...
DEFAULT_FROM_EMAIL=you@yourdomain.com
```

Optional for outbound status tracking:

```bash
RESEND_WEBHOOK_SECRET=whsec_...
```

Optional non-email n8n integration:

```bash
N8N_EVENTS_URL=https://your-n8n-instance.com/webhook/events
```

## Important Clarification

- Outbound email no longer depends on n8n webhooks or SMTP node configuration.
- `/api/receive-email` remains available for inbound workflows and should not be removed if your workflow relies on it.
