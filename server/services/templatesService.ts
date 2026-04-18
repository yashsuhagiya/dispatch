import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync } from 'fs'
import { join, resolve, sep } from 'path'
import { config } from '../config'

const TEMPLATES_DIR = join(import.meta.dirname, '../../data/templates')
const RESOLVED_DIR = resolve(TEMPLATES_DIR)

const DEFAULT_ID = 'default'

/** Defensive: refuses anything outside the allowlisted shape. */
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/

/** Body+subject size cap — 64KB is absurdly generous for an email. */
const MAX_TEMPLATE_BYTES = 64 * 1024

export class TemplateError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/** Strict filename + path-containment check. Returns absolute file path. */
function safePathFor(id: string): string {
  if (!ID_PATTERN.test(id)) {
    throw new TemplateError(
      'Template id must be 1–50 chars, lowercase letters, digits, or hyphens, and start with a letter or digit.',
    )
  }
  if (id === DEFAULT_ID) {
    throw new TemplateError('"default" is a reserved template id.', 409)
  }
  const candidate = resolve(RESOLVED_DIR, `${id}.txt`)
  if (!candidate.startsWith(RESOLVED_DIR + sep)) {
    throw new TemplateError('Resolved path escapes templates directory.', 400)
  }
  // If the file already exists, also check realpath to reject symlink escapes.
  if (existsSync(candidate)) {
    const real = realpathSync(candidate)
    if (!real.startsWith(realpathSync(RESOLVED_DIR) + sep)) {
      throw new TemplateError('Template path resolves outside templates directory.', 400)
    }
  }
  return candidate
}

function serialize(subject: string, body: string): string {
  const subj = subject.trim()
  const bod = body.replace(/\r\n/g, '\n').trim()
  if (!subj) return `${bod}\n`
  return `Subject: ${subj}\n\n${bod}\n`
}

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

/** Create a new template. Fails if the id already exists. */
export function createTemplate(id: string, subject: string, body: string): Template {
  const filePath = safePathFor(id)
  const serialized = serialize(subject, body)
  if (Buffer.byteLength(serialized, 'utf-8') > MAX_TEMPLATE_BYTES) {
    throw new TemplateError(`Template exceeds ${MAX_TEMPLATE_BYTES} bytes.`, 413)
  }
  if (existsSync(filePath)) {
    throw new TemplateError(`Template "${id}" already exists. Use PUT to overwrite.`, 409)
  }
  if (!existsSync(RESOLVED_DIR)) mkdirSync(RESOLVED_DIR, { recursive: true })
  writeFileSync(filePath, serialized, 'utf-8')
  return parse(serialized, id)
}

/** Overwrite an existing template. Fails if the id does not exist. */
export function saveTemplate(id: string, subject: string, body: string): Template {
  const filePath = safePathFor(id)
  const serialized = serialize(subject, body)
  if (Buffer.byteLength(serialized, 'utf-8') > MAX_TEMPLATE_BYTES) {
    throw new TemplateError(`Template exceeds ${MAX_TEMPLATE_BYTES} bytes.`, 413)
  }
  if (!existsSync(filePath)) {
    throw new TemplateError(`Template "${id}" does not exist. Use POST to create.`, 404)
  }
  writeFileSync(filePath, serialized, 'utf-8')
  return parse(serialized, id)
}
