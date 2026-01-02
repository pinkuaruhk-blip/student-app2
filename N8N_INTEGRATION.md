# n8n Form Integration Guide

## Overview

You can now use n8n forms instead of Formbricks! This gives you much more control over your forms and workflows.

## Benefits of n8n Forms

1. **No Field Mapping Needed** - Field names from your n8n form are used directly
2. **Full Control** - Structure your form data however you want
3. **Built-in Automation** - n8n can trigger workflows when cards are created
4. **Easier Testing** - Use n8n's testing tools to debug

## Setup Instructions

### 1. Get Your Pipe and Stage IDs

Visit: https://preview-rrwyydajbhzw.share.sandbox.dev/pipes

- Click on your pipe
- Copy the Pipe ID from the URL (e.g., `56155c2e-6b82-4942-8661-b2ca2eb7a120`)
- Copy the Stage ID you want cards to be created in

### 2. Webhook URL

Use this URL in your n8n webhook node:

```
https://preview-rrwyydajbhzw.share.sandbox.dev/api/intake/n8n?pipeId=YOUR_PIPE_ID&stageId=YOUR_STAGE_ID
```

**Example:**
```
https://preview-rrwyydajbhzw.share.sandbox.dev/api/intake/n8n?pipeId=56155c2e-6b82-4942-8661-b2ca2eb7a120&stageId=69cbb51f-a0f5-4426-b71c-3e67fd5b2e17
```

### 3. n8n Workflow Structure

**Option A: Simple Form → Webhook**

```
Form Trigger (or Manual Trigger for testing)
  ↓
Set node (structure your data)
  ↓
HTTP Request node → POST to webhook URL
```

**Option B: Form → Create Card → Automation**

```
Form Trigger
  ↓
HTTP Request → Create card in FlowLane
  ↓
IF node → Check field values
  ↓
HTTP Request → Move card to different stage
```

### 4. Form Data Structure

Structure your data in n8n like this:

```json
{
  "title": "基督教正生書院",
  "商店名稱": "手作之店",
  "聯絡人": "Keith Lee",
  "電郵": "knlee801@gmail.com",
  "小學/中學": "中學",
  "地址": "香港九龍",
  "電話": "97541547"
}
```

**Important:**
- `title` field → Becomes the card title (required)
- All other fields → Become custom fields with their exact key names
- Field names can be in Chinese, English, or mixed

**Fields to skip (automatically handled):**
- `pipeId`, `stageId` → Come from URL
- `description` → Optional card description
- `secret` → Optional security (add to URL if needed)

### 5. Example n8n Workflow: Auto-Route by School Type

```
Webhook/Form Trigger
  ↓
HTTP Request: Create card
  POST https://preview-rrwyydajbhzw.share.sandbox.dev/api/intake/n8n?pipeId=X&stageId=Y
  Body: {{ $json }}
  ↓
IF node: Check {{ $json['小學/中學'] }}
  ├─ IF = "中學"
  │   ↓
  │   HTTP Request: Move to 中學處理 stage
  │   POST https://preview-rrwyydajbhzw.share.sandbox.dev/api/cards/move
  │   Body: { "cardId": "{{ $json.cardId }}", "stageId": "SECONDARY_STAGE_ID" }
  │
  └─ IF = "小學"
      ↓
      HTTP Request: Move to 小學處理 stage
      POST https://preview-rrwyydajbhzw.share.sandbox.dev/api/cards/move
      Body: { "cardId": "{{ $json.cardId }}", "stageId": "PRIMARY_STAGE_ID" }
```

### 6. Response Format

When a card is created successfully, you'll receive:

```json
{
  "success": true,
  "cardId": "abc123-...",
  "message": "Card created successfully",
  "fieldsCreated": 7
}
```

Use `cardId` in subsequent workflow steps to update or move the card.

### 7. Testing

**Test the endpoint:**
Visit: https://preview-rrwyydajbhzw.share.sandbox.dev/api/intake/n8n?pipeId=YOUR_PIPE_ID&stageId=YOUR_STAGE_ID

You'll see setup instructions and an example payload.

**View webhook logs:**
Visit: https://preview-rrwyydajbhzw.share.sandbox.dev/api/logs

Check `/home/vibecode/workspace/logs/n8n-webhook.json` for the raw payload.

### 8. Events Sent Back to n8n (Optional)

If you set `N8N_EVENTS_URL` in your environment, the app will send events back to n8n when:

- `card.created` - New card created
- `card.moved` - Card moved to different stage
- `card.updated` - Card title/description changed
- `card.deleted` - Card deleted

Event payload:
```json
{
  "event": "card.created",
  "cardId": "...",
  "pipeId": "...",
  "stageId": "...",
  "title": "...",
  "description": "...",
  "fields": [...],
  "timestamp": 1234567890
}
```

## Migration from Formbricks

1. Create your n8n form with the same fields
2. Use field names you want to see in the app (no more random IDs!)
3. Update webhook URL from `/api/intake/formbricks` to `/api/intake/n8n`
4. Test with a submission
5. Once working, disable Formbricks webhook

## Troubleshooting

**Issue:** "Missing required fields: pipeId and stageId"
- **Solution:** Add them to the webhook URL as query parameters

**Issue:** Card created but fields are missing
- **Solution:** Check `/api/logs` to see what data was received

**Issue:** Want to add security
- **Solution:** Add `&secret=YOUR_SECRET` to webhook URL and set `N8N_SHARED_SECRET` in `.env.local`

## Email Integration

### Overview

Send and receive emails directly from cards using templates with placeholder support. Each card has a built-in **mailbox** that tracks all sent and received emails, creating a complete communication history.

### Features

1. **Send Emails** - Use templates with placeholders to send emails from cards
2. **Mailbox** - View all sent and received emails for each card with a badge showing email count
3. **Automatic Tracking** - All emails are logged to the database
4. **Email Threading** - Support for reply tracking with `inReplyTo`
5. **Smart Matching** - Incoming emails automatically matched to cards by email address or reply-to headers
6. **Reply to Received Emails** - Click any received email to view details and reply

### Setup Instructions

#### 1. Configure n8n Webhook for Sending Emails

Set `N8N_EMAIL_URL` in `.env.local`:
```
N8N_EMAIL_URL=https://n8n.ainow.biz/webhook/send-email
```

#### 2. Create n8n Email Sending Workflow

```
Webhook Trigger (POST) - receives from /api/send-email
  ↓
Gmail/SMTP Node (or any email service)
  - To: {{ $json.to }}
  - From: {{ $json.from }}
  - Subject: {{ $json.subject }}
  - Body: {{ $json.body }}
  - Message-ID: {{ $json.emailId }} (IMPORTANT for tracking)
```

**Critical:** Configure your email service in n8n to set the Message-ID header to `{{ $json.emailId }}`. This enables reply tracking.

#### 3. Create n8n Email Receiving Workflow (NEW!)

```
Email Trigger / IMAP Node (monitors your inbox)
  ↓
HTTP Request Node
  POST https://preview-rrwyydajbhzw.share.sandbox.dev/api/receive-email
  Headers:
    Content-Type: application/json
  Body:
  {
    "from": "{{ $json.from }}",
    "to": "{{ $json.to }}",
    "subject": "{{ $json.subject }}",
    "body": "{{ $json.text || $json.html }}",
    "emailId": "{{ $json.messageId }}",
    "inReplyTo": "{{ $json.inReplyTo }}"
  }
```

**How Incoming Emails Work:**
- When a client replies to your email, n8n's Email Trigger receives it
- The system finds the matching card by:
  1. **inReplyTo header** - Matches to original sent email (best method)
  2. **From email address** - Matches against cards with matching '電郵' field
- Email is automatically logged to the card's mailbox
- View received emails by clicking the 📬 Mailbox button on the card

#### 4. Create Email Templates

- Visit: `/settings/email-templates`
- Create templates with placeholders: `{{title}}`, `{{電郵}}`, `{{商店名稱}}`, etc.
- Placeholders are automatically replaced with card data

### Using Email Templates

**Example Template:**
```
Name: Welcome Email
Subject: 歡迎 {{商店名稱}}
Body:
你好 {{商店名稱}}，

感謝你的查詢。

我們已收到你的資料：
- 電話：{{電話}}
- 地址：{{地址}}

如有任何疑問，請隨時聯絡我們。

祝好！
```

### Sending and Managing Emails

#### Sending an Email

1. Open any card
2. Click "📧 Send Email" button
3. Select a template (optional)
4. Edit subject and body as needed
5. Click "Send Email"
   - Recipient is automatically taken from the '電郵' field
   - All placeholders are replaced with actual card data
   - Email is logged to the card's mailbox

#### Viewing the Mailbox

1. Open any card
2. Click "📬 Mailbox" button (shows badge with email count)
3. View all sent and received emails in chronological order
4. Click any email to see full details
5. For received emails, click "↩️ Reply" to respond

#### Email Features

- **Sent emails** are marked with 📤 (blue)
- **Received emails** are marked with 📥 (green)
- **Email count badge** shows total number of emails for quick reference
- **Threading support** - Replies are linked to original emails via `inReplyTo`
- **Full email details** - View from, to, subject, body, timestamps, email IDs

### API Endpoints

#### Send Email API

**Endpoint:** `POST /api/send-email`

**Request Body:**
```json
{
  "from": "system",
  "to": "recipient@example.com",
  "subject": "Email subject",
  "body": "Email body text",
  "cardId": "abc123-...",
  "cardData": {
    "title": "Card Title",
    "fields": {
      "電郵": "recipient@example.com",
      "商店名稱": "店名",
      "電話": "12345678"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "to": "recipient@example.com",
  "subject": "Email subject",
  "emailId": "email_1234567890_abc123"
}
```

**Note:** The `emailId` is used for tracking replies. Make sure your n8n email sending workflow includes it in the Message-ID header.

#### Receive Email API

**Endpoint:** `POST /api/receive-email`

**Request Body:**
```json
{
  "from": "client@example.com",
  "to": "your@email.com",
  "subject": "Re: Previous email",
  "body": "Email reply content",
  "emailId": "unique-message-id",
  "inReplyTo": "email_1234567890_abc123",
  "cardId": "optional-if-inReplyTo-provided"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email received and logged",
  "cardId": "abc123-...",
  "emailId": "unique-message-id"
}
```

**Smart Card Matching:**
1. If `cardId` is provided, uses that card
2. If `inReplyTo` is provided, finds the original sent email's card
3. If `from` email matches a card's '電郵' field, uses that card
4. Returns 404 if no matching card found

### n8n Workflow Examples

#### Email Sending Workflow

```
Webhook (POST) - receives from /api/send-email
  ↓
Gmail/SMTP Node
  - To: {{ $json.to }}
  - From: {{ $json.from }}
  - Subject: {{ $json.subject }}
  - Body: {{ $json.body }}
  - Message-ID: {{ $json.emailId }} (CRITICAL!)
  ↓
(Optional) Log to Google Sheets
  - Record sent emails
  - Track communication history
```

#### Email Receiving Workflow

```
Email Trigger / IMAP Node (monitors inbox)
  ↓
Extract Email Data
  - Parse from, to, subject, body
  - Get Message-ID and In-Reply-To headers
  ↓
HTTP Request (POST to /api/receive-email)
  - Automatically logs to matching card
  - Shows up in card's mailbox
  ↓
(Optional) Update Card Stage
  - Move card to "Awaiting Response" stage
  - Add internal note about reply received
```

### Available Placeholders

- `{{title}}` - Card title
- `{{電郵}}` - Any field named '電郵'
- `{{商店名稱}}` - Any field named '商店名稱'
- `{{fieldName}}` - Any custom field on the card

Placeholders are case-sensitive and must match the exact field names.

## Next Steps

Once cards are being created from n8n, you can build automation workflows:

1. **Auto-routing** - Move cards to different stages based on field values
2. **Email communication** - Send templated emails and track all correspondence in card mailboxes
3. **Reply tracking** - Automatically log client replies to the correct cards
4. **Notifications** - Send Slack messages when cards are created or emails received
5. **Data enrichment** - Look up additional data and add it to cards
6. **Time-based** - Schedule actions after X days (e.g., follow-up emails)
7. **Integration** - Connect to other services (Google Sheets, Airtable, CRM systems, etc.)
8. **Email analytics** - Track response rates, time to reply, communication patterns
