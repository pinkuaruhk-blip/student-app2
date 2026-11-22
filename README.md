# FlowLane

FlowLane is a private, staff-only Kanban app for student-offer application pipelines.

Staff manage **pipes** (pipelines), **stages** (columns) and **cards** (applications). Each card has custom fields, comments, email and SMS threads, client forms and a stage history. n8n creates and moves cards. Automations send email (Resend) and SMS (Twilio). Clients fill in forms through a public link, `/form/[cardId]/[formId]`, without signing in. Uploads are stored in Vercel Blob. The UI is translated with next-intl (English, Simplified Chinese, Traditional Chinese).

Production: https://flowlane.klobsterltd.com (Vercel).

## Tech stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4
- InstantDB 0.22: `@instantdb/react` in the browser, `@instantdb/admin` in API routes
- Resend (email), Twilio (SMS), Vercel Blob (file uploads)
- next-intl (translations in `messages/en.json`, `zh-CN.json`, `zh-TW.json`; the locale comes from the `NEXT_LOCALE` cookie, default `en`)
- @dnd-kit (drag and drop), Tiptap (rich-text editor)
- n8n (external) for card intake, card moves and inbound email

Package manager: npm (`package-lock.json`). Node.js 20.9 or later (required by Next.js 16).

## Commands

```bash
npm ci                                  # install dependencies
npm run dev                             # dev server on http://localhost:3000
npx tsc --noEmit --incremental false    # typecheck
npm run lint                            # ESLint
npm run build                           # production build
```

There is no test suite.

Note: a local `npm run dev` uses whatever InstantDB app `.env.local` points at. With the production app id, local runs read and write production data.

## Access model

**Sign-in.** Staff sign in with an InstantDB magic code: they enter their email and type the 6-digit code that Instant emails them (`src/components/auth-provider.tsx`). Before a code is sent, the app calls `/api/auth/check-email`, which only allows addresses in the comma-separated `ALLOWED_EMAILS` variable. If `ALLOWED_EMAILS` is not set, it denies everyone with a 503. A signed-in user whose email is not allowed is signed out.

**Browser data access.** `instant.perms.ts` makes every entity staff-only: reads and writes need a signed-in user whose email is in the `STAFF_EMAILS` list in that file. Everything not listed is denied (`$default: false`), and browsers cannot create new attributes. These rules only take effect after they are pushed (see below).

**Adding or removing a staff member** means changing both:

1. `ALLOWED_EMAILS` in the Vercel environment variables (then redeploy), and
2. `STAFF_EMAILS` in `instant.perms.ts`, then `npx instant-cli push perms --app <app id>`.

**API routes.** Routes use the Instant admin key, which bypasses the permission rules, so each route checks its caller with a guard from `src/lib/staff-auth.ts`:

| Guard | Who passes |
|---|---|
| `requireStaff` | A signed-in staff user. The browser sends its Instant refresh token as `Authorization: Bearer <token>` (use `staffFetch` from `src/lib/staff-fetch.ts`); the route verifies it with Instant and checks the email against `ALLOWED_EMAILS`. 503 if `ALLOWED_EMAILS` is unset. |
| `requireStaffOrServer` | Staff as above, or this server's own calls (header `x-flowlane-internal`, a key derived from `INSTANT_ADMIN_KEY`), or n8n (the n8n secret). |
| `requireN8nSecret` | Requests whose `X-FlowLane-Secret` header equals `N8N_SHARED_SECRET`. 503 if the variable is unset, 401 if the header is wrong. |
| `devOnly` | Local development only; returns 404 when `NODE_ENV` is `production`. |

Public by design (no guard): `auth/check-email`, `public-form/[cardId]/[formId]`, `upload-file`, `form-submission-automations/execute` and `resend/webhook`. These validate their input instead:

- `public-form` and `upload-file` only work for an existing card and client form that has not been submitted yet. Uploads are limited to 2 MB.
- `form-submission-automations/execute` only runs for a submission that exists and is less than 15 minutes old.
- `resend/webhook` verifies the Svix signature headers with `RESEND_WEBHOOK_SECRET`.

### API routes

All routes are under `src/app/api`. "GET (dev)" is a `devOnly` info endpoint.

| Route | Methods | Guard |
|---|---|---|
| `auth/check-email` | POST | public |
| `cards/move` | POST, GET (dev) | n8n secret |
| `cleanup` | GET | dev only |
| `debug-emails` | GET | dev only |
| `debug-settings` | GET, POST | dev only |
| `debug-template` | GET | dev only |
| `delete-all-cards` | POST | staff |
| `download/readme` | GET | dev only |
| `duplicate-pipe` | POST | staff |
| `email-templates` | GET, POST, DELETE | staff |
| `events` | POST | staff (forwards UI events to `N8N_EVENTS_URL`) |
| `execute-automations` | POST | staff or server |
| `form-submission-automations/execute` | POST | public (validated) |
| `formbricks-mappings` | GET, POST | staff (Formbricks-era leftover) |
| `intake/formbricks` | POST, GET | dev only (Formbricks-era leftover) |
| `intake/n8n` | POST, GET (dev) | n8n secret |
| `kanban-display` | GET, POST | staff |
| `logs` | GET | dev only |
| `n8n-fields` | GET, POST | staff |
| `public-form/[cardId]/[formId]` | GET, POST | public (validated) |
| `receive-email` | POST, GET (dev) | n8n secret |
| `resend/webhook` | POST, GET | public; POST is signature-verified, GET only reports whether the secret is set and the supported events |
| `send-email` | POST, GET (dev) | staff or server |
| `send-email-template` | POST, GET (dev) | staff or server |
| `send-form-link` | POST | staff |
| `send-sms` | POST | staff |
| `test-admin-db` | GET | dev only |
| `test-schema` | GET | dev only |
| `test-webhook` | GET | dev only |
| `upload-file` | POST | public (validated) |

## n8n

n8n calls these routes, always with the header `X-FlowLane-Secret: <N8N_SHARED_SECRET>`:

- `POST /api/intake/n8n`: create a card. `pipeId` and `stageId` come from the query string or the body; the title, description and fields come from the body (flat, nested under `data`, or a `fields` array).
- `POST /api/cards/move`: move a card. Body: `{ "cardId": "...", "stageId": "..." }`.
- `POST /api/receive-email`: log an inbound email on a card. The body needs `from`, `subject` and `body`; the card is taken from `cardId` or a `[#<card id>]` tag in the subject.

If `N8N_EVENTS_URL` is set, the app also posts `card.created`, `card.moved` and UI events (via `/api/events`) to that n8n webhook.

The `n8n-workflows/` folder holds three older workflow exports. They are not the live workflows, and the two that call the API do not send `X-FlowLane-Secret`:

- `formbricks_intake.json`: Formbricks-era; posts to `/api/intake/formbricks`, which is now dev-only. Outdated.
- `email_inbox.json`: Gmail trigger that posts comments to `/api/comments`, a route that does not exist. Outdated.
- `events_bus.json`: a webhook that receives the events above and routes them to Gmail, Slack or Google Sheets.

Formbricks is no longer used. The `intake/formbricks` route and the `settings/formbricks` page are leftovers.

## Environment variables

Set these in `.env.local` for local runs and in the Vercel dashboard for production. Values below are placeholders.

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_INSTANT_APP_ID` | yes | InstantDB app id. Most code falls back to the production id `f0827431-76de-4f51-a2c3-bae2e1558bcc` if unset. |
| `INSTANT_ADMIN_KEY` | yes | InstantDB admin key for API routes; also the source of the internal server key. |
| `ALLOWED_EMAILS` | yes | Comma-separated staff emails allowed to sign in and call staff routes. Unset means nobody gets in. |
| `N8N_SHARED_SECRET` | yes, for n8n | Value n8n must send in `X-FlowLane-Secret`. Unset means n8n routes return 503. |
| `RESEND_API_KEY` | yes, for email | Resend API key for outbound email. |
| `RESEND_WEBHOOK_SECRET` | yes, for delivery status | Verifies Resend webhook calls (delivery and bounce status). |
| `DEFAULT_FROM_EMAIL` | yes, for email, unless set in system settings | Default sender address. A value saved in the app's system settings takes precedence. |
| `DEFAULT_FROM_NAME` | no | Default sender name (system settings take precedence). |
| `TWILIO_ACCOUNT_SID` | yes, for SMS | Twilio account SID. |
| `TWILIO_AUTH_TOKEN` | yes, for SMS | Twilio auth token. |
| `TWILIO_PHONE_NUMBER` | yes, for SMS | Twilio sender number. |
| `BLOB_READ_WRITE_TOKEN` | yes, for uploads | Vercel Blob token for client form uploads. |
| `NEXT_PUBLIC_APP_URL` | recommended | Public base URL used in links in emails and automations (falls back to `http://localhost:3000` or the request origin). |
| `NEXT_PUBLIC_BASE_URL` | no | Fallback base URL for `send-form-link` when the request has no host header. |
| `N8N_EVENTS_URL` | no | n8n webhook that receives card and UI events. |
| `FORMBRICKS_SHARED_SECRET`, `FORMBRICKS_API_HOST`, `FORMBRICKS_API_KEY` | no | Read only by the dev-only `intake/formbricks` leftover. Not used in production. |

```env
NEXT_PUBLIC_INSTANT_APP_ID=f0827431-76de-4f51-a2c3-bae2e1558bcc
INSTANT_ADMIN_KEY=<instant admin key>
ALLOWED_EMAILS=<staff1@example.com>,<staff2@example.com>
N8N_SHARED_SECRET=<long random string>
RESEND_API_KEY=<resend api key>
RESEND_WEBHOOK_SECRET=<resend webhook signing secret>
DEFAULT_FROM_EMAIL=<sender@your-domain>
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_PHONE_NUMBER=<+15550000000>
BLOB_READ_WRITE_TOKEN=<vercel blob token>
NEXT_PUBLIC_APP_URL=https://flowlane.klobsterltd.com
```

Never commit `.env` or `.env.local`.

## InstantDB schema and permissions

The data model is in `instant.schema.ts` (16 entities):

| Entity | Holds |
|---|---|
| `pipes` | Pipelines |
| `stages` | Columns of a pipe (ordered by `position`, optional colour) |
| `cards` | Applications on the board |
| `card_fields` | Custom field values on a card |
| `card_comments` | Comments on a card |
| `card_emails` | Sent and received emails for a card, with Resend delivery status |
| `card_sms` | Sent and received SMS for a card |
| `stage_forms` | Form templates attached to a stage (client or admin forms) |
| `form_submissions` | Client form responses |
| `card_history` | Stage moves of a card |
| `automations` | Automation rules per pipe and stage (trigger, conditions, actions) |
| `automation_logs` | Automation run history |
| `email_templates` | Reusable email templates per pipe |
| `sms_templates` | Reusable SMS templates per pipe |
| `system_settings` | Default sender, global template variables, Kanban display settings |
| `field_definitions` | Field definitions for n8n intake |

Permissions are in `instant.perms.ts` (see Access model). Changes to either file only reach the database when pushed:

```bash
npx instant-cli push schema --app f0827431-76de-4f51-a2c3-bae2e1558bcc
npx instant-cli push perms --app f0827431-76de-4f51-a2c3-bae2e1558bcc
```

## Deployment

FlowLane runs on Vercel; production is https://flowlane.klobsterltd.com. Pushes to `main` deploy. Environment variables are set in the Vercel dashboard; changing them needs a redeploy to take effect.

## Project structure

```
src/
  app/                  pages (App Router)
    pipes/              pipe list and Kanban board (pipes/[id])
    automations/        automation rules per pipe
    email-templates/    email templates per pipe
    sms-templates/      SMS templates per pipe
    settings/           settings (forms, Kanban display, n8n fields, IDs)
    form/               public client form (form/[cardId]/[formId])
    admin/, debug/      admin and debug pages
    api/                API routes (see the table above)
  components/           auth provider, card modal, form builder, rich-text editor
  contexts/             toast context
  i18n/                 next-intl request config
  lib/                  Instant clients, staff-auth, staff-fetch, automation engine, email and placeholder helpers
messages/               translations (en, zh-CN, zh-TW)
instant.schema.ts       InstantDB data model
instant.perms.ts        InstantDB browser permissions
n8n-workflows/          older n8n workflow exports (see n8n)
```

## Resources

- [InstantDB docs](https://instantdb.com/docs)
- [Next.js docs](https://nextjs.org/docs)
- [n8n docs](https://docs.n8n.io)
- [Resend docs](https://resend.com/docs)
- [Twilio docs](https://www.twilio.com/docs)
