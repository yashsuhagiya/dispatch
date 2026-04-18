import { useState, useEffect, useCallback, useMemo } from 'react'
import SendForm from './components/SendForm'
import Ledger from './components/Ledger'
import StatsStrip from './components/StatsStrip'
import type { SendRecord, Template } from './lib/ledger'
import { getMetaMap, computeStats, recordId } from './lib/ledger'
import type { ComposePrefill } from './lib/compose'

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let out = ''
  for (const [v, s] of map) {
    while (n >= v) { out += s; n -= v }
  }
  return out
}

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

const FOLLOWUP_TEMPLATE_HINTS = ['followup', 'follow-up', 'follow_up']

function pickFollowUpTemplate(templates: Template[]): Template | null {
  for (const t of templates) {
    const id = t.id.toLowerCase()
    if (FOLLOWUP_TEMPLATE_HINTS.some((h) => id.includes(h))) return t
  }
  return null
}

export default function App() {
  const [history, setHistory] = useState<SendRecord[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [dark, setDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const [metaVersion, setMetaVersion] = useState(0)
  const [prefill, setPrefill] = useState<ComposePrefill | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history')
      const data = await res.json()
      setHistory(data)
    } catch {
      console.error('Failed to fetch history')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      setTemplates(data)
    } catch {
      console.error('Failed to fetch templates')
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])
  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const handleComposeFollowUp = useCallback((r: SendRecord, childCount: number) => {
    const followUpTpl = pickFollowUpTemplate(templates)
    setPrefill({
      nonce: Date.now(),
      to: r.to,
      templateId: followUpTpl?.id,
      tokens: r.tokens,
      parentId: recordId(r),
      threadIndex: childCount + 1,
    })
    // Scroll compose section into view on narrow layouts
    requestAnimationFrame(() => {
      document.getElementById('recipients')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [templates])

  // Cmd/Ctrl-K to focus compose
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const el = document.getElementById('recipients') as HTMLTextAreaElement | null
        el?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const now = new Date()
  const stats = useMemo(
    () => computeStats(history, getMetaMap()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [history, metaVersion],
  )

  const dateLine = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${toRoman(now.getFullYear())}`
  const issueNo = `Vol. ${ROMAN[(now.getMonth()) % 12]} · No. ${String(dayOfYear(now)).padStart(3, '0')}`

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <div className="min-h-screen px-5 sm:px-10 py-8 sm:py-12 max-w-[1300px] mx-auto relative z-10">

        {/* ══════════════ MASTHEAD ══════════════ */}
        <header className="reveal" style={{ animationDelay: '0ms' }}>
          <div className="flex items-start justify-between gap-6 flex-wrap text-[0.78rem]">
            <div className="flex items-center gap-3">
              <span className="font-medium">{issueNo}</span>
              <span className="muted" aria-hidden="true">·</span>
              <span className="muted hidden sm:inline italic font-display">Printed locally</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline font-medium">Filed {dateLine}</span>
              <button
                onClick={() => setDark(!dark)}
                className="btn-ghost !py-1.5 !px-3 !text-[0.72rem] !tracking-normal !normal-case !font-medium"
                title={dark ? 'Switch to day edition' : 'Switch to night edition'}
              >
                {dark ? '☾ Night ed.' : '☀ Day ed.'}
              </button>
            </div>
          </div>

          <div className="rule-thick mt-4" />

          <div className="flex items-end justify-between gap-6 flex-wrap pt-4 pb-2">
            <h1 className="font-display-wonk text-[clamp(3rem,10vw,8.5rem)] leading-[0.82] tracking-[-0.04em]">
              <span className="italic font-extralight">The</span>{' '}
              <span className="font-black">Dispatch</span>
              <span className="text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]">.</span>
            </h1>
            <div className="text-right hidden md:block pb-3 muted">
              <p className="font-display italic text-lg leading-tight">
                &mdash; a field journal<br/>
                for the job search.
              </p>
            </div>
          </div>

          <div className="rule-thick" />

          {/* Tagline + motto strip */}
          <div className="flex items-center justify-between gap-6 py-3 text-[0.82rem] flex-wrap">
            <span className="font-display italic">Unsparing · Unsalaried · Unsigned</span>
            <span className="font-display italic text-[1rem] text-center flex-1 min-w-[180px]">
              &ldquo;Persistence is the whole of the trade.&rdquo;
            </span>
            <span className="sm:hidden font-medium">Filed {dateLine}</span>
            <span className="hidden sm:inline muted font-medium">
              Press Run № {String(history.length).padStart(4, '0')}
            </span>
          </div>

          <div className="rule-double" />
        </header>

        {/* ══════════════ STATS STRIP ══════════════ */}
        <section className="reveal mt-8" style={{ animationDelay: '120ms' }}>
          <StatsStrip stats={stats} />
        </section>

        {/* ══════════════ TWO-COLUMN BODY ══════════════ */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] gap-10 lg:gap-14">

          {/* § I — Dispatch note */}
          <section className="reveal" style={{ animationDelay: '240ms' }}>
            <div className="flex items-baseline justify-between mb-2 gap-4">
              <h2 className="font-display text-[1.4rem] leading-none tracking-tight">
                <span className="muted mr-2">§ I</span>
                Compose a dispatch
              </h2>
              <span className="muted text-[0.72rem] font-medium whitespace-nowrap">⌘K to focus</span>
            </div>
            <div className="rule-double mb-5" />
            <p className="font-display italic text-[1.05rem] leading-snug mb-6 muted">
              <span className="text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]">❦</span>{' '}
              Address the recipient. One hand, one wire, one
              <br className="hidden sm:inline" /> application at a time.
            </p>
            <SendForm
              onSent={fetchHistory}
              history={history}
              templates={templates}
              prefill={prefill}
              onPrefillConsumed={() => setPrefill(null)}
            />
          </section>

          {/* § II — Campaign ledger */}
          <section className="reveal" style={{ animationDelay: '360ms' }}>
            <Ledger
              history={history}
              loading={loading}
              onMetaChange={() => setMetaVersion((v) => v + 1)}
              onComposeFollowUp={handleComposeFollowUp}
            />
          </section>
        </div>

        {/* ══════════════ FOOTER ══════════════ */}
        <footer className="mt-20 reveal-fade" style={{ animationDelay: '720ms' }}>
          <div className="rule-double mb-4" />
          <div className="text-center py-6">
            <div className="asterism muted" aria-hidden="true">✦ ✦ ✦</div>
            <p className="mt-4 font-display italic text-lg">
              Filed at the bench · Printed locally · <span className="ink-mark">No claims to fortune.</span>
            </p>
            <p className="mt-3 muted font-display italic text-sm">
              — End of edition —
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
