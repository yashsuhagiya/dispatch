import { existsSync, readFileSync } from 'fs'
import { resolve, basename } from 'path'

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${key}`)
  }
  return value
}

function requireFile(envKey: string, label: string): string {
  const raw = requireEnv(envKey)
  const resolved = resolve(raw)
  if (!existsSync(resolved)) {
    throw new Error(
      `[config] ${label} not found at: ${resolved}\nSet ${envKey} in .env to a valid absolute path.`
    )
  }
  return resolved
}

const resumePath = requireFile('RESUME_PATH', 'Resume file')
const emailBodyPath = requireFile('EMAIL_BODY_PATH', 'Email body file')
const emailBody = readFileSync(emailBodyPath, 'utf-8').trim()

// Extra attachments: comma-separated absolute paths (optional)
const extraAttachments = (process.env.ATTACHMENTS ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter((p) => p.length > 0)
  .map((p) => {
    const resolved = resolve(p)
    if (!existsSync(resolved)) {
      throw new Error(`[config] Attachment not found at: ${resolved}`)
    }
    return { filename: basename(resolved), path: resolved }
  })

const attachments = [
  { filename: basename(resumePath), path: resumePath },
  ...extraAttachments,
]

export const config = {
  gmailUser: requireEnv('GMAIL_USER'),
  gmailAppPassword: requireEnv('GMAIL_APP_PASSWORD'),
  emailSubject: requireEnv('EMAIL_SUBJECT'),
  emailBody,
  attachments,
  port: parseInt(process.env.PORT ?? '3000', 10),
} as const
