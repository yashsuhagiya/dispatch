/** A pre-fill request passed from the Ledger "Compose follow-up" action
 * down to the SendForm. `nonce` forces the form to re-sync even when the
 * same recipient is requested twice. */
export interface ComposePrefill {
  nonce: number
  to: string
  templateId?: string
  tokens?: Record<string, string>
  parentId?: string
  threadIndex?: number
}

/** Guess the company name from an email address:
 * jobs@acme-corp.io → "Acme Corp"
 * alex.chen@acmecorp.com → "Acmecorp"
 * Returns '' if no sensible guess is possible. */
export function guessCompany(email: string): string {
  const at = email.indexOf('@')
  if (at < 0) return ''
  const domain = email.slice(at + 1).toLowerCase()
  // Strip TLD — take the second-level if present, otherwise the whole thing
  const parts = domain.split('.')
  const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0]
  if (!core) return ''
  return core
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Guess a first name from an email local-part:
 * alex.chen@... → "Alex"
 * alex_chen@... → "Alex"
 * alexchen@... → '' (ambiguous, skip)
 * Returns '' if no sensible guess is possible. */
export function guessFirstName(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return ''
  const local = email.slice(0, at)
  // Reject common generic inboxes — no point guessing a first name
  const GENERIC = /^(hr|jobs|hiring|careers|recruit|recruiter|recruiting|apply|talent|info|contact|hello|team|people)(?:[-_+.].*)?$/i
  if (GENERIC.test(local)) return ''
  const match = local.match(/^([a-z]+)[._-]/i)
  if (!match) return ''
  const first = match[1]
  if (first.length < 2) return ''
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

/** Client-side mirror of server substitute — used for preview. */
export function substitute(text: string, tokens: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (whole, key) => {
    const v = tokens[key]
    return v == null || v === '' ? whole : v
  })
}

/** Returns tokens that appear in the text but have no value in the map. */
export function unfilledTokens(text: string, tokens: Record<string, string>): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi)) {
    const key = m[1]
    if (!tokens[key]) found.add(key)
  }
  return [...found]
}
