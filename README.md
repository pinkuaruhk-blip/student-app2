# FlowLane: Kanban Board with InstantDB

A lightweight workflow app built with Next.js, InstantDB, and n8n automations. Features real-time collaboration, custom fields, form integration, and email automation.

## Features

- ✅ **Kanban Board**: Drag-and-drop cards between stages with real-time updates
- ✅ **Multiple Pipes**: Create and manage multiple workflows
- ✅ **Custom Fields**: Add custom fields to cards (text, number, date, select, file)
- ✅ **Magic Link Auth**: Passwordless authentication via email
- ✅ **Form Integration**: Formbricks webhook integration to create cards from forms
- ✅ **Email Automation**: n8n workflows for email inbox monitoring and notifications
- ✅ **Real-time Sync**: InstantDB provides instant updates across all clients
- ✅ **Owner-only Access**: Secure permissions with single-user setup

## Tech Stack

- **Frontend**: Next.js 15 + React 19 + Tailwind CSS
- **Database**: InstantDB (reactive, real-time database)
- **Auth**: InstantDB magic-code email authentication
- **Drag & Drop**: @dnd-kit/core
- **Forms**: Formbricks (external, webhook-based)
- **Automations**: n8n (self-hosted or cloud)

## Prerequisites

- Node.js 20+ and npm
- InstantDB account (free tier available)
- n8n instance (optional, for automations)
- Formbricks account (optional, for form integration)

## Quick Start

### 1. Clone and Install

```bash
npm install
```

### 2. Set up InstantDB

1. Go to [instantdb.com](https://instantdb.com) and create an account
2. The app is already configured with App ID: `f0827431-76de-4f51-a2c3-bae2e1558bcc`
3. Get your Admin API key from the InstantDB dashboard

### 3. Push the Schema

Install the InstantDB CLI and push the schema:

```bash
npm install -g @instantdb/cli
npx instant-cli push schema --file instant.schema.ts
```

### 4. Configure Permissions

Push the permissions rules:

```bash
npx instant-cli push perms --file instant.perms.ts
```

### 5. Environment Variables

Create a `.env.local` file in the project root:

```env
# InstantDB
NEXT_PUBLIC_INSTANT_APP_ID=f0827431-76de-4f51-a2c3-bae2e1558bcc
INSTANT_ADMIN_KEY=your-admin-key-here

# Owner email (for permissions)
OWNER_EMAIL=your-email@example.com

# n8n (optional)
N8N_EVENTS_URL=https://your-n8n-instance.com/webhook/events

# Formbricks (optional)
FORMBRICKS_SHARED_SECRET=your-shared-secret
```

### 6. Run the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and sign in with your email.

## Project Structure

```
flowlane/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Home page with auth redirect
│   │   ├── pipes/
│   │   │   ├── page.tsx          # Pipes list page
│   │   │   └── [id]/page.tsx    # Kanban board
│   │   ├── settings/
│   │   │   └── page.tsx          # Stage management
│   │   └── api/
│   │       ├── intake/formbricks/route.ts  # Formbricks webhook
│   │       └── events/route.ts             # Events forwarding to n8n
│   ├── components/
│   │   └── auth-provider.tsx    # Auth components
│   └── lib/
│       └── db.ts                 # InstantDB client
├── instant.schema.ts             # InstantDB schema definition
├── instant.perms.ts              # Permissions rules
├── n8n-workflows/                # n8n workflow templates
│   ├── formbricks_intake.json
│   ├── email_inbox.json
│   └── events_bus.json
└── README.md
```

## InstantDB Schema

The schema defines 5 entities:

- **pipes**: Workflow pipelines
- **stages**: Columns within a pipe (with position for ordering)
- **cards**: Items in the workflow
- **card_fields**: Custom fields attached to cards
- **card_comments**: Comments on cards (for email integration)

Relationships are defined with links (one-to-many):
- Pipe → Stages
- Pipe → Cards
- Stage → Cards
- Card → Fields
- Card → Comments

## Authentication

The app uses InstantDB's magic-code authentication:

1. User enters email on login page
2. InstantDB sends a magic link via email
3. Clicking the link authenticates the user
4. Permissions restrict writes to the owner email only

## API Routes

### POST /api/intake/formbricks

Receives Formbricks form submissions and creates cards.

**Headers:**
- `X-FORMBRICKS-SECRET`: Shared secret for authentication

**Body:**
```json
{
  "pipeId": "pipe-id",
  "stageId": "stage-id",
  "title": "Card Title",
  "description": "Optional description",
  "fields": [
    { "key": "email", "type": "text", "value": "user@example.com" },
    { "key": "priority", "type": "select", "value": "high" }
  ]
}
```

### POST /api/events

Receives events from the frontend and forwards them to n8n.

**Body:**
```json
{
  "event": "card.moved",
  "cardId": "card-id",
  "pipeId": "pipe-id",
  "newStageId": "stage-id"
}
```

## n8n Workflows

### 1. Formbricks Intake (`formbricks_intake.json`)

- Receives Formbricks webhook
- Maps form data to card structure
- Calls `/api/intake/formbricks`
- Optionally sends confirmation email

**Setup:**
1. Import workflow to n8n
2. Configure webhook URL in Formbricks
3. Set environment variables: `NEXT_API_URL`, `FORMBRICKS_SHARED_SECRET`

### 2. Email Inbox Monitor (`email_inbox.json`)

- Polls Gmail inbox for new emails
- Extracts card ID from subject line `[CARD:xxx]`
- Creates comment on the card
- Handles email attachments

**Setup:**
1. Import workflow to n8n
2. Configure Gmail credentials
3. Adjust email filters as needed
4. Set up comment API endpoint (optional feature)

### 3. Events Bus (`events_bus.json`)

- Receives events from `/api/events`
- Routes events by type
- Optionally sends to Slack, Gmail, or Google Sheets

**Setup:**
1. Import workflow to n8n
2. Configure the webhook URL in `.env.local` (`N8N_EVENTS_URL`)
3. Enable desired notification channels

## Formbricks Integration

1. Create a form in Formbricks with conditional logic and file upload
2. Add these hidden fields to capture pipe/stage info:
   - `pipeId`
   - `stageId`
3. Configure webhook in Formbricks settings:
   - URL: `https://your-domain.com/api/intake/formbricks`
   - Header: `X-FORMBRICKS-SECRET: your-shared-secret`

## Deployment

### Deploy to Vercel

```bash
npm run build
vercel deploy
```

Make sure to set all environment variables in Vercel dashboard.

### Important Notes

- InstantDB free tier: 1 GB storage, unlimited API requests
- Port 3000 is forwarded to the web in Vibecode sandbox
- Schema changes require running `instant-cli push schema`
- Permissions changes require running `instant-cli push perms`

## Development

### Adding a New Field Type

1. Update the `card_fields` entity schema if needed
2. Add rendering logic in the card drawer modal
3. Update the Formbricks intake mapping

### Adding a New Event Type

1. Emit the event in the UI (call `/api/events`)
2. Update the Events Bus workflow to handle it
3. Add notification logic (Slack, email, etc.)

## Troubleshooting

### InstantDB Connection Issues

- Verify `NEXT_PUBLIC_INSTANT_APP_ID` is set correctly
- Check that schema has been pushed: `instant-cli push schema`
- Ensure permissions are configured: `instant-cli push perms`

### Authentication Not Working

- Check that you're using the correct owner email in `.env.local`
- Verify `OWNER_EMAIL` matches your login email
- Check InstantDB dashboard for auth logs

### Formbricks Webhook Failing

- Verify `X-FORMBRICKS-SECRET` header matches `.env.local`
- Check `INSTANT_ADMIN_KEY` is set in `.env.local`
- Review API route logs for errors

### n8n Workflows Not Triggering

- Verify `N8N_EVENTS_URL` is set correctly
- Check n8n webhook is active and accessible
- Review n8n execution logs

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Resources

- [InstantDB Documentation](https://instantdb.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [n8n Documentation](https://docs.n8n.io)
- [Formbricks Documentation](https://formbricks.com/docs)
