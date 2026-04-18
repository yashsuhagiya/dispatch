import { readdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { config } from '../config'

const TEMPLATES_DIR = join(import.meta.dirname, '../../data/templates')

const DEFAULT_ID = 'default'

export interface Template {
  id: string
  name: string
  subject: string
  body: string
  tokens: string[]
}

/** Extract all unique {{token}} names from a string. */
function extractTokens(...parts: string[]): string[] {
  const set = new Set<string>()
  for (const p of parts) {
    const matches = p.matchAll(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi)
    for (const m of matches) set.add(m[1])
  }
  return [...set]
}

/** Parse a template file. First line may be `Subject: ...`; then a blank line;
 * then the body. If no subject line is present, config.emailSubject is used. */
function parse(raw: string, id: string): Template {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  let subject = config.emailSubject
  let bodyStart = 0

  const subjectMatch = lines[0]?.match(/^Subject:\s*(.+)$/i)
  if (subjectMatch) {
    subject = subjectMatch[1].trim()
    // Skip the subject line and the blank line that follows, if any
    bodyStart = lines[1]?.trim() === '' ? 2 : 1
  }

  const body = lines.slice(bodyStart).join('\n').trim()
  const name = id
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return { id, name, subject, body, tokens: extractTokens(subject, body) }
}

function defaultTemplate(): Template {
  return {
    id: DEFAULT_ID,
    name: 'Default (from .env)',
    subject: config.emailSubject,
    body: config.emailBody,
    tokens: extractTokens(config.emailSubject, config.emailBody),
  }
}

export function listTemplates(): Template[] {
  if (!existsSync(TEMPLATES_DIR)) return [defaultTemplate()]

  const files = readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.txt'))
    .sort()

  if (files.length === 0) return [defaultTemplate()]

  return files.map((file) => {
    const raw = readFileSync(join(TEMPLATES_DIR, file), 'utf-8')
    const id = file.replace(/\.txt$/, '')
    return parse(raw, id)
  })
}

export function getTemplate(id: string): Template | null {
  if (id === DEFAULT_ID) return defaultTemplate()
  const filePath = join(TEMPLATES_DIR, `${id}.txt`)
  if (!existsSync(filePath)) return null
  return parse(readFileSync(filePath, 'utf-8'), id)
}
