# Finding Message-ID Header in n8n SMTP Node - Visual Guide

## Current n8n SMTP Node Layout

The SMTP "Send Email" node in n8n has evolved. Here's where to find the Message-ID header setting:

### Step-by-Step Visual Location

```
┌─────────────────────────────────────────────────────────┐
│  Send Email (SMTP) Node                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─ PARAMETERS ────────────────────────────────────┐   │
│  │                                                   │   │
│  │  From Email:  student.system@klobsterltd.com    │   │
│  │                                                   │   │
│  │  To Email:    ={{ $json.to }}                   │   │
│  │                                                   │   │
│  │  Subject:     ={{ $json.subject }}              │   │
│  │                                                   │   │
│  │  Email Type:  ⦿ Text   ○ HTML                   │   │
│  │                                                   │   │
│  │  Text:        ={{ $json.body }}                 │   │
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ OPTIONS ────────────────────────────────────────┐   │
│  │                                                   │   │
│  │  [+] Add Option                                  │   │  ← CLICK HERE!
│  │                                                   │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### What Happens When You Click "Add Option"

```
┌──────────────────────────────────────┐
│  Add Option Menu                      │
├──────────────────────────────────────┤
│  ○ Append n8n Attribution           │
│  ○ Attachments                       │
│  ○ BCC                               │
│  ○ CC                                │
│  ○ Headers                           │  ← SELECT THIS!
│  ○ Ignore SSL Issues                │
│  ○ Reply To                          │
└──────────────────────────────────────┘
```

### After Selecting "Headers"

```
┌─────────────────────────────────────────────────────────┐
│  OPTIONS                                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Headers                                                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │  [+] Add Header                                   │  │  ← CLICK HERE!
│  └───────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### After Clicking "Add Header"

```
┌─────────────────────────────────────────────────────────┐
│  OPTIONS                                                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Headers                                                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Header 1                                         │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │ Name:  Message-ID                            │ │  │  ← TYPE THIS
│  │  └─────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │ Value: ={{ $json.emailId }}                 │ │  │  ← TYPE THIS
│  │  └─────────────────────────────────────────────┘ │  │
│  │                                                   │  │
│  │  [+] Add Header                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Complete Configuration Checklist

### 1. Basic SMTP Settings (Top Section)

```
From Email:  student.system@klobsterltd.com
To Email:    ={{ $json.to }}
Subject:     ={{ $json.subject }}
Email Type:  Text
Text:        ={{ $json.body }}
```

### 2. Options Section (Bottom Section)

```
Click: [+] Add Option
Select: Headers
Click: [+] Add Header
  Name:  Message-ID
  Value: ={{ $json.emailId }}
```

## If You Can't Find "Headers" Option

### Alternative 1: Check n8n Version

n8n might need updating. Check your version:
- Go to n8n → Settings → About
- Version should be **1.0+**
- If older, update n8n

### Alternative 2: Use Different Node

If SMTP doesn't have Headers, try these alternatives:

#### Option A: Email Send (Different SMTP Node)

Some n8n instances have multiple email nodes:
1. Search for "Email" in nodes
2. Try "Email Send" instead of "Send Email (SMTP)"
3. This might have different options

#### Option B: HTTP Request with SMTP

Use raw SMTP commands:
1. **Add Node → HTTP Request**
2. This gives full control over headers
3. More complex but guaranteed to work

#### Option C: Gmail API (Even for Custom Domain)

If your custom domain uses Google Workspace:
1. **Add Node → Gmail → Send Email**
2. **Authenticate** with your Google Workspace account
3. **In Options:**
   - Look for "Headers" or "Additional Options"
   - Should have better header support than SMTP

## Testing If Message-ID Works

### Test 1: Send Email from App

1. Open a card
2. Click "📧 Send Email"
3. Send to yourself
4. Check if email arrives

### Test 2: Check Email Headers

1. **Open received email**
2. **Gmail:** Click ⋮ → "Show original"
3. **Search for:** `Message-ID`
4. **Should see:**
   ```
   Message-ID: <email_1234567890_abc123>
   ```

If you see the custom Message-ID, it's working! ✅

If you see a different Message-ID (like `CAF...@mail.gmail.com`), it's NOT working. ❌

### Test 3: Test Reply Matching

1. **Reply to the test email**
2. **Check email headers again**
3. **Should see:**
   ```
   In-Reply-To: <email_1234567890_abc123>
   ```

This is what allows reply tracking!

## What If Headers Don't Work?

If you absolutely cannot add Message-ID header in SMTP node, here's a workaround:

### Workaround: Use Subject-Based Matching

We can modify the app to match by subject line instead of Message-ID:

1. **Modify subject to include card ID:**
   ```
   Subject: 歡迎 Test Shop [#abc123]
   ```

2. **Update receive-email API** to match by subject
   - Parse `[#cardId]` from subject
   - Match directly to card

**This is less reliable but will work without Message-ID!**

Let me know if you need help implementing this workaround.

## Screenshot Locations

If you're still stuck, take screenshots of:

1. **Your SMTP node configuration:**
   - Show the entire node
   - Show Parameters section
   - Show Options section (if any)

2. **Your n8n version:**
   - Settings → About
   - Show version number

3. **Available node options:**
   - What you see when you click "Add Option"

Send these and I can provide exact instructions for your setup!

## Quick Decision Tree

```
Can you find "Options" section in SMTP node?
│
├─ YES → Click "+ Add Option"
│        │
│        └─ Can you see "Headers" in the menu?
│           │
│           ├─ YES → Perfect! Add Message-ID header there ✅
│           │
│           └─ NO → Try "Custom Headers" or "Additional Headers"
│                   │
│                   ├─ Found it → Add Message-ID ✅
│                   │
│                   └─ Still no → Use workaround (subject-based) ⚠️
│
└─ NO → Your n8n version might be old
        │
        ├─ Can you update n8n? → Update and try again
        │
        └─ Can't update → Use Gmail API node or HTTP Request node
```

## Next Steps

1. ✅ **First, try finding "Options → Headers"** in SMTP node
2. ✅ **If found:** Add Message-ID header with value `={{ $json.emailId }}`
3. ✅ **Test by sending email** and checking "Show original"
4. ❌ **If can't find:** Let me know and I'll provide alternative solutions

**The goal is to see `Message-ID: <email_1234567890_abc123>` in sent emails!**
