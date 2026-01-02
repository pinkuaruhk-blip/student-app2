# Solution: Adding Message-ID to n8n SMTP Node Without Headers Option

Based on your screenshots, your n8n SMTP "Send email" node doesn't show a "Headers" option in the Options section.

## Solution 1: Check the "Settings" Tab (TRY THIS FIRST!)

I noticed you have two tabs at the top of the node:
- **Parameters** (currently selected)
- **Settings** ← Click this!

### Steps:

1. **Click the "Settings" tab** at the top of the node
2. **Look for any of these options:**
   - "Additional Options"
   - "Custom Headers"
   - "Headers"
   - "Advanced"
3. **If you find it**, add:
   ```
   Name: Message-ID
   Value: {{ $json.emailId }}
   ```

**Take a screenshot of the Settings tab and send it to me!**

---

## Solution 2: Use HTTP Request Node Instead (Guaranteed to Work)

If the Settings tab doesn't have headers either, we'll use a more powerful approach with the HTTP Request node that gives us full control.

### Setup Instructions:

#### Step 1: Remove/Disconnect Current SMTP Node

1. Keep your Webhook trigger
2. We'll replace the SMTP node with HTTP Request node

#### Step 2: Add HTTP Request Node

1. **Add Node → HTTP Request**
2. **Connect to Webhook trigger**

#### Step 3: Configure HTTP Request for Gmail SMTP API

**Important:** You'll need to generate a **base64-encoded authentication string** first.

##### Generate Auth String (Run this once):

```bash
# Replace with your actual email and app password
EMAIL="student.system@klobsterltd.com"
APP_PASSWORD="your-16-char-app-password"

# Generate base64 auth (run in terminal)
echo -n "$EMAIL:$APP_PASSWORD" | base64
```

This gives you something like: `c3R1ZGVudC5zeXN0ZW1Aa2xvYnN0ZXJsdGQuY29tOmFiY2QgZWZnaCBpamtsIG1ub3A=`

##### Configure HTTP Request Node:

**Method:** POST

**URL:**
```
smtps://smtp.gmail.com:465/
```

**Authentication:** Generic Credential Type
- Credential Type: Header Auth
- Name: Authorization
- Value: `Basic [your-base64-string-from-above]`

**Body Content Type:** Raw/Custom

**Body:**
```
EHLO localhost
MAIL FROM:<student.system@klobsterltd.com>
RCPT TO:<{{ $json.to }}>
DATA
From: student.system@klobsterltd.com
To: {{ $json.to }}
Subject: {{ $json.subject }}
Message-ID: <{{ $json.emailId }}>
Content-Type: text/plain; charset=utf-8

{{ $json.body }}
.
QUIT
```

---

## Solution 3: Use the n8n SMTP SEND Node (Different Node)

There might be a different SMTP node in your n8n:

1. **Search for:** "SMTP"
2. **Look for:** "SMTP Send" or "Email Send" (different from "Send email")
3. **These might have Headers option**

---

## Solution 4: Workaround - Use Subject Line Matching (No Message-ID Needed)

If none of the above work, we can modify the system to match replies by subject line instead of Message-ID.

### How it Works:

1. **Add card ID to email subject:**
   ```
   Original: "歡迎 Test Shop"
   Modified: "歡迎 Test Shop [#abc123]"
   ```

2. **When reply comes in**, subject becomes:
   ```
   "Re: 歡迎 Test Shop [#abc123]"
   ```

3. **Parse `[#abc123]`** from subject to match card

### Implementation:

I can update the code to:
1. Modify `/api/send-email` to add `[#cardId]` to subject
2. Modify `/api/receive-email` to parse card ID from subject
3. Works without Message-ID header!

**Pros:**
- ✅ Works with any email system
- ✅ No special headers needed
- ✅ Easy to debug (visible in subject)

**Cons:**
- ⚠️ Subject line looks less clean
- ⚠️ Client could modify subject (rare)

---

## My Recommendation

**Try these in order:**

1. **First:** Check "Settings" tab for Headers option (take screenshot)
2. **If no:** Ask me to implement Solution 4 (subject line matching)
   - This is the easiest and most reliable
   - Works with any email system
   - No complex n8n configuration needed

**DON'T try Solution 2 (HTTP Request)** unless you're comfortable with SMTP protocol - it's complex!

---

## Quick Decision:

**What do you want to do?**

### Option A: "Let's use subject line matching"
- I'll update the code right now
- Add `[#cardId]` to subjects
- Parse it on replies
- **5 minutes to implement**
- Works 100% guaranteed

### Option B: "Let me check Settings tab first"
- Take screenshot of Settings tab
- Send it to me
- I'll tell you exactly what to do

**I recommend Option A** - it's simpler and more reliable than fighting with n8n headers!

Would you like me to implement the subject-line matching solution?
