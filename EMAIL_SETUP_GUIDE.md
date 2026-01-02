# Complete Email System Setup Guide

This guide will walk you through setting up the complete email system for your FlowLane application, including sending emails, receiving replies, and tracking all correspondence in card mailboxes.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Part 1: Email Templates Setup](#part-1-email-templates-setup)
4. [Part 2: n8n Email Sending Workflow](#part-2-n8n-email-sending-workflow)
5. [Part 3: n8n Email Receiving Workflow](#part-3-n8n-email-receiving-workflow)
6. [Part 4: Testing the System](#part-4-testing-the-system)
7. [Part 5: Using the Mailbox](#part-5-using-the-mailbox)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Configuration](#advanced-configuration)

---

## Overview

### What You'll Build

```
┌─────────────────────────────────────────────────────────────┐
│                     Email System Flow                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User clicks "Send Email" in Card                         │
│     ↓                                                         │
│  2. App sends to n8n webhook (/api/send-email)              │
│     ↓                                                         │
│  3. n8n sends via Gmail/SMTP                                 │
│     ↓                                                         │
│  4. Email logged to card mailbox (automatically)             │
│     ↓                                                         │
│  5. Client receives email and replies                        │
│     ↓                                                         │
│  6. n8n receives reply (Email Trigger/IMAP)                  │
│     ↓                                                         │
│  7. n8n posts to /api/receive-email                          │
│     ↓                                                         │
│  8. App matches reply to card (by email or inReplyTo)        │
│     ↓                                                         │
│  9. Reply appears in card mailbox                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Features

- ✅ Send templated emails from cards
- ✅ Automatic email logging to database
- ✅ Receive client replies automatically
- ✅ Smart card matching (no manual linking!)
- ✅ Complete email history per card
- ✅ Reply threading support
- ✅ Email count badges on cards

---

## Prerequisites

### What You Need

1. **n8n instance** running at `https://n8n.ainow.biz` (or your own)
2. **Gmail account** or SMTP server for sending emails
3. **Email address** to monitor for replies
4. **Access to your app** at `https://preview-rrwyydajbhzw.share.sandbox.dev`

### Environment Variables

Make sure these are set in your `.env.local`:

```bash
# InstantDB (already configured)
NEXT_PUBLIC_INSTANT_APP_ID=f0827431-76de-4f51-a2c3-bae2e1558bcc
INSTANT_ADMIN_KEY=5c8d54b2-ee8e-4545-b1d7-d256cb36d051

# n8n Webhooks
N8N_EVENTS_URL=https://n8n.ainow.biz/webhook/card-events
N8N_EMAIL_URL=https://n8n.ainow.biz/webhook/send-email  # ← IMPORTANT
```

---

## Part 1: Email Templates Setup

### Step 1.1: Create Your First Template

1. **Navigate to Email Templates**
   - Go to: `https://preview-rrwyydajbhzw.share.sandbox.dev/settings/email-templates`

2. **Click "Create New Template"**

3. **Fill in Template Details**

   **Example Template 1: Welcome Email**
   ```
   Template Name: Welcome Email
   Subject: 歡迎 {{商店名稱}} - 感謝你的查詢
   Body:
   你好 {{商店名稱}}，

   感謝你通過我們的表格提交查詢。我們已經收到你的資料。

   你提交的資料：
   - 商店名稱：{{商店名稱}}
   - 聯絡人：{{聯絡人}}
   - 電話：{{電話}}
   - 地址：{{地址}}
   - 學校類型：{{小學/中學}}

   我們會盡快聯絡你。如有任何疑問，請直接回覆此郵件。

   祝好，
   團隊
   ```

   **Example Template 2: Follow-up Email**
   ```
   Template Name: Follow-up
   Subject: {{商店名稱}} - 跟進查詢
   Body:
   你好 {{商店名稱}}，

   我們之前收到你的查詢，想跟進了解進度。

   如你仍有興趣，請回覆此郵件讓我們知道。

   謝謝！
   團隊
   ```

4. **Click "Save Template"**

### Step 1.2: Understanding Placeholders

Placeholders are automatically replaced with card data:

| Placeholder | Replaced With |
|------------|---------------|
| `{{title}}` | Card title |
| `{{電郵}}` | Value of '電郵' field |
| `{{商店名稱}}` | Value of '商店名稱' field |
| `{{聯絡人}}` | Value of '聯絡人' field |
| `{{電話}}` | Value of '電話' field |
| `{{地址}}` | Value of '地址' field |
| `{{小學/中學}}` | Value of '小學/中學' field |
| `{{任何欄位名稱}}` | Any custom field on the card |

**Important:** Placeholders are case-sensitive and must exactly match field names.

---

## Part 2: n8n Email Sending Workflow

### Step 2.1: Create New Workflow in n8n

1. **Log into n8n** at `https://n8n.ainow.biz`

2. **Click "New Workflow"**

3. **Name it:** "FlowLane Email Sender"

### Step 2.2: Add Webhook Trigger Node

1. **Add Node → Trigger → Webhook**

2. **Configure Webhook:**
   ```
   HTTP Method: POST
   Path: send-email
   Response Mode: When Last Node Finishes
   ```

3. **Copy Webhook URL**
   - Should be: `https://n8n.ainow.biz/webhook/send-email`
   - This matches your `N8N_EMAIL_URL` in `.env.local`

### Step 2.3: Add Gmail Node (or SMTP Node)

#### Option A: Using Gmail

1. **Add Node → Gmail → Send Email**

2. **Connect to Gmail:**
   - Click "Create New Credential"
   - Follow OAuth flow to connect your Gmail account
   - Grant necessary permissions

3. **Configure Gmail Node:**
   ```
   To: {{ $json.to }}
   Subject: {{ $json.subject }}
   Message Type: Text
   Message: {{ $json.body }}
   Options → Additional Fields:
     - Click "Add Field"
     - Select "Custom Headers"
     - Add header:
       Name: Message-ID
       Value: {{ $json.emailId }}
   ```

#### Option B: Using SMTP

1. **Add Node → SMTP → Send Email**

2. **Configure SMTP Credentials:**
   ```
   Host: smtp.gmail.com (or your SMTP server)
   Port: 587
   Security: TLS
   User: your-email@gmail.com
   Password: your-app-password
   ```

3. **Configure SMTP Node:**
   ```
   From Email: your-email@gmail.com
   To Email: {{ $json.to }}
   Subject: {{ $json.subject }}
   Text: {{ $json.body }}
   Options → Additional Fields:
     - Click "Add Field"
     - Select "Headers"
     - Add:
       Message-ID: {{ $json.emailId }}
   ```

**⚠️ CRITICAL:** The `Message-ID` header must be set to `{{ $json.emailId }}` for reply tracking to work!

### Step 2.4: (Optional) Add Logging Node

1. **Add Node → Google Sheets → Append Row**

2. **Configure:**
   - Create a spreadsheet named "Email Log"
   - Map fields:
     - Timestamp: `{{ $now }}`
     - To: `{{ $json.to }}`
     - Subject: `{{ $json.subject }}`
     - Card ID: `{{ $json.cardId }}`
     - Email ID: `{{ $json.emailId }}`

### Step 2.5: Activate Workflow

1. **Click "Save"**
2. **Toggle "Active" switch to ON**
3. **Test webhook URL** by visiting it in browser (should show webhook info)

---

## Part 3: n8n Email Receiving Workflow

This is the key part that allows client replies to automatically appear in card mailboxes!

### Step 3.1: Create New Workflow

1. **Create New Workflow in n8n**
2. **Name it:** "FlowLane Email Receiver"

### Step 3.2: Add Email Trigger Node

#### Option A: Using Email Trigger (Recommended)

1. **Add Node → Trigger → Email Trigger (IMAP)**

2. **Configure IMAP Connection:**
   ```
   Host: imap.gmail.com
   Port: 993
   User: your-email@gmail.com
   Password: your-app-password
   ```

3. **Configure Options:**
   ```
   Mailbox: INBOX
   Action: Mark as Read
   Download Attachments: No (unless needed)
   ```

#### Option B: Using Manual Trigger (for testing)

1. **Add Node → Trigger → Manual Trigger**
2. **Add sample data:**
   ```json
   {
     "from": "client@example.com",
     "to": "your-email@gmail.com",
     "subject": "Re: 歡迎 Test Shop",
     "text": "Thank you for your email. I'm interested!",
     "messageId": "abc123",
     "inReplyTo": "email_1234567890_xyz"
   }
   ```

### Step 3.3: Add HTTP Request Node

1. **Add Node → HTTP Request**

2. **Configure HTTP Request:**
   ```
   Method: POST
   URL: https://preview-rrwyydajbhzw.share.sandbox.dev/api/receive-email

   Authentication: None

   Send Headers: Yes
   Header Parameters:
     - Name: Content-Type
       Value: application/json

   Send Body: Yes
   Body Content Type: JSON

   Specify Body: Using JSON
   JSON/RAW Parameters:
   ```

3. **JSON Body (click "Add Field" for each):**
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

### Step 3.4: (Optional) Add Error Handling

1. **Add Node → IF**

2. **Configure Condition:**
   ```
   Condition: {{ $json.success }} equals true
   ```

3. **On True:** Add "No Operation" or "Set" node

4. **On False:** Add "Send Email" or "Slack" notification for errors

### Step 3.5: (Optional) Update Card Stage

You can automatically move cards when replies are received:

1. **Add Node → HTTP Request**

2. **Configure:**
   ```
   Method: POST
   URL: https://preview-rrwyydajbhzw.share.sandbox.dev/api/cards/move

   JSON Body:
   {
     "cardId": "={{ $node["HTTP Request"].json["cardId"] }}",
     "stageId": "your-awaiting-response-stage-id"
   }
   ```

### Step 3.6: Activate Workflow

1. **Click "Save"**
2. **Toggle "Active" switch to ON**
3. **The workflow will now monitor your inbox continuously**

---

## Part 4: Testing the System

### Test 1: Send an Email

1. **Open a Card**
   - Go to your Kanban board
   - Click any card with an '電郵' field

2. **Send Test Email**
   - Click "📧 Send Email"
   - Select a template or write custom message
   - Click "Send Email"

3. **Verify Success**
   - Should see "✅ Email sent successfully"
   - Check n8n execution log (should show successful run)
   - Check recipient's inbox (email should arrive)

4. **Check Mailbox**
   - Click "📬 Mailbox" button on the card
   - Should see 1 email with 📤 Sent badge
   - Click email to view details

### Test 2: Receive a Reply

1. **Reply to the Email**
   - Go to recipient's inbox
   - Open the email you just sent
   - Click "Reply"
   - Write: "Thank you, I'm interested!"
   - Send reply

2. **Wait for n8n to Process**
   - n8n checks inbox every 1-2 minutes (configurable)
   - Check n8n execution log for "FlowLane Email Receiver"
   - Should see successful execution

3. **Check Card Mailbox**
   - Refresh the card (or reopen it)
   - Click "📬 Mailbox"
   - Should now see 2 emails:
     - 📤 Sent: Your original email
     - 📥 Received: Client's reply
   - Badge should show "2"

4. **View Reply**
   - Click the received email
   - Should see:
     - From: client@example.com
     - Subject: Re: ...
     - Body: "Thank you, I'm interested!"
     - "↩️ Reply" button

### Test 3: Reply Chain

1. **Reply to the Client Again**
   - Click "↩️ Reply" on received email
   - Edit/send the reply
   - Check mailbox - should show 3 emails now

2. **Verify Threading**
   - Each reply should have "In Reply To" field
   - Threading is preserved for conversation tracking

---

## Part 5: Using the Mailbox

### Daily Usage

#### Viewing All Emails for a Card

1. **Open card**
2. **Click "📬 Mailbox"** (shows badge with email count)
3. **View list:**
   - 📤 Blue = Sent by you
   - 📥 Green = Received from client
   - Sorted by newest first
4. **Click any email** to see full details

#### Replying to Client Emails

1. **Open card mailbox**
2. **Click a received email (📥)**
3. **Click "↩️ Reply"**
4. **Edit subject/body**
5. **Send**

#### Understanding Email Details

When viewing an email, you'll see:

```
┌─────────────────────────────────────────┐
│ 📤 Sent                 2024-01-20 10:30 │
├─────────────────────────────────────────┤
│ Subject: 歡迎 Test Shop                  │
│                                          │
│ From: system                             │
│ To: client@example.com                   │
│ Email ID: email_1705741800_abc123        │
│                                          │
│ Body:                                    │
│ 你好 Test Shop，                         │
│ 感謝你的查詢...                          │
└─────────────────────────────────────────┘
```

### Managing Communication

#### Best Practices

1. **Always check mailbox before sending**
   - Avoid duplicate communications
   - See full conversation history

2. **Use templates for consistency**
   - Create templates for common scenarios
   - Customize as needed

3. **Track response times**
   - Mailbox shows timestamps
   - Monitor client engagement

4. **Use stages with email status**
   - "Awaiting Reply" stage for sent emails
   - "Reply Received" stage when client responds

---

## Troubleshooting

### Problem: Emails Not Sending

**Symptoms:** Click "Send Email" but nothing happens

**Solutions:**

1. **Check n8n webhook is active**
   ```bash
   # Visit in browser:
   https://n8n.ainow.biz/webhook/send-email
   # Should return webhook info, not 404
   ```

2. **Check .env.local**
   ```bash
   # Verify this line exists:
   N8N_EMAIL_URL=https://n8n.ainow.biz/webhook/send-email
   ```

3. **Check n8n execution log**
   - Go to n8n → Executions
   - Look for "FlowLane Email Sender"
   - Check for errors

4. **Check Gmail/SMTP credentials**
   - Test credentials in n8n
   - For Gmail: May need "App Password" instead of regular password

### Problem: Sent Emails Not Appearing in Mailbox

**Symptoms:** Email sends but doesn't show in 📬 Mailbox

**Solutions:**

1. **Check database transaction**
   - Open browser console (F12)
   - Look for errors related to InstantDB

2. **Verify cardId is being sent**
   ```javascript
   // In CardModal, check that cardId is included:
   body: JSON.stringify({
     ...
     cardId: card.id,  // ← Must be present
     ...
   })
   ```

3. **Check InstantDB schema**
   - Verify `card_emails` entity exists
   - Verify `cardEmailsCard` link exists

### Problem: Replies Not Appearing in Mailbox

**Symptoms:** Client replies to email but it doesn't show up

**Solutions:**

1. **Check n8n Email Trigger is active**
   - Go to n8n → "FlowLane Email Receiver"
   - Verify "Active" toggle is ON
   - Check last execution time

2. **Test Email Trigger manually**
   ```
   1. Go to n8n workflow
   2. Click "Execute Workflow" manually
   3. Check if it picks up recent emails
   ```

3. **Check email matching logic**
   - Open n8n execution log
   - Look at HTTP Request response
   - Should return `{ "success": true, "cardId": "..." }`
   - If returns 404, email couldn't be matched to a card

4. **Verify '電郵' field matches**
   ```
   Card's '電郵' field: client@example.com
   Reply's "from": client@example.com
   ← Must match exactly!
   ```

5. **Check inReplyTo header**
   - Gmail node must set Message-ID to `{{ $json.emailId }}`
   - Client's email must include In-Reply-To header
   - Check raw email headers in Gmail

### Problem: Message-ID Not Being Set

**Symptoms:** Reply threading doesn't work

**Solution:**

1. **Gmail Node:** Add Message-ID in "Additional Fields"
   ```
   Options → Additional Fields → Custom Headers
   Name: Message-ID
   Value: {{ $json.emailId }}
   ```

2. **SMTP Node:** Add in Headers section
   ```
   Options → Headers
   Message-ID: {{ $json.emailId }}
   ```

3. **Verify in sent email**
   - Open sent email in Gmail
   - Click "Show original"
   - Search for "Message-ID"
   - Should see: `Message-ID: <email_1234567890_abc123>`

### Problem: Card Not Found When Receiving Reply

**Symptoms:** n8n returns 404 error: "Could not find matching card"

**Solutions:**

1. **Check sender email matches card**
   ```
   Reply from: client@example.com
   Card '電郵' field: client@example.com
   ← Must match exactly (case-sensitive)
   ```

2. **Check inReplyTo is included**
   ```json
   {
     "inReplyTo": "email_1234567890_abc123"  // ← Must match original emailId
   }
   ```

3. **Test API endpoint directly**
   ```bash
   curl -X POST https://preview-rrwyydajbhzw.share.sandbox.dev/api/receive-email \
     -H "Content-Type: application/json" \
     -d '{
       "from": "client@example.com",
       "subject": "Test",
       "body": "Test body"
     }'
   ```

---

## Advanced Configuration

### Custom Email Sender Address

By default, emails are sent from "system". To customize:

1. **Update CardModal.tsx** (line ~226):
   ```javascript
   body: JSON.stringify({
     from: "your-name@company.com",  // ← Change this
     to: recipientEmail,
     ...
   })
   ```

2. **Update Gmail/SMTP node in n8n:**
   ```
   From: your-name@company.com
   ```

### Auto-Move Cards Based on Email Activity

Add automation to move cards when emails are sent/received:

1. **Create new stage:** "Awaiting Reply"

2. **In n8n Email Sender workflow:**
   ```
   Add HTTP Request Node after Gmail:
   POST /api/cards/move
   {
     "cardId": "{{ $json.cardId }}",
     "stageId": "your-awaiting-reply-stage-id"
   }
   ```

3. **In n8n Email Receiver workflow:**
   ```
   Add HTTP Request Node after receiving:
   POST /api/cards/move
   {
     "cardId": "{{ $json.cardId }}",
     "stageId": "your-reply-received-stage-id"
   }
   ```

### Email Notifications on Slack

Get notified when clients reply:

1. **Add Slack node to Email Receiver workflow**

2. **Configure:**
   ```
   Channel: #customer-replies
   Message:
   New reply from {{ $json.from }}
   Card: {{ $json.cardId }}
   Subject: {{ $json.subject }}
   ```

### Scheduled Follow-up Emails

Send automatic follow-ups after X days:

1. **Create new n8n workflow:** "Follow-up Scheduler"

2. **Add nodes:**
   ```
   Cron Trigger (daily at 9am)
     ↓
   HTTP Request (GET cards from API)
     ↓
   Filter (cards > 3 days old with no reply)
     ↓
   HTTP Request (POST to /api/send-email)
   ```

### Email Analytics Dashboard

Track email metrics:

1. **Add Google Sheets logging to both workflows**

2. **Create sheet with columns:**
   - Timestamp
   - Card ID
   - Direction (Sent/Received)
   - Response Time (for replies)
   - Subject

3. **Use Google Sheets charts** to visualize:
   - Emails per day
   - Average response time
   - Open conversations

---

## Quick Reference

### Important URLs

| Resource | URL |
|----------|-----|
| Email Templates | `/settings/email-templates` |
| n8n Fields Setup | `/settings/n8n-fields` |
| Kanban Display | `/settings/kanban-display` |
| Send Email API | `/api/send-email` |
| Receive Email API | `/api/receive-email` |
| n8n Instance | `https://n8n.ainow.biz` |

### API Endpoints

#### Send Email
```bash
POST /api/send-email
Content-Type: application/json

{
  "from": "system",
  "to": "client@example.com",
  "subject": "Email subject",
  "body": "Email body",
  "cardId": "card-id"
}
```

#### Receive Email
```bash
POST /api/receive-email
Content-Type: application/json

{
  "from": "client@example.com",
  "to": "your@email.com",
  "subject": "Re: Previous email",
  "body": "Reply content",
  "emailId": "message-id",
  "inReplyTo": "original-email-id"
}
```

### Keyboard Shortcuts

- **Open card:** Click card on board
- **Send email:** Click 📧 button
- **View mailbox:** Click 📬 button
- **Close modal:** Press `Esc` or click ×
- **Reply to email:** Click ↩️ Reply button

---

## Summary Checklist

### Initial Setup
- [ ] Environment variables configured in `.env.local`
- [ ] Email templates created at `/settings/email-templates`
- [ ] n8n Email Sender workflow created and active
- [ ] n8n Email Receiver workflow created and active
- [ ] Message-ID header configured in Gmail/SMTP node

### Testing
- [ ] Sent test email from card
- [ ] Email appeared in card mailbox
- [ ] Replied to test email
- [ ] Reply appeared in card mailbox
- [ ] Reply button works on received emails

### Production Ready
- [ ] Gmail/SMTP credentials secured
- [ ] Error handling configured in n8n
- [ ] Email logging enabled (optional)
- [ ] Stage automation configured (optional)
- [ ] Team trained on using mailbox feature

---

## Need Help?

### Check Logs

1. **Browser Console:**
   - Press F12
   - Look for errors when sending emails

2. **n8n Execution Log:**
   - Go to n8n → Executions
   - Click failed execution to see error details

3. **API Logs:**
   - Check server console for API errors
   - Look for "=== Send Email Request ===" logs

### Common Issues

| Issue | Quick Fix |
|-------|-----------|
| Email not sending | Check N8N_EMAIL_URL is set |
| Email sent but not in mailbox | Verify cardId is included |
| Reply not matching card | Check '電郵' field matches sender |
| No Message-ID in sent emails | Add Message-ID header in n8n |
| n8n not receiving replies | Verify IMAP credentials and workflow is active |

---

**Congratulations!** 🎉 You now have a complete email system with mailbox tracking for every card!
