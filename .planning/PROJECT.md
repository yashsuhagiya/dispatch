# Email Application Sender

## What This Is

A web dashboard for sending unsolicited job application emails. The user enters a recipient email address, and the app sends a pre-configured email with a fixed subject, body, and resume attachment via Gmail SMTP. It also maintains a history log of all sent emails.

## Core Value

Sending job application emails to any recipient with a single click — no composing, no attaching, just enter an email and send.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Send email to a recipient by entering their email address
- [ ] Fixed email subject and body (configured once, used for all sends)
- [ ] Fixed resume/CV attachment included with every email
- [ ] Send history log showing recipient, timestamp, and delivery status
- [ ] Gmail SMTP integration with app password
- [ ] React-based web dashboard UI

### Out of Scope

- Login/authentication — personal local use only
- Per-email personalization or template variables — body is 100% identical
- Multiple attachment variants — same resume for every email
- Bulk/batch sending from CSV — one email at a time via the form
- OAuth-based Gmail auth — using app password instead

## Context

- User has a Gmail account with an App Password already configured for SMTP access
- This is a personal productivity tool, not a commercial product
- The user sends the same application (subject + body + resume) to many different companies/contacts
- Currently this process is manual — composing the same email repeatedly

## Constraints

- **Package manager**: Bun — user preference
- **Email library**: Nodemailer — standard Node.js email library
- **Frontend**: React — web-based dashboard
- **Email provider**: Gmail SMTP (smtp.gmail.com, port 587, TLS)
- **Credentials**: Gmail address + App Password stored in environment variables

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bun over npm/yarn | User preference for speed and modern tooling | — Pending |
| Nodemailer for email | Industry standard Node.js email library, Gmail SMTP support built-in | — Pending |
| No authentication | Single-user local tool, no need for login overhead | — Pending |
| Fixed email content | All applications are identical, no personalization needed | — Pending |

---
*Last updated: 2026-03-19 after initialization*
