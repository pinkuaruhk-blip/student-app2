# n8n Email Sending Setup for Custom Domain Email

## Using SMTP Node for Custom Domain (student.system@klobsterltd.com)

Since you're using a custom domain email, you need to use the **SMTP node** instead of Gmail node.

### Step 1: Get Your SMTP Settings

First, you need your SMTP server details. For Google Workspace (G Suite) custom domains:

```
Host: smtp.gmail.com
Port: 587
Security: TLS
Username: student.system@klobsterltd.com
Password: Your app-specific password (NOT your regular password)
```

### Step 2: Generate App Password

1. Go to Google Account settings: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Scroll down to **App passwords**
4. Click **App passwords**
5. Select **Mail** and **Other (Custom name)**
6. Name it: "n8n Email Sender"
7. Click **Generate**
8. **COPY THE PASSWORD** (shown once, looks like: `abcd efgh ijkl mnop`)

### Step 3: Configure n8n Workflow

#### 3.1: Webhook Trigger

1. **Add Node → Trigger → Webhook**
2. Configure:
   ```
   HTTP Method: POST
   Path: send-email
   Response Mode: When Last Node Finishes
   ```
3. **Save** and copy webhook URL

#### 3.2: SMTP Send Email Node

1. **Add Node → Action → Send Email (SMTP)**
2. **Connect to Webhook node**

3. **Create SMTP Credentials:**
   - Click "Create New Credential"
   - Fill in:
     ```
     User: student.system@klobsterltd.com
     Password: [paste app password from Step 2]
     Host: smtp.gmail.com
     Port: 587
     SSL/TLS: Enable
     ```
   - Click "Save"

4. **Configure SMTP Node Fields:**

   **From Email:**
   ```
   student.system@klobsterltd.com
   ```

   Or to include a name:
   ```
   Student System <student.system@klobsterltd.com>
   ```

   **To Email:**
   ```
   ={{ $json.to }}
   ```

   **Subject:**
   ```
   ={{ $json.subject }}
   ```

   **Email Type:** Select `Text`

   **Text:**
   ```
   ={{ $json.body }}
   ```

5. **Add Message-ID Header (CRITICAL FOR REPLY TRACKING):**

   In the SMTP node, look for these sections:

   **Option 1: If you see "Additional Fields" or "Options":**
   - Click "Add Field" or "Add Option"
   - Look for "Headers" or "Additional Headers"
   - Add:
     ```
     Name: Message-ID
     Value: ={{ $json.emailId }}
     ```

   **Option 2: If there's a "Headers" section:**
   - Click "Add Header"
   - Name: `Message-ID`
   - Value: `={{ $json.emailId }}`

   **Option 3: If there's a JSON editor for headers:**
   ```json
   {
     "Message-ID": "={{ $json.emailId }}"
   }
   ```

### Step 4: Test the Workflow

1. **Save workflow**
2. **Activate it** (toggle to ON)
3. **Test from your app:**
   - Open a card
   - Click "📧 Send Email"
   - Check if email arrives at recipient
   - Check n8n execution log for any errors

### Step 5: Verify Message-ID is Being Set

After sending a test email:

1. **Check the email in recipient's inbox**
2. **Click the three dots (⋮) → "Show original"**
3. **Search for "Message-ID"** in the raw email
4. **Should see:** `Message-ID: <email_1234567890_abc123>`

If you don't see this, replies won't be tracked properly!

---

## Complete n8n Workflow Structure

```
┌─────────────────────────────────────────────────────────┐
│  Webhook Trigger                                         │
│  Path: /webhook/send-email                              │
│  Receives:                                               │
│  {                                                       │
│    "to": "client@example.com",                          │
│    "from": "system",                                    │
│    "subject": "歡迎 ...",                               │
│    "body": "Email content...",                          │
│    "cardId": "abc123",                                  │
│    "emailId": "email_1234567890_xyz"  ← IMPORTANT!     │
│  }                                                       │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  SMTP Send Email Node                                    │
│  Credentials:                                            │
│    Host: smtp.gmail.com                                 │
│    Port: 587                                            │
│    User: student.system@klobsterltd.com                 │
│    Pass: [app password]                                 │
│                                                          │
│  Configuration:                                          │
│    From: student.system@klobsterltd.com                 │
│    To: {{ $json.to }}                                   │
│    Subject: {{ $json.subject }}                         │
│    Text: {{ $json.body }}                               │
│    Headers:                                             │
│      Message-ID: {{ $json.emailId }}  ← CRITICAL!      │
└─────────────────────────────────────────────────────────┘
```

---

## Troubleshooting SMTP

### Error: "Authentication failed"
**Solution:**
- Make sure you're using an **app password**, not your regular password
- Enable 2-Step Verification first
- Generate new app password

### Error: "Connection refused" or "ECONNREFUSED"
**Solution:**
- Check port is 587 (not 465 or 25)
- Ensure TLS/SSL is enabled
- Check firewall isn't blocking SMTP

### Error: "Invalid sender address"
**Solution:**
- Make sure "From Email" is exactly: `student.system@klobsterltd.com`
- Don't use quotes around the email

### Emails sending but Message-ID not working
**Solution:**
1. Check n8n SMTP node has Headers section
2. Verify syntax is: `={{ $json.emailId }}` (with equals sign)
3. Test by viewing "Show original" in received email
4. Message-ID should appear in email headers

---

## Alternative: If SMTP Headers Don't Work

If the SMTP node doesn't support custom headers, you have two options:

### Option A: Use Gmail API Node Instead

Even though you have a custom domain, if it's hosted on Google Workspace, you can use Gmail API:

1. **Add Node → Gmail → Send Email**
2. **Connect using OAuth** (authorize your Google Workspace account)
3. **In "Additional Fields":**
   - Click "Add Field"
   - Select "BCC" or another field
   - Look for "Headers" or "Additional Headers"
   - Add Message-ID header there

### Option B: Use HTTP Request to Gmail API

More complex but has full control:

1. **Add Node → HTTP Request**
2. **Method:** POST
3. **URL:** `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`
4. **Authentication:** OAuth2
5. **Body:** Raw email with headers

**This is more advanced - try Option A first!**

---

## What to Check Right Now

1. **Do you have 2-Step Verification enabled?**
   - If no: Enable it at https://myaccount.google.com/security

2. **Have you generated an app password?**
   - If no: Go to https://myaccount.google.com/apppasswords

3. **Are you using the app password in n8n?**
   - NOT your regular password!

4. **Is your SMTP node configured with:**
   - Host: `smtp.gmail.com`
   - Port: `587`
   - TLS/SSL: Enabled
   - User: `student.system@klobsterltd.com`
   - Pass: `[16-character app password]`

5. **Can you find where to add headers in the SMTP node?**
   - Look for "Options", "Additional Fields", or "Headers"
   - Send me a screenshot if you can't find it

---

## Quick Test Command

To test if SMTP is working at all (without n8n):

```bash
# Test SMTP connection
curl --url 'smtps://smtp.gmail.com:587' \
  --ssl-reqd \
  --mail-from 'student.system@klobsterltd.com' \
  --mail-rcpt 'test@example.com' \
  --user 'student.system@klobsterltd.com:[app-password]' \
  -T - <<EOF
From: student.system@klobsterltd.com
To: test@example.com
Subject: Test

Test email
EOF
```

If this works, your SMTP credentials are correct!

---

## Next Steps

1. **Set up SMTP node** with credentials above
2. **Find where to add Message-ID header** (check "Options" or "Headers" section)
3. **Send a test email** from your app
4. **Check "Show original"** in received email to verify Message-ID
5. **Let me know if you can't find the Headers section** - I can provide alternative solutions

**The Message-ID header is crucial for reply tracking - without it, incoming replies won't be matched to the original email thread!**
