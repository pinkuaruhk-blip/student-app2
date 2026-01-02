# Email System Quick Start Checklist

Use this checklist to set up the email system step by step. Check off each item as you complete it.

## Phase 1: Environment Setup (5 minutes)

- [ ] **Verify .env.local has email URL**
  ```bash
  # Check this line exists:
  N8N_EMAIL_URL=https://n8n.ainow.biz/webhook/send-email
  ```
  Location: `/home/vibecode/workspace/.env.local`

- [ ] **Restart app if you made changes**
  ```bash
  # Stop and start your dev server
  ```

- [ ] **Test app is running**
  Visit: `https://preview-rrwyydajbhzw.share.sandbox.dev`

## Phase 2: Email Templates (10 minutes)

- [ ] **Create first email template**
  1. Go to: `/settings/email-templates`
  2. Click "Create New Template"
  3. Use this example:
     ```
     Name: Welcome Email
     Subject: 歡迎 {{商店名稱}}
     Body:
     你好 {{商店名稱}}，

     感謝你的查詢。我們已收到你的資料。

     - 聯絡人：{{聯絡人}}
     - 電話：{{電話}}
     - 地址：{{地址}}

     如有疑問請回覆此郵件。

     祝好！
     ```
  4. Click "Save Template"

- [ ] **Verify template saved**
  - Refresh page
  - Should see template in list

## Phase 3: n8n Email Sending Workflow (15 minutes)

- [ ] **Log into n8n**
  URL: `https://n8n.ainow.biz`

- [ ] **Create new workflow**
  - Click "+ New Workflow"
  - Name: "FlowLane Email Sender"

- [ ] **Add Webhook Trigger**
  - Add Node → Trigger → Webhook
  - HTTP Method: POST
  - Path: `send-email`
  - Response Mode: When Last Node Finishes
  - Copy webhook URL (should be: `https://n8n.ainow.biz/webhook/send-email`)

- [ ] **Add Gmail Node**
  - Add Node → Gmail → Send Email
  - Connect Gmail account (OAuth)
  - Configure:
    - To: `{{ $json.to }}`
    - Subject: `{{ $json.subject }}`
    - Message: `{{ $json.body }}`

- [ ] **⚠️ CRITICAL: Add Message-ID header**
  - In Gmail node, click "Add Option"
  - Select "Additional Fields"
  - Add "Custom Headers"
  - Name: `Message-ID`
  - Value: `{{ $json.emailId }}`

  **WITHOUT THIS, REPLY TRACKING WON'T WORK!**

- [ ] **Save and activate workflow**
  - Click "Save"
  - Toggle "Active" to ON

- [ ] **Test webhook URL**
  - Visit: `https://n8n.ainow.biz/webhook/send-email`
  - Should return webhook info (not 404)

## Phase 4: Test Email Sending (5 minutes)

- [ ] **Open a card with '電郵' field**
  1. Go to Kanban board
  2. Click any card
  3. Verify it has '電郵' field with valid email

- [ ] **Send test email**
  1. Click "📧 Send Email"
  2. Select template (or write custom)
  3. Click "Send Email"
  4. Should see "✅ Email sent successfully"

- [ ] **Verify email sent**
  - Check n8n execution log (should show success)
  - Check recipient inbox (email should arrive)

- [ ] **Check mailbox**
  1. Click "📬 Mailbox" button on card
  2. Should see 1 email with 📤 Sent badge
  3. Click email to view details

**If any step fails, check Phase 3 setup again.**

## Phase 5: n8n Email Receiving Workflow (20 minutes)

- [ ] **Create new workflow in n8n**
  - Name: "FlowLane Email Receiver"

- [ ] **Add Email Trigger (IMAP)**
  - Add Node → Trigger → Email Trigger (IMAP)
  - Configure IMAP:
    - Host: `imap.gmail.com`
    - Port: `993`
    - User: `your-email@gmail.com`
    - Password: `your-app-password` (generate in Gmail settings)
  - Options:
    - Mailbox: `INBOX`
    - Action: `Mark as Read`

- [ ] **Generate Gmail App Password** (if needed)
  1. Go to: https://myaccount.google.com/apppasswords
  2. Generate password for "Mail"
  3. Copy password (shown once!)
  4. Use in IMAP node

- [ ] **Add HTTP Request Node**
  - Add Node → HTTP Request
  - Method: POST
  - URL: `https://preview-rrwyydajbhzw.share.sandbox.dev/api/receive-email`
  - Send Headers: Yes
    - Header: `Content-Type` = `application/json`
  - Send Body: Yes
  - Body Content Type: JSON
  - JSON Parameters:
    ```
    from: {{ $json.from }}
    to: {{ $json.to }}
    subject: {{ $json.subject }}
    body: {{ $json.text }}
    emailId: {{ $json.messageId }}
    inReplyTo: {{ $json.inReplyTo }}
    ```

- [ ] **Save and activate workflow**
  - Click "Save"
  - Toggle "Active" to ON

## Phase 6: Test Email Receiving (10 minutes)

- [ ] **Reply to test email**
  1. Go to recipient's inbox
  2. Open the test email you sent
  3. Click "Reply"
  4. Write: "Thank you! I'm interested."
  5. Send reply

- [ ] **Wait for n8n to process**
  - IMAP checks every 1-2 minutes
  - Watch n8n executions page
  - Should see "FlowLane Email Receiver" execution

- [ ] **Check execution was successful**
  - Click execution in n8n
  - Should see green success indicators
  - HTTP Request should return 200 with cardId

- [ ] **Verify reply in mailbox**
  1. Refresh/reopen card in app
  2. Click "📬 Mailbox" (badge should show 2)
  3. Should see 2 emails:
     - 📤 Sent: Your original
     - 📥 Received: Client's reply
  4. Click received email
  5. Should have "↩️ Reply" button

**If reply doesn't appear:**
- Check n8n execution log for errors
- Verify IMAP credentials are correct
- Check email's "From" address matches card's '電郵' field

## Phase 7: Test Reply Chain (5 minutes)

- [ ] **Reply to the client again**
  1. Click "↩️ Reply" on received email
  2. Edit subject/body
  3. Send

- [ ] **Verify in mailbox**
  - Should now show 3 emails
  - Threading should be preserved

- [ ] **Reply from client again**
  - Client replies to your second email
  - Should appear in mailbox automatically

## Final Verification

### ✅ System is Fully Working When:

- [ ] Can send emails from cards
- [ ] Sent emails appear in mailbox with 📤 badge
- [ ] Emails arrive in client inbox
- [ ] Client replies are detected by n8n
- [ ] Replies appear in card mailbox with 📥 badge
- [ ] Mailbox badge shows correct count
- [ ] Can click any email to view details
- [ ] Can reply to received emails
- [ ] Reply chain is tracked correctly

### 🎉 Congratulations!

You now have a complete email system with:
- ✅ Send templated emails
- ✅ Automatic email logging
- ✅ Receive client replies
- ✅ Complete mailbox per card
- ✅ Reply threading
- ✅ Email history tracking

---

## Troubleshooting Quick Reference

| Issue | Check | Fix |
|-------|-------|-----|
| Can't send email | N8N_EMAIL_URL set? | Add to .env.local and restart |
| Email sent but not in mailbox | CardId included? | Check CardModal sends cardId |
| n8n webhook 404 | Workflow active? | Activate workflow in n8n |
| Gmail auth fails | App password? | Generate in Gmail settings |
| Reply not appearing | IMAP working? | Check credentials & execution log |
| Reply goes to wrong card | Email match? | Check '電郵' field matches sender |
| No Message-ID | Header added? | Add Message-ID in Gmail node options |

---

## What to Do Next

### For Production Use:

1. **Create more templates**
   - Follow-up emails
   - Appointment confirmations
   - Status updates
   - Closing messages

2. **Set up stage automation**
   - Move cards when emails sent
   - Move cards when replies received
   - Track "waiting for reply" status

3. **Add team notifications**
   - Slack alerts for new replies
   - Email summaries
   - Daily reports

4. **Monitor email metrics**
   - Response rates
   - Average response time
   - Communication volume

5. **Train your team**
   - How to use mailbox
   - How to use templates
   - Email best practices

---

## Support & Documentation

- **Full Setup Guide:** `/EMAIL_SETUP_GUIDE.md`
- **Architecture Diagram:** `/EMAIL_SYSTEM_ARCHITECTURE.md`
- **n8n Integration:** `/N8N_INTEGRATION.md`
- **Test Send Email API:** Visit `/api/send-email`
- **Test Receive Email API:** Visit `/api/receive-email`

---

**Time to complete:** ~70 minutes
**Difficulty:** Intermediate
**Result:** Complete email communication system with automatic tracking

**Good luck!** 🚀
