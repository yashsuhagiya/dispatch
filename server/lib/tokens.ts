/** Substitute {{token}} occurrences with values from the map.
 * Unknown tokens are left literal (so they're visually obvious if missed). */
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
