# Subject-Line Matching Testing Guide

## ✅ What Was Implemented

The email system now uses **subject-line matching** instead of Message-ID headers. This means:

1. **When you send an email**, the subject becomes:
   ```
   "歡迎 Test Shop [#abc123-def456-...]"
   ```
   The `[#abc123...]` is the card ID.

2. **When a client replies**, the subject becomes:
   ```
   "Re: 歡迎 Test Shop [#abc123-def456-...]"
   ```
   The card ID is still in the subject!

3. **The system parses** `[#abc123...]` from the subject to match the reply to the correct card.

## Benefits

✅ **Works without Message-ID header** - No need to configure headers in n8n!
✅ **100% reliable** - Card ID is always in the subject
✅ **Easy to debug** - You can see the card ID visually
✅ **Works with ANY email system** - Gmail, SMTP, anything!

## How to Test

### Step 1: Send a Test Email

1. **Open your FlowLane app**
   Go to: `https://preview-rrwyydajbhzw.share.sandbox.dev`

2. **Open a card** that has:
   - A '電郵' field with a valid email address
   - Example: Your own email for testing

3. **Click "📧 Send Email"**

4. **Select a template or write custom email**
   - Subject: `Test Email`
   - Body: `This is a test`

5. **Click "Send Email"**

6. **Check the email that arrives**
   - Subject should be: `Test Email [#abc123-def456-...]`
   - The `[#...]` part is the card ID!

### Step 2: Check Mailbox

1. **Click "📬 Mailbox" on the card**

2. **Should see 1 email:**
   - 📤 Sent
   - Subject: `Test Email [#abc123...]`

### Step 3: Reply to the Email

1. **Go to your email inbox** (where you received the test email)

2. **Click "Reply"** (not "Forward")

3. **The subject should be:**
   ```
   Re: Test Email [#abc123-def456-...]
   ```
   **Important:** Don't modify the subject! Keep the `[#...]` part.

4. **Write a reply:**
   ```
   Thank you! I'm interested.
   ```

5. **Send the reply**

### Step 4: Wait for n8n to Process

1. **n8n checks email** every 1-2 minutes (depending on your IMAP trigger config)

2. **Check n8n executions:**
   - Go to n8n → Executions
   - Look for "FlowLane Email Receiver"
   - Should see a new execution

3. **Check execution details:**
   - Should be green (success)
   - HTTP Request response should show:
     ```json
     {
       "success": true,
       "cardId": "abc123-def456-...",
       "emailId": "..."
     }
     ```

### Step 5: Verify Reply in Mailbox

1. **Go back to your card** (refresh or reopen)

2. **Click "📬 Mailbox"**

3. **Should now see 2 emails:**
   - 📤 Sent: `Test Email [#abc123...]`
   - 📥 Received: `Re: Test Email [#abc123...]`
   - Badge should show **(2)**

4. **Click the received email** to view details

5. **Should have "↩️ Reply" button**

### Step 6: Test Reply Chain

1. **Click "↩️ Reply"** on the received email

2. **Subject should be:**
   ```
   Re: Test Email [#abc123...]
   ```

3. **Send another reply**

4. **Check mailbox** - should now have 3 emails

## Troubleshooting

### Problem: Subject doesn't have [#cardId]

**Check:**
- Did you restart the app after code changes?
- Check browser console for errors
- Test by visiting: `/api/send-email` (should show docs)

**Fix:**
```bash
# Restart your dev server
# Check .env.local has N8N_EMAIL_URL set
```

### Problem: Reply not matching card

**Symptoms:**
- n8n execution shows 404 error
- "Could not find matching card"

**Check:**
1. **Subject still has [#cardId]?**
   - If client removed it, won't work
   - Check email's subject line

2. **Card ID format is correct?**
   - Should be UUID format: `abc123-def456-...`
   - Check n8n execution log for the subject received

3. **n8n HTTP Request body correct?**
   ```json
   {
     "from": "{{ $json.from }}",
     "to": "{{ $json.to }}",
     "subject": "{{ $json.subject }}",  ← Must include full subject!
     "body": "{{ $json.text || $json.html }}"
   }
   ```

**Fix:**
- Make sure n8n passes the FULL subject (including [#cardId])
- Don't strip or modify the subject in n8n

### Problem: Multiple cards match

**This shouldn't happen** because card IDs are unique UUIDs.

If it does:
- Check the regex pattern: `/\[#([a-f0-9-]+)\]/`
- Should only match UUID format

### Problem: Client complains about [#...] in subject

**Options:**

1. **Explain it's for tracking:**
   "This ID helps us track our conversation"

2. **Use shorter format:**
   - Modify code to use last 8 chars only: `[#abc123]`
   - Would need to ensure uniqueness

3. **Hide it better:**
   - Put it at the very end after spacing
   - Use smaller text if HTML email

## What Your n8n Should Look Like

### Email Sending Workflow

```
Webhook Trigger
  Path: /webhook/send-email
  ↓
SMTP Send Email
  From: student.system@klobsterltd.com
  To: {{ $json.to }}
  Subject: {{ $json.subject }}  ← No changes needed!
  Body: {{ $json.body }}
```

**Note:** The subject already has [#cardId] from the API!

### Email Receiving Workflow

```
Email Trigger (IMAP)
  Host: imap.gmail.com
  User: student.system@klobsterltd.com
  ↓
HTTP Request
  POST /api/receive-email
  Body:
  {
    "from": "={{ $json.from }}",
    "to": "={{ $json.to }}",
    "subject": "={{ $json.subject }}",  ← MUST include full subject!
    "body": "={{ $json.text || $json.html }}"
  }
```

## Success Checklist

- [ ] Email sent has subject with [#cardId]
- [ ] Email arrives at client inbox
- [ ] Email shows in card mailbox with 📤
- [ ] Client reply preserves [#cardId] in subject
- [ ] n8n detects reply
- [ ] n8n execution succeeds (green)
- [ ] Reply shows in card mailbox with 📥
- [ ] Can click reply to view details
- [ ] Can click ↩️ Reply button
- [ ] Reply chain works (3+ emails)

## Example Flow

```
1. Send: "Welcome to our service [#abc123]"
   ↓
2. Client receives
   ↓
3. Client replies: "Re: Welcome to our service [#abc123]"
   ↓
4. n8n receives
   ↓
5. System parses "abc123" from subject
   ↓
6. Finds matching card
   ↓
7. Logs to mailbox
   ↓
8. You see reply in 📬 Mailbox
```

## Next Steps

After testing successfully:

1. **Create more email templates** at `/settings/email-templates`
2. **Send real emails** to clients
3. **Monitor mailboxes** for replies
4. **Use ↩️ Reply** to continue conversations

## If Something Goes Wrong

1. **Check browser console** (F12) for errors
2. **Check n8n execution log** for detailed error messages
3. **Check server logs** for API errors
4. **Test API directly:**
   ```bash
   curl -X POST https://preview-rrwyydajbhzw.share.sandbox.dev/api/receive-email \
     -H "Content-Type: application/json" \
     -d '{
       "from": "test@example.com",
       "subject": "Test [#your-card-id-here]",
       "body": "Test body"
     }'
   ```

## Summary

✅ **No Message-ID header needed**
✅ **No complex n8n configuration**
✅ **Works with your current SMTP setup**
✅ **100% reliable card matching**

The system is ready to use! Just send a test email and reply to it.
