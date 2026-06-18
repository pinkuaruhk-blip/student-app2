# Custom Domain Email Setup (Resend)

This project no longer uses n8n SMTP nodes for outbound email delivery.

Use Resend for outbound sending through `POST /api/send-email`.

## 1) Verify Sender Domain in Resend

1. Open Resend dashboard.
2. Add your domain.
3. Configure DNS records (SPF/DKIM/verification) as prompted.
4. Wait until domain status is verified.

## 2) Configure App Environment

Set `.env.local` values:

```bash
RESEND_API_KEY=re_...
DEFAULT_FROM_EMAIL=sender@yourdomain.com
DEFAULT_FROM_NAME=Your Team
RESEND_WEBHOOK_SECRET=whsec_...   # optional but recommended
```

## 3) Send a Test Email

1. Open a card with a valid recipient in `電郵`.
2. Send a test email from the card modal.
3. Confirm:
   - API success from `/api/send-email`
   - sent message appears in mailbox
   - delivery status updates (if webhook configured)

## 4) Optional Inbound Replies

If you still use n8n for inbound replies:
- Keep `/api/receive-email`
- Post normalized inbound payloads from n8n to that endpoint

No SMTP credential setup in n8n is required for outbound delivery in the current architecture.
