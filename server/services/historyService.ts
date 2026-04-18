import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'

// import.meta.dirname works in both Node 22+ and Bun (import.meta.dir is Bun-only)
const LOG_PATH = join(import.meta.dirname, '../../data/send-log.json')

export interface SendRecord {
  to: string
  timestamp: string
  status: 'sent' | 'failed'
  messageId?: string
  error?: string
  /** Template id used for this send (present on new-schema records). */
  templateId?: string
  /** Resolved subject (post-substitution) for reference in the ledger. */
  subject?: string
  /** Values supplied for tokens — enables re-sending follow-ups with same context. */
  tokens?: Record<string, string>
  /** recordId of the original send this is a follow-up to. */
  parentId?: string
  /** 0 = initial, 1 = first follow-up, etc. */
  threadIndex?: number
}

export async function append(entry: SendRecord): Promise<void> {
  const existing = await read()
  existing.unshift(entry) // newest first
  const dir = dirname(LOG_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(LOG_PATH, JSON.stringify(existing, null, 2), 'utf-8')
}

export async function read(): Promise<SendRecord[]> {
  if (!existsSync(LOG_PATH)) return []
  try {
    return JSON.parse(readFileSync(LOG_PATH, 'utf-8'))
  } catch {
    return [] // corrupted file — return empty rather than crashing
  }
}
