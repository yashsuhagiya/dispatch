# CLAUDE.md

## Project Overview

"The Dispatch" — a local-only, open-source tool for sending and tracking cold
job-application emails via the user's own Gmail. Published as MIT-licensed
reference / self-host software. No SaaS component, no account system.

Single `bun run dev` starts Vite which serves both the React frontend and
Hono API routes through a custom Vite plugin.

## Commands

- `bun run dev` — start the app (only command needed)

## Architecture

- **No separate backend process.** Vite plugin in `vite.config.ts` intercepts
  `/api/*` and `/health` requests and passes them to the Hono app via SSR
  module loading.
- **Server code** lives in `server/` but is loaded by Vite, not run
  independently.
- **Config validation** happens at first API request — `server/config.ts`
  throws on missing env vars or missing files.
- **History** stored as append-only JSON at `data/send-log.json` (newest first).
- **Templates** loaded from `data/templates/*.txt` by `templatesService`.
  First line may be `Subject: …`, then blank line, then body. Any `{{token}}`
  in subject/body is substituted at send time. If the directory is empty,
  falls back to `EMAIL_BODY_PATH` / `EMAIL_SUBJECT`.
- **Pipeline status + notes** persist in browser `localStorage`
  (key `dispatch.meta.v1`), keyed by `${to.toLowerCase()}::${timestamp}`.
  The server never sees these.

## Key Files

- `vite.config.ts` — `honoDevServer()` plugin is the glue between frontend and API
- `server/config.ts` — validates all env vars and file paths at import time
- `server/services/emailService.ts` — singleton Nodemailer transporter
  (port 587, STARTTLS, `auth.pass` not `auth.password`). Accepts optional
  `{subject, body}` overrides per-send.
- `server/services/templatesService.ts` — reads / parses `data/templates/*.txt`
- `server/services/historyService.ts` — uses `import.meta.dirname` (not
  `import.meta.dir` which is Bun-only)
- `server/lib/tokens.ts` — `{{token}}` substitution (leaves unknown tokens
  literal so mistakes are visible)
- `src/lib/compose.ts` — client-side auto-fill heuristics + mirror of
  substitute/unfilledTokens for preview
- `src/lib/ledger.ts` — record types + localStorage helpers + stats +
  CSV export

## Critical Rules

- `.env` must stay gitignored — contains the Gmail App Password.
- `data/send-log.json` must stay gitignored — that is the user's personal
  ledger. `data/templates/` IS tracked (ships starter templates).
- SMTP config: `port: 587`, `secure: false` — only correct Gmail combination.
- Nodemailer auth key is `pass` not `password` (wrong key silently fails).
- `RESUME_PATH` and `EMAIL_BODY_PATH` must be absolute paths to real files.
- Transporter is a singleton at module scope — never create inside `send()`.
- The record id used for localStorage meta and follow-up linking is
  `` `${to.toLowerCase()}::${timestamp}` `` — do not change this key format
  without a data migration.

## Adding to this project

The project's constraints are intentional and worth preserving:

- **Local-only.** Don't add features that assume a server, account system,
  or external network service beyond `smtp.gmail.com`.
- **Zero ongoing cost.** No paid APIs, no LLMs, no analytics.
- **Respect the editorial-brutalist UI.** `.muted`, `.label`, `.field`,
  `.btn-transmit`, `.tag` in `src/index.css` carry the design language.
  Sentence case for prose; ALL CAPS reserved for short status tokens,
  datelines, and hero CTAs only.

## Tech Stack

- Bun (runtime), Vite 8 (dev server), React 19, Tailwind CSS 4, Hono,
  Nodemailer, Zod, Fraunces + JetBrains Mono (Google Fonts)
