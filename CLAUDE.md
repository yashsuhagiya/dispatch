# CLAUDE.md

## Project Overview

Local-only tool for sending job application emails via Gmail SMTP. Single `bun run dev` starts Vite which serves both the React frontend and Hono API routes through a custom Vite plugin.

## Commands

- `bun run dev` — start the app (only command needed)

## Architecture

- **No separate backend process.** Vite plugin in `vite.config.ts` intercepts `/api/*` and `/health` requests and passes them to the Hono app via SSR module loading.
- **Server code** lives in `server/` but is loaded by Vite, not run independently.
- **Config validation** happens at first API request — `server/config.ts` throws on missing env vars or missing files.
- **History** stored as append-only JSON at `data/send-log.json` (newest first).

## Key Files

- `vite.config.ts` — the `honoDevServer()` plugin is the glue between frontend and API
- `server/config.ts` — validates all env vars and file paths at import time
- `server/services/emailService.ts` — singleton Nodemailer transporter (port 587, STARTTLS, `auth.pass` not `auth.password`)
- `server/services/historyService.ts` — uses `import.meta.dirname` (not `import.meta.dir` which is Bun-only)

## Critical Rules

- `.env` must stay gitignored — contains Gmail App Password
- SMTP config: `port: 587`, `secure: false` — only correct Gmail combination
- Nodemailer auth key is `pass` not `password` (wrong key silently fails)
- `RESUME_PATH` and `EMAIL_BODY_PATH` must be absolute paths to real files
- Transporter is a singleton at module scope — never create inside `send()`
- `data/` is gitignored — history is local-only

## Tech Stack

- Bun (runtime), Vite 8 (dev server), React 19, Tailwind CSS 4, Hono, Nodemailer, Zod
