export type Pipeline = 'replied' | 'interview' | 'offer' | 'rejected' | 'ghosted' | null

export interface SendRecord {
  to: string
  timestamp: string
  status: 'sent' | 'failed'
  error?: string
  templateId?: string
  subject?: string
  tokens?: Record<string, string>
  /** recordId of the original send this is a follow-up to. */
  parentId?: string
  /** 0 = initial, 1 = first follow-up, etc. */
  threadIndex?: number
}

export interface Template {
  id: string
  name: string
  subject: string
  body: string
  tokens: string[]
}

export interface RecordMeta {
  pipeline: Pipeline
  note: string
}

const STORAGE_KEY = 'dispatch.meta.v1'

type MetaMap = Record<string, RecordMeta>

export function recordId(r: { to: string; timestamp: string }): string {
  return `${r.to.toLowerCase()}::${r.timestamp}`
}

function read(): MetaMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function write(m: MetaMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m))
}

export function getMeta(r: SendRecord): RecordMeta {
  const map = read()
  return map[recordId(r)] ?? { pipeline: null, note: '' }
}

export function getMetaMap(): MetaMap {
  return read()
}

export function setPipeline(r: SendRecord, p: Pipeline): void {
  const map = read()
  const key = recordId(r)
  const existing = map[key] ?? { pipeline: null, note: '' }
  map[key] = { ...existing, pipeline: p }
  write(map)
}

export function setNote(r: SendRecord, note: string): void {
  const map = read()
  const key = recordId(r)
  const existing = map[key] ?? { pipeline: null, note: '' }
  map[key] = { ...existing, note }
  write(map)
}

export const PIPELINE_CYCLE: Pipeline[] = [null, 'replied', 'interview', 'offer', 'rejected', 'ghosted']

export function cyclePipeline(current: Pipeline, reverse = false): Pipeline {
  const idx = PIPELINE_CYCLE.indexOf(current)
  const len = PIPELINE_CYCLE.length
  const next = reverse ? (idx - 1 + len) % len : (idx + 1) % len
  return PIPELINE_CYCLE[next]
}

export function pipelineLabel(p: Pipeline): string {
  if (p === null) return 'SENT'
  return p.toUpperCase()
}

/** Color intent for tag display */
export function pipelineIntent(p: Pipeline): 'neutral' | 'warm' | 'danger' | 'success' | 'muted' {
  switch (p) {
    case null: return 'neutral'
    case 'replied': return 'warm'
    case 'interview': return 'warm'
    case 'offer': return 'success'
    case 'rejected': return 'danger'
    case 'ghosted': return 'muted'
  }
}

export function daysSince(iso: string): number {
  const then = new Date(iso).getTime()
  const now = Date.now()
  return Math.floor((now - then) / (1000 * 60 * 60 * 24))
}

/** Consider follow-up due: status=sent, pipeline=null, > 7 days old */
export function isFollowUpDue(r: SendRecord, p: Pipeline): boolean {
  return r.status === 'sent' && p === null && daysSince(r.timestamp) >= 7
}

/** Compute streak of consecutive days with at least 1 sent email, ending today or yesterday */
export function computeStreak(history: SendRecord[]): number {
  const days = new Set<string>()
  for (const r of history) {
    if (r.status !== 'sent') continue
    days.add(new Date(r.timestamp).toDateString())
  }
  if (days.size === 0) return 0

  let streak = 0
  const cursor = new Date()
  // allow today OR yesterday as streak start (hasn't sent today yet, streak still alive)
  if (!days.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(cursor.toDateString())) return 0
  }
  while (days.has(cursor.toDateString())) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function computeStats(history: SendRecord[], metaMap: MetaMap) {
  const sent = history.filter((r) => r.status === 'sent')
  const today = new Date()
  const todayKey = today.toDateString()
  const weekAgo = Date.now() - 7 * 86400_000

  const todayCount = sent.filter((r) => new Date(r.timestamp).toDateString() === todayKey).length
  const weekCount = sent.filter((r) => new Date(r.timestamp).getTime() >= weekAgo).length
  const total = sent.length

  const responded = sent.filter((r) => {
    const m = metaMap[recordId(r)]
    return m && m.pipeline && m.pipeline !== 'ghosted'
  }).length
  const rate = total === 0 ? 0 : Math.round((responded / total) * 100)

  const streak = computeStreak(history)
  return { todayCount, weekCount, total, rate, streak, responded }
}

/** Download history + meta as CSV */
export function exportCsv(history: SendRecord[]): void {
  const map = read()
  const header = ['to', 'timestamp', 'transmit_status', 'pipeline', 'days_old', 'note', 'error']
  const rows = history.map((r) => {
    const m = map[recordId(r)] ?? { pipeline: null, note: '' }
    return [
      r.to,
      r.timestamp,
      r.status,
      m.pipeline ?? '',
      String(daysSince(r.timestamp)),
      m.note,
      r.error ?? '',
    ]
  })
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const csv = [header, ...rows].map((row) => row.map(esc).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dispatch-ledger-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
