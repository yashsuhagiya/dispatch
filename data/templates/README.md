# Templates

Each `.txt` file here is a dispatch template. The first line may be `Subject: ...`
(optional — falls back to `EMAIL_SUBJECT` from `.env`), then a blank line, then the
body. Any `{{token}}` is substituted at send time.

## Supported tokens

- `{{company}}` — company name (auto-suggested from the recipient's email domain)
- `{{role}}` — role / position
- `{{first_name}}` — recipient's first name (auto-suggested if the email local-part
  contains a `.` or `_`)
- `{{job_url}}` — link to the job posting
- `{{sender_name}}` — your name (from `SENDER_NAME` in `.env`, or your Gmail user)

Any unknown `{{token}}` is left literal — so you get a loud signal if you forgot
to fill it in.

## Filename convention

Filename (minus `.txt`) becomes the template id. Prefix with a number to control
sort order, e.g. `01-initial.txt`, `02-followup.txt`, `03-referral.txt`.

If this directory is empty, the app falls back to `EMAIL_BODY_PATH` / `EMAIL_SUBJECT`
as a single "default" template.
