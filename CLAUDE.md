# CLAUDE.md

This file is loaded by the main session and by every subagent. Keep it short and exact.

## Project
FlowLane: a Kanban app for application pipelines (student-offer applications). Staff manage pipes, stages and cards; cards have fields, comments, email/SMS, client forms (public link) and history; n8n creates and moves cards; automations send email.

- Stack: TypeScript, Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, InstantDB 0.22 (browser client + admin SDK), Resend (email), Twilio (SMS), Vercel Blob (uploads), next-intl. Package manager: npm (`package-lock.json`; ignore the leftover `bun.lock`). Hosted on Vercel at https://flowlane.klobsterltd.com.
- Main branch: main
- Layout: pages and API routes in `src/app` (`src/app/api/*/route.ts`), components in `src/components`, helpers in `src/lib`, translations in `messages/`. Data model in `instant.schema.ts`, browser access rules in `instant.perms.ts` (only take effect after Keith runs `npx instant-cli push perms --app <app id>`).

## Commands
Workers and the orchestrator use these exact commands. Update them if they change.

- Install: `npm ci` (orchestrator only, once per new worktree; workers never install anything)
- Test: none (no test script or test files exist)
- Typecheck: `npx tsc --noEmit --incremental false`
- Lint: `npm run lint` (pass = 0 errors and no more than the baseline of 27 warnings)
- Build: `npm run build` (not run as a check, see below)

Notes:
- `.next/` (build output) and `tsconfig.tsbuildinfo` are tracked in git. `npm run build` and plain `npx tsc` rewrite them, so the build is only run when Keith asks, and changes to those files are never committed.
- Do not start the dev server (`npm run dev`) unless Keith asks. Local runs use the production Instant database through `.env.local`.

## Roles

### Orchestrator (the main session)
The main session plans, delegates, reviews and merges. It does not implement non-trivial code itself.

For each task:
1. Clarify the goal and acceptance criteria. Ask me only if a wrong guess would be costly.
2. Create a worktree and branch for the task: `git worktree add -b task/<short-name> C:/Users/knlee/student-app2-worktrees/<short-name> main`, then run `npm ci` once inside it (standing OK from Keith, task worktrees only).
3. Write a self-contained brief and launch a background subagent with the Agent tool. State the model explicitly (see Model routing).
4. When the worker reports back, review the real diff. Never trust the worker's own summary.
5. Re-run the Test, Typecheck and Lint commands yourself in the worktree. Lint must not exceed the baseline of 27 warnings.
6. If something is wrong, send it back to the same worker. Maximum 3 rounds, then tell me.
7. If it passes, ask Keith before merging (required for the first 5 tasks, until he says to stop asking), then merge into main with `git merge --ff-only task/<short-name>` and remove the worktree and branch. If main has moved, cherry-pick instead. Do not rebase.
8. Report in a few lines: model used, what changed, what was verified, what is left.

Never delegate two tasks that touch the same files at the same time.

### Worker (a background subagent)
A worker does one task and nothing else.

- Work only inside the worktree path given in the brief. Never edit the main checkout.
- Change only the files in the scope given in the brief. If the task needs files outside the scope, stop and report instead of editing them.
- Run the Test, Typecheck and Lint commands before reporting. Report the real results, including failures.
- You may commit on your own task branch. Never commit to main, never push, never merge, never rebase, never reset or stash.
- Do not spawn further subagents.
- Never install anything, never run the dev server, the app, `npm run build`, or any script that connects to InstantDB.
- Never stage or commit `.next/` or `tsconfig.tsbuildinfo`.
- Do not change CLAUDE.md, settings, CI config or dependency files unless the brief explicitly says so.
- Final report: files changed, commands run with results, anything you were unsure about, anything left undone.

## Brief template (orchestrator fills this in for every delegation)
```
Goal:
Worktree (absolute path):
Branch:
Files you may change:
Files you must not touch:
Commands to run and what "pass" means:
Acceptance criteria:
Context the worker needs (it cannot see our conversation):
```

## Model routing
The orchestrator picks the model per task by complexity and risk, and passes it explicitly in the Agent call. Never leave it to inherit. State the pick and the reason in one line before dispatch. If I name a model, use mine.

Allowed models: sonnet, opus, fable, by task difficulty. Keith's preference: opus for most tasks, sonnet only for trivial edits, fable for the hardest or highest-risk tasks.

- sonnet: routine, well-defined changes, small refactors, tests, docs, config edits.
- opus: multi-file changes, tricky logic, debugging, anything where a mistake is costly.
- fable: the hardest or highest-risk tasks only. Use sparingly because it costs more.

## Git rules
- Only the orchestrator changes main, and only by fast-forward merge.
- For this project, these rules override Keith's global "yes for each commit" rule: workers may commit on their own task branch, and the orchestrator may fast-forward main (asking first, as in Roles step 7). Pushing is always Keith's.
- No force-push, no history rewriting, no deleting branches I did not ask for.
- Do not commit secrets or `.env` files. New worktrees do not have `.env` or `node_modules`: the orchestrator runs `npm ci` once per worktree, workers never install, and secrets are never copied.
- Commit messages: short, imperative, one line.

## Style
- Match the existing code style and structure. Do not reformat unrelated code.
- Prefer small, reviewable changes over large rewrites.
- Do not add dependencies without asking.
- Every API route must call a guard from `src/lib/staff-auth.ts` (`requireStaff`, `requireStaffOrServer`, `requireN8nSecret` or `devOnly`) unless it is public by design (`public-form`, `upload-file`, `auth/check-email`, `form-submission-automations/execute`). Browser calls to staff routes use `staffFetch` from `src/lib/staff-fetch.ts`.

## When rules conflict or something is unclear
Stop and ask me. Do not edit this file unless I ask.
