# Email System Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FLOWLANE EMAIL SYSTEM                           │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              YOUR APP                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         Card Modal                                │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                       │   │
│  │  │   📧     │  │   📬     │  │  🗑️     │                       │   │
│  │  │   Send   │  │ Mailbox  │  │ Delete   │                       │   │
│  │  │  Email   │  │   (3)    │  │  Card    │                       │   │
│  │  └────┬─────┘  └────┬─────┘  └──────────┘                       │   │
│  │       │             │                                             │   │
│  │       │             └──────────────┐                             │   │
│  │       │                            │                             │   │
│  └───────┼────────────────────────────┼─────────────────────────────┘   │
│          │                            │                                 │
│          │                            ▼                                 │
│          │                    ┌───────────────┐                         │
│          │                    │   Mailbox     │                         │
│          │                    │   Modal       │                         │
│          │                    │               │                         │
│          │                    │ 📤 Sent (2)   │                         │
│          │                    │ 📥 Rcvd (1)   │                         │
│          │                    └───────────────┘                         │
│          │                                                               │
│          ▼                                                               │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  /api/send-email                                                │    │
│  │  • Validates email address                                      │    │
│  │  • Generates unique emailId                                     │    │
│  │  • Logs to database (card_emails)                               │    │
│  │  • Sends to n8n webhook                                         │    │
│  └────────────────┬───────────────────────────────────────────────┘    │
│                   │                                                      │
└───────────────────┼──────────────────────────────────────────────────────┘
                    │
                    │ HTTP POST
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                N8N                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              WORKFLOW 1: Email Sender                            │   │
│  │                                                                   │   │
│  │  ┌──────────────┐      ┌─────────────┐      ┌──────────────┐   │   │
│  │  │   Webhook    │─────▶│   Gmail/    │─────▶│   (Optional) │   │   │
│  │  │   Trigger    │      │   SMTP      │      │  Google      │   │   │
│  │  │              │      │   Node      │      │  Sheets      │   │   │
│  │  │ /webhook/    │      │             │      │  Log         │   │   │
│  │  │ send-email   │      │ Set         │      │              │   │   │
│  │  │              │      │ Message-ID! │      │              │   │   │
│  │  └──────────────┘      └──────┬──────┘      └──────────────┘   │   │
│  │                               │                                  │   │
│  └───────────────────────────────┼──────────────────────────────────┘   │
│                                  │                                       │
│                                  │ Email sent to client                 │
│                                  ▼                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴──────────────┐
                    │                            │
                    ▼                            │
           ┌──────────────────┐                 │
           │  Client's Inbox  │                 │
           │                  │                 │
           │  📧 New Email    │                 │
           │  From: You       │                 │
           │  Subject: ...    │                 │
           │                  │                 │
           │  [Reply] Button  │                 │
           └────────┬─────────┘                 │
                    │                            │
                    │ Client clicks Reply        │
                    ▼                            │
           ┌──────────────────┐                 │
           │  Reply Email     │                 │
           │  To: You         │                 │
           │  In-Reply-To:    │                 │
           │  <emailId>       │                 │
           └────────┬─────────┘                 │
                    │                            │
                    │ Email sent back            │
                    ▼                            │
┌─────────────────────────────────────────────────────────────────────────┐
│                                N8N                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              WORKFLOW 2: Email Receiver                          │   │
│  │                                                                   │   │
│  │  ┌──────────────┐      ┌─────────────┐      ┌──────────────┐   │   │
│  │  │   Email      │─────▶│    HTTP     │─────▶│   (Optional) │   │   │
│  │  │   Trigger    │      │   Request   │      │    Move      │   │   │
│  │  │   (IMAP)     │      │             │      │    Card      │   │   │
│  │  │              │      │  POST to    │      │    Stage     │   │   │
│  │  │ Monitors     │      │  /api/      │      │              │   │   │
│  │  │ Inbox        │      │  receive-   │      │              │   │   │
│  │  │              │      │  email      │      │              │   │   │
│  │  └──────────────┘      └──────┬──────┘      └──────────────┘   │   │
│  │                               │                                  │   │
│  └───────────────────────────────┼──────────────────────────────────┘   │
│                                  │                                       │
└──────────────────────────────────┼───────────────────────────────────────┘
                                   │ HTTP POST
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              YOUR APP                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  /api/receive-email                                              │   │
│  │  • Receives email from n8n                                       │   │
│  │  • Smart card matching:                                          │   │
│  │    1. Try inReplyTo (matches original emailId)                   │   │
│  │    2. Try from email (matches '電郵' field)                      │   │
│  │    3. Try cardId (if provided)                                   │   │
│  │  • Logs to database (card_emails)                                │   │
│  │  • Returns success + cardId                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    InstantDB Database                            │   │
│  │                                                                   │   │
│  │  card_emails table:                                              │   │
│  │  ┌────────┬───────┬──────┬─────────┬──────┬─────────┬─────┐    │   │
│  │  │ id     │ dir   │ from │ to      │ subj │ body    │ ... │    │   │
│  │  ├────────┼───────┼──────┼─────────┼──────┼─────────┼─────┤    │   │
│  │  │ email1 │ sent  │ sys  │ client@ │ 歡迎 │ ...     │     │    │   │
│  │  │ email2 │ rcvd  │ cli@ │ system  │ Re:  │ Thanks! │     │    │   │
│  │  │ email3 │ sent  │ sys  │ client@ │ Re:  │ Great!  │     │    │   │
│  │  └────────┴───────┴──────┴─────────┴──────┴─────────┴─────┘    │   │
│  │                                                                   │   │
│  │  Linked to cards via cardEmailsCard relationship                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  User opens card → Sees mailbox badge (3) → Clicks 📬           │   │
│  │                                                                   │   │
│  │  Mailbox shows all emails:                                       │   │
│  │  • 📤 Sent: 2 emails                                             │   │
│  │  • 📥 Received: 1 email                                          │   │
│  │  • Click any email for details                                   │   │
│  │  • Click ↩️ Reply on received emails                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

### Sending an Email

```
1. User clicks "📧 Send Email" in card
2. CardModal sends to /api/send-email with:
   - from: "system"
   - to: "client@example.com"
   - subject: "歡迎 ..."
   - body: "..."
   - cardId: "abc123"
   - emailId: "email_1234567890_xyz" (generated)

3. /api/send-email:
   a. Validates email format
   b. Saves to database (card_emails table):
      - direction: "sent"
      - from, to, subject, body
      - sentAt: timestamp
      - emailId: for tracking
      - Links to card
   c. Sends to n8n webhook

4. n8n Email Sender:
   a. Receives webhook POST
   b. Sends via Gmail/SMTP
   c. Sets Message-ID header to emailId
   d. (Optional) Logs to Google Sheets

5. Client receives email in inbox

6. User sees email in card mailbox with 📤 Sent badge
```

### Receiving a Reply

```
1. Client clicks Reply in their email inbox

2. Email system includes:
   - From: client@example.com
   - To: your@email.com
   - Subject: Re: 歡迎 ...
   - Body: "Thanks! I'm interested"
   - In-Reply-To: email_1234567890_xyz (automatic)

3. n8n Email Receiver (IMAP trigger):
   a. Detects new email in inbox
   b. Extracts: from, to, subject, body, messageId, inReplyTo
   c. POSTs to /api/receive-email

4. /api/receive-email:
   a. Tries to find matching card:
      - Option 1: inReplyTo matches original emailId
        → Finds card from sent email
      - Option 2: from matches card's '電郵' field
        → Finds card by email address
   b. Saves to database (card_emails table):
      - direction: "received"
      - from, to, subject, body
      - sentAt: timestamp
      - emailId: messageId
      - inReplyTo: original emailId
      - Links to found card
   c. Returns success + cardId

5. n8n receives success response
   - (Optional) Moves card to "Reply Received" stage
   - (Optional) Sends Slack notification

6. User opens card mailbox:
   - Sees 📬 Mailbox badge now shows (2)
   - Sees both emails:
     - 📤 Sent: Original email
     - 📥 Received: Client's reply
   - Can click reply to continue conversation
```

## Key Components

### Database Schema

```typescript
card_emails: {
  id: string              // Unique ID
  direction: string       // "sent" or "received"
  from: string           // Sender email
  to: string             // Recipient email
  subject: string        // Email subject
  body: string           // Email body
  sentAt: number         // Timestamp (indexed)
  emailId: string        // External tracking ID (optional)
  inReplyTo: string      // Original email ID (optional)
}

// Linked to cards via:
cardEmailsCard: {
  card_emails → card (one-to-one)
  cards → emails (one-to-many)
}
```

### Email Matching Logic

```javascript
// Priority order for matching incoming emails to cards:

1. If inReplyTo exists:
   → Find card_emails where emailId = inReplyTo
   → Use that card

2. Else if from email exists:
   → Find card_fields where key = '電郵' AND value = from
   → Use that card

3. Else if cardId provided:
   → Use provided cardId

4. Else:
   → Return 404 error
```

### UI Components

```
CardModal
├── 📬 Mailbox Button (with badge)
│   └── Opens Mailbox Modal
│       ├── Email List
│       │   ├── 📤 Sent emails (blue)
│       │   └── 📥 Received emails (green)
│       └── Click email → Email Detail Modal
│           ├── Full email content
│           ├── Headers (from, to, subject)
│           ├── Email IDs (for debugging)
│           └── ↩️ Reply button (for received)
│
├── 📧 Send Email Button
│   └── Opens Send Email Modal
│       ├── Template selector
│       ├── Subject input
│       ├── Body textarea
│       └── Send button
│
└── 🗑️ Delete Card Button
```

## Environment Setup

### Required Variables

```bash
# In .env.local:
NEXT_PUBLIC_INSTANT_APP_ID=f0827431-76de-4f51-a2c3-bae2e1558bcc
INSTANT_ADMIN_KEY=5c8d54b2-ee8e-4545-b1d7-d256cb36d051
N8N_EVENTS_URL=https://n8n.ainow.biz/webhook/card-events
N8N_EMAIL_URL=https://n8n.ainow.biz/webhook/send-email
```

### n8n Workflows

```
Workflow 1: FlowLane Email Sender
├── Webhook Trigger: /webhook/send-email
├── Gmail/SMTP Node (set Message-ID!)
└── (Optional) Google Sheets Logger

Workflow 2: FlowLane Email Receiver
├── Email Trigger (IMAP)
├── HTTP Request → /api/receive-email
└── (Optional) Card Stage Updater
```

## Success Indicators

### ✅ System is Working When:

1. **Sending emails:**
   - Email arrives in client inbox ✓
   - Email appears in card mailbox with 📤 badge ✓
   - n8n execution shows success ✓

2. **Receiving replies:**
   - n8n detects incoming email ✓
   - Reply appears in card mailbox with 📥 badge ✓
   - Mailbox badge count increases ✓

3. **Email threading:**
   - Reply has "In Reply To" field ✓
   - Can trace conversation chain ✓
   - Reply button works ✓

### ⚠️ Common Issues:

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Email sends but not in mailbox | Database save failed | Check cardId is included |
| Reply doesn't match card | Email mismatch | Verify '電郵' field matches sender |
| Reply doesn't match original | Missing Message-ID | Add Message-ID header in n8n |
| n8n not receiving replies | IMAP not configured | Check Gmail credentials |
| 404 when receiving | No matching card | Check email address matches |

## API Documentation Quick Reference

### POST /api/send-email

```javascript
Request:
{
  from: "system",
  to: "client@example.com",
  subject: "Email subject",
  body: "Email body",
  cardId: "card-id-here"
}

Response:
{
  success: true,
  message: "Email sent successfully",
  to: "client@example.com",
  subject: "Email subject",
  emailId: "email_1234567890_abc123"
}
```

### POST /api/receive-email

```javascript
Request:
{
  from: "client@example.com",
  to: "your@email.com",
  subject: "Re: Previous email",
  body: "Reply content",
  emailId: "message-id-from-email",
  inReplyTo: "email_1234567890_abc123"
}

Response:
{
  success: true,
  message: "Email received and logged",
  cardId: "matched-card-id",
  emailId: "message-id-from-email"
}
```

## File Structure

```
/home/vibecode/workspace/
├── instant.schema.ts              # Database schema (card_emails added)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── send-email/
│   │   │   │   └── route.ts      # Send email API
│   │   │   ├── receive-email/
│   │   │   │   └── route.ts      # Receive email API (NEW)
│   │   │   └── email-templates/
│   │   │       └── route.ts      # Template CRUD API
│   │   └── settings/
│   │       └── email-templates/
│   │           └── page.tsx      # Template management UI
│   └── components/
│       └── card-modal.tsx         # Card modal with mailbox (UPDATED)
├── data/
│   └── email-templates.json      # Stored templates
├── N8N_INTEGRATION.md            # Integration documentation
├── EMAIL_SETUP_GUIDE.md          # This setup guide
└── .env.local                    # Environment configuration
```

---

**This system provides complete email communication tracking for every card in your FlowLane application!** 🎉
