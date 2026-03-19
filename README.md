# Email Application Sender

A local tool for sending job application emails with one click. Enter recipient email(s), hit send — a pre-configured email with your resume and attachments goes out via Gmail SMTP.

## Features

- Single or bulk send (paste multiple emails, send to all)
- Resume + extra file attachments
- Multiline email body from a text file
- Duplicate recipient detection
- Send history with status tracking
- Daily send counter (Gmail allows ~100/day)
- Confirmation prompt before sending

## Prerequisites

- [Bun](https://bun.sh) (v1.2+)
- A Gmail account with [App Password](https://myaccount.google.com/apppasswords) (requires 2FA enabled)

## Setup

```bash
# Install dependencies
bun install

# Copy and edit .env
cp .env.example .env
```

Edit `.env` with your values:

```
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_SUBJECT=Software Engineer Application
EMAIL_BODY_PATH=/absolute/path/to/email-body.txt
RESUME_PATH=/absolute/path/to/resume.pdf
ATTACHMENTS=/path/to/cover-letter.pdf,/path/to/portfolio.pdf
PORT=3000
```

| Variable | Required | Description |
|---|---|---|
| `GMAIL_USER` | Yes | Your Gmail address |
| `GMAIL_APP_PASSWORD` | Yes | Gmail App Password (not your login password) |
| `EMAIL_SUBJECT` | Yes | Email subject line |
| `EMAIL_BODY_PATH` | Yes | Absolute path to a `.txt` file with the email body |
| `RESUME_PATH` | Yes | Absolute path to your resume PDF |
| `ATTACHMENTS` | No | Comma-separated absolute paths to extra attachments |
| `PORT` | No | Server port (default: 3000) |

Create your email body file. Replace the included `email-body.txt` with your own content (supports multiple lines):

```bash
# Edit the included template, or create your own and update EMAIL_BODY_PATH in .env
nano email-body.txt
```

Example:

```
Hi,

I am writing to express my interest in the Software Engineer position.
Please find my resume attached.

Best regards,
Your Name
```

## Run

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173).

## How it works

Single Vite dev server handles everything — React frontend and Hono API routes in one process.

- **Frontend:** React 19 + Tailwind CSS 4 (Vite)
- **API:** Hono routes served via a Vite plugin (no separate backend)
- **Email:** Nodemailer with Gmail SMTP (port 587, STARTTLS)
- **History:** JSON file at `data/send-log.json`

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/send` | Send to one recipient `{ "to": "email" }` |
| `POST` | `/api/send-bulk` | Send to many `{ "recipients": ["email1", "email2"] }` |
| `GET` | `/api/history` | Get all send records (newest first) |
| `GET` | `/health` | Health check |

## Project Structure

```
├── server/
│   ├── app.ts                # Hono app (routes + middleware)
│   ├── config.ts             # Env validation, file path checks
│   ├── routes/email.ts       # Send + bulk send + history endpoints
│   └── services/
│       ├── emailService.ts   # Gmail SMTP singleton transporter
│       └── historyService.ts # JSON file persistence
├── src/
│   ├── App.tsx               # Main layout, history state, daily count
│   ├── main.tsx              # React entry
│   ├── index.css             # Tailwind import
│   └── components/
│       ├── SendForm.tsx      # Email input, bulk paste, confirmation
│       └── HistoryTable.tsx  # Send history table
├── data/                     # Runtime history (gitignored)
├── .env                      # Credentials (gitignored)
├── index.html
├── vite.config.ts
├── package.json
└── tsconfig.json
```
