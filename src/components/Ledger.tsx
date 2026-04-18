import { useState, useMemo } from 'react'
import {
  type SendRecord,
  type Pipeline,
  getMeta,
  setPipeline as persistPipeline,
  setNote as persistNote,
  cyclePipeline,
  pipelineLabel,
  daysSince,
  isFollowUpDue,
  exportCsv,
  recordId,
} from '../lib/ledger'

interface LedgerProps {
  history: SendRecord[]
  loading: boolean
  onMetaChange: () => void
  onComposeFollowUp: (r: SendRecord, followUpCount: number) => void
}

type FilterKey = 'all' | 'pending' | 'due' | 'replied' | 'offer' | 'rejected' | 'failed'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'due', label: 'Follow-up Due' },
  { key: 'replied', label: 'Replied' },
  { key: 'offer', label: 'Offers' },
  { key: 'rejected', label: 'Rejections' },
  { key: 'failed', label: 'Bounced' },
]

function tagClasses(p: Pipeline, failed: boolean): string {
  if (failed) return 'tag text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]'
  switch (p) {
    case null: return 'tag opacity-80'
    case 'replied': return 'tag text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]'
    case 'interview': return 'tag text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]'
    case 'offer': return 'tag bg-[var(--color-ink)] text-[var(--color-paper)] dark:bg-[var(--color-cream)] dark:text-[var(--color-night)] border-[var(--color-ink)] dark:border-[var(--color-cream)]'
    case 'rejected': return 'tag opacity-55 line-through'
    case 'ghosted': return 'tag opacity-45 italic'
  }
}

function formatTimestamp(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }).toUpperCase()
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return { date, time }
}

export default function Ledger({ history, loading, onMetaChange, onComposeFollowUp }: LedgerProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [openRow, setOpenRow] = useState<string | null>(null)

  // Pre-number records by their position in the full (newest-first) history.
  // Newest entry gets the highest filing number.
  const numbered = useMemo(
    () => history.map((r, i) => ({ r, no: history.length - i })),
    [history],
  )

  // Map parentId → list of follow-up records (sorted by threadIndex asc)
  const followUpsByParent = useMemo(() => {
    const map = new Map<string, SendRecord[]>()
    for (const r of history) {
      if (!r.parentId) continue
      const arr = map.get(r.parentId) ?? []
      arr.push(r)
      map.set(r.parentId, arr)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.threadIndex ?? 0) - (b.threadIndex ?? 0))
    }
    return map
  }, [history])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return numbered.filter(({ r }) => {
      if (q && !r.to.toLowerCase().includes(q)) return false
      const meta = getMeta(r)
      switch (filter) {
        case 'all': return true
        case 'failed': return r.status === 'failed'
        case 'pending': return r.status === 'sent' && meta.pipeline === null
        case 'due': return isFollowUpDue(r, meta.pipeline)
        case 'replied': return meta.pipeline === 'replied' || meta.pipeline === 'interview'
        case 'offer': return meta.pipeline === 'offer'
        case 'rejected': return meta.pipeline === 'rejected'
      }
    })
  }, [numbered, query, filter])

  function handleCycle(r: SendRecord, reverse: boolean): void {
    const current = getMeta(r).pipeline
    const next = cyclePipeline(current, reverse)
    persistPipeline(r, next)
    onMetaChange()
  }

  function handleNote(r: SendRecord, v: string): void {
    persistNote(r, v)
    onMetaChange()
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-4">
        <h2 className="font-display text-[1.4rem] leading-none tracking-tight">
          <span className="muted mr-2">§ II</span>
          Campaign ledger
        </h2>
        <button
          onClick={() => exportCsv(history)}
          className="btn-ghost !py-1.5 !px-3 !text-[0.72rem] !tracking-normal !normal-case !font-medium"
          disabled={history.length === 0}
          title="Export ledger as CSV"
        >
          Export CSV ↓
        </button>
      </div>
      <div className="rule-double mb-4" />

      {/* Controls — search + filter pills */}
      <div className="mb-5 space-y-3">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipient…"
            className="field !py-2.5 !pl-10 !text-sm"
            spellCheck={false}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 muted text-[0.8rem] italic font-display">q.</span>
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 muted hover:text-[var(--color-dispatch)] dark:hover:text-[var(--color-dispatch-n)] text-sm"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[0.78rem] py-1.5 px-3 border transition ${
                filter === f.key
                  ? 'bg-[var(--color-ink)] text-[var(--color-paper)] border-[var(--color-ink)] dark:bg-[var(--color-cream)] dark:text-[var(--color-night)] dark:border-[var(--color-cream)] font-medium'
                  : 'border-current muted hover:text-[var(--color-ink)] dark:hover:text-[var(--color-cream)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Column header */}
      <div className="grid grid-cols-[3ch_minmax(0,1fr)_auto_auto_2ch] gap-3 text-[0.72rem] label py-2 border-b border-current">
        <span>№</span>
        <span>Recipient</span>
        <span className="text-right">Filed</span>
        <span className="text-right pr-1">Status</span>
        <span></span>
      </div>

      {/* Rows */}
      {loading ? (
        <p className="py-10 text-center italic font-display muted">Consulting the ledger…</p>
      ) : filtered.length === 0 ? (
        <div className="py-14 text-center">
          <div className="asterism muted" aria-hidden="true">✦ ✦ ✦</div>
          <p className="mt-4 font-display italic text-lg muted">
            {history.length === 0
              ? 'The ledger is empty. Dispatch your first wire.'
              : 'No entries match this view.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-paper-3)] dark:divide-[var(--color-night-3)]">
          {filtered.map(({ r, no }) => {
            const meta = getMeta(r)
            const id = `${r.to}-${r.timestamp}-${no}`
            const isOpen = openRow === id
            const { date, time } = formatTimestamp(r.timestamp)
            const age = daysSince(r.timestamp)
            const due = isFollowUpDue(r, meta.pipeline)
            const failed = r.status === 'failed'
            const isFollowUp = !!r.parentId && (r.threadIndex ?? 0) > 0
            const followUpChildren = followUpsByParent.get(recordId(r)) ?? []
            const childCount = followUpChildren.length

            return (
              <li key={id} className="ledger-row">
                <div className="grid grid-cols-[3ch_minmax(0,1fr)_auto_auto_2ch] gap-3 py-3 items-center">
                  {/* № */}
                  <span className="font-mono text-[0.78rem] muted tabular-nums tracking-tight">
                    {String(no).padStart(2, '0')}
                  </span>

                  {/* Recipient + aging meta */}
                  <div className="min-w-0">
                    <div className="font-mono text-[0.88rem] truncate flex items-center gap-2" title={r.to}>
                      {isFollowUp && (
                        <span
                          className="text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)] text-[0.85rem]"
                          title={`Follow-up № ${r.threadIndex}`}
                          aria-label={`Follow-up ${r.threadIndex}`}
                        >
                          ↳
                        </span>
                      )}
                      <span className="truncate">{r.to}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[0.75rem] muted">
                      <span>D+{age}</span>
                      {due && (
                        <span className="font-bold text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)] flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 bg-current rounded-full animate-pulse" />
                          Follow-up due
                        </span>
                      )}
                      {isFollowUp && (
                        <span className="italic font-display">Follow-up № {r.threadIndex}</span>
                      )}
                      {childCount > 0 && (
                        <span className="italic font-display">
                          {childCount} follow-up{childCount !== 1 ? 's' : ''} filed
                        </span>
                      )}
                      {meta.note && (
                        <span className="italic font-display">✎ noted</span>
                      )}
                    </div>
                  </div>

                  {/* Filed date/time */}
                  <div className="text-right text-[0.75rem] leading-tight font-medium">
                    <div>{date}</div>
                    <div className="muted">{time}</div>
                  </div>

                  {/* Pipeline tag */}
                  <div>
                    <button
                      type="button"
                      onClick={(e) => handleCycle(r, e.shiftKey)}
                      className={tagClasses(meta.pipeline, failed)}
                      title={failed ? r.error : 'Click to cycle · shift-click to reverse'}
                      disabled={failed}
                    >
                      {failed ? 'Bounced' : pipelineLabel(meta.pipeline)}
                    </button>
                  </div>

                  {/* Expand */}
                  <button
                    type="button"
                    onClick={() => setOpenRow(isOpen ? null : id)}
                    className="muted hover:text-[var(--color-ink)] dark:hover:text-[var(--color-cream)] text-base font-bold w-6 h-6 flex items-center justify-center"
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                  >
                    {isOpen ? '−' : '+'}
                  </button>
                </div>

                {isOpen && (
                  <div className="pb-4 pl-[calc(3ch+0.75rem)] pr-6 space-y-3 animate-[reveal-in_0.3s_ease]">
                    {failed && r.error && (
                      <p className="text-sm text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]">
                        <span className="label mr-2">Error:</span>{r.error}
                      </p>
                    )}
                    {r.subject && (
                      <p className="text-sm">
                        <span className="label mr-2">Subject:</span>
                        <span className="font-mono">{r.subject}</span>
                      </p>
                    )}
                    <div>
                      <label className="label block mb-1.5">
                        Marginalia <span className="muted text-[0.82rem] not-italic">— notes for posterity</span>
                      </label>
                      <textarea
                        value={meta.note}
                        onChange={(e) => handleNote(r, e.target.value)}
                        placeholder="e.g. Referred by ___. Interview set for ___."
                        rows={2}
                        className="field !py-2 !text-sm"
                      />
                    </div>
                    {!failed && (
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => onComposeFollowUp(r, childCount)}
                          className="btn-ghost !py-1.5 !px-3 !text-[0.72rem] !tracking-normal !normal-case !font-medium"
                        >
                          ↪ Compose follow-up
                        </button>
                        <span className="muted text-[0.72rem] italic font-display">
                          {childCount === 0
                            ? 'No follow-ups sent yet.'
                            : `${childCount} follow-up${childCount !== 1 ? 's' : ''} already on file.`}
                        </span>
                      </div>
                    )}
                    <p className="muted text-[0.72rem] italic font-display">
                      Tip — click the status tag to advance · shift-click to reverse.
                    </p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
