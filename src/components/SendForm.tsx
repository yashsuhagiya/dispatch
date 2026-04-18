import { useState, useRef, useEffect, useMemo } from 'react'
import type { Template } from '../lib/ledger'
import type { ComposePrefill } from '../lib/compose'
import { guessCompany, guessFirstName, substitute, unfilledTokens } from '../lib/compose'

interface SendFormProps {
  onSent: () => void
  history: { to: string }[]
  templates: Template[]
  prefill: ComposePrefill | null
  onPrefillConsumed: () => void
  onTemplatesChange: () => void
}

const TEMPLATE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/

function parseEmails(input: string): string[] {
  return input.split(/[\n,;]+/).map((e) => e.trim()).filter((e) => e.length > 0)
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function SendForm({ onSent, history, templates, prefill, onPrefillConsumed, onTemplatesChange }: SendFormProps) {
  const [input, setInput] = useState('')
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? '')
  const [tokens, setTokens] = useState<Record<string, string>>({})
  const [autoFilled, setAutoFilled] = useState<Record<string, boolean>>({})
  const [showPreview, setShowPreview] = useState(false)
  const [parentContext, setParentContext] = useState<{ parentId: string; threadIndex: number } | null>(null)

  // Editable draft content (raw, with {{tokens}}). Synced from active template
  // unless the user has diverged from it. Always used as the source of truth
  // for the preview and the send.
  const [draftSubject, setDraftSubject] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [editing, setEditing] = useState(false)
  const [saveStatus, setSaveStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [results, setResults] = useState<{ to: string; success: boolean; error?: string }[] | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const sendingRef = useRef(false)

  // Pick up template default once the list loads
  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id)
  }, [templates, templateId])

  // Honor incoming prefill (e.g. "Compose follow-up" from the ledger)
  useEffect(() => {
    if (!prefill) return
    setInput(prefill.to)
    if (prefill.templateId) setTemplateId(prefill.templateId)
    // Always reset tokens so stale state from prior composes doesn't leak in
    setTokens(prefill.tokens ?? {})
    setAutoFilled({})
    if (prefill.parentId != null) {
      setParentContext({
        parentId: prefill.parentId,
        threadIndex: prefill.threadIndex ?? 1,
      })
    } else {
      setParentContext(null)
    }
    setShowConfirm(false)
    setResults(null)
    setProgress(null)
    onPrefillConsumed()
    requestAnimationFrame(() => {
      document.getElementById('recipients')?.focus()
    })
  }, [prefill, onPrefillConsumed])

  const emails = parseEmails(input)
  const validEmails = emails.filter(isValidEmail)
  const invalidEmails = emails.filter((e) => !isValidEmail(e))
  const duplicates = validEmails.filter((e) =>
    history.some((r) => r.to.toLowerCase() === e.toLowerCase()),
  )

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  )

  // Sync the draft from the active template when it changes — but NOT while
  // the user is actively editing (their in-progress draft would vanish).
  useEffect(() => {
    if (editing) return
    if (!activeTemplate) {
      setDraftSubject('')
      setDraftBody('')
      return
    }
    setDraftSubject(activeTemplate.subject)
    setDraftBody(activeTemplate.body)
    setSaveStatus(null)
  }, [activeTemplate, editing])

  const isDirty = !!activeTemplate && (
    draftSubject !== activeTemplate.subject || draftBody !== activeTemplate.body
  )
  const isDefaultTemplate = activeTemplate?.id === 'default'

  // Auto-fill company/first_name from the first valid email when the user
  // hasn't explicitly typed a value yet.
  useEffect(() => {
    if (validEmails.length === 0) return
    const first = validEmails[0]
    const proposedCompany = guessCompany(first)
    const proposedFirst = guessFirstName(first)

    setTokens((prev) => {
      const next = { ...prev }
      const nextAuto = { ...autoFilled }
      let dirty = false

      if (
        proposedCompany &&
        (!prev.company || autoFilled.company) &&
        prev.company !== proposedCompany
      ) {
        next.company = proposedCompany
        nextAuto.company = true
        dirty = true
      }
      if (
        proposedFirst &&
        (!prev.first_name || autoFilled.first_name) &&
        prev.first_name !== proposedFirst
      ) {
        next.first_name = proposedFirst
        nextAuto.first_name = true
        dirty = true
      }
      if (dirty) setAutoFilled(nextAuto)
      return dirty ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validEmails[0]])

  function updateToken(key: string, value: string): void {
    setTokens((prev) => ({ ...prev, [key]: value }))
    setAutoFilled((prev) => ({ ...prev, [key]: false }))
  }

  const previewSubject = substitute(draftSubject, tokens)
  const previewBody = substitute(draftBody, tokens)
  const missingTokens = unfilledTokens(draftSubject + '\n' + draftBody, tokens)

  async function handleSaveChanges(): Promise<void> {
    if (!activeTemplate || isDefaultTemplate) return
    setSaveStatus(null)
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(activeTemplate.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: draftSubject, body: draftBody }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setSaveStatus({ kind: 'err', text: err.error ?? 'Failed to save.' })
        return
      }
      setSaveStatus({ kind: 'ok', text: `Saved to ${activeTemplate.id}.txt` })
      onTemplatesChange()
    } catch {
      setSaveStatus({ kind: 'err', text: 'Network error while saving.' })
    }
  }

  async function handleSaveAsNew(): Promise<void> {
    const suggested = activeTemplate?.id
      ? `${activeTemplate.id}-v2`
      : 'my-template'
    const raw = window.prompt(
      'New template id (lowercase, digits, hyphens; 1–50 chars):',
      suggested,
    )
    if (!raw) return
    const id = raw.trim().toLowerCase()
    if (!TEMPLATE_ID_PATTERN.test(id)) {
      setSaveStatus({ kind: 'err', text: `Invalid id "${id}". Use a–z, 0–9, hyphens; start with a letter or digit.` })
      return
    }
    setSaveStatus(null)
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, subject: draftSubject, body: draftBody }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setSaveStatus({ kind: 'err', text: err.error ?? 'Failed to create.' })
        return
      }
      setSaveStatus({ kind: 'ok', text: `Filed as ${id}.txt` })
      onTemplatesChange()
      // Switch the picker to the new template once the list refreshes.
      setTemplateId(id)
      setEditing(false)
    } catch {
      setSaveStatus({ kind: 'err', text: 'Network error while creating.' })
    }
  }

  function handleDiscardEdits(): void {
    if (!activeTemplate) return
    setDraftSubject(activeTemplate.subject)
    setDraftBody(activeTemplate.body)
    setSaveStatus(null)
  }

  async function handleSend() {
    if (sendingRef.current || validEmails.length === 0) return
    sendingRef.current = true
    setLoading(true)
    setResults(null)
    setProgress(null)
    setShowConfirm(false)

    const cleanedTokens = Object.fromEntries(
      Object.entries(tokens).filter(([, v]) => v.trim().length > 0),
    )

    // Always ship the raw draft subject/body; server substitutes tokens.
    // This unifies "plain template" and "edited-inline" paths.
    const sendPayload = {
      templateId: activeTemplate?.id,
      tokens: cleanedTokens,
      subject: draftSubject,
      body: draftBody,
    }

    try {
      if (validEmails.length === 1) {
        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: validEmails[0],
            ...sendPayload,
            parentId: parentContext?.parentId,
            threadIndex: parentContext?.threadIndex,
          }),
        })
        const data = await res.json()
        setResults([{ to: validEmails[0], success: data.success, error: data.error }])
        setProgress({ sent: data.success ? 1 : 0, failed: data.success ? 0 : 1, total: 1 })
      } else {
        const res = await fetch('/api/send-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipients: validEmails,
            ...sendPayload,
          }),
        })
        const data = await res.json()
        setResults(data.results)
        setProgress({ sent: data.sent, failed: data.failed, total: validEmails.length })
      }
      setInput('')
      setTokens({})
      setAutoFilled({})
      setParentContext(null)
      setEditing(false)
      // Reset draft to the (possibly-refetched) template on the next effect tick.
      if (activeTemplate) {
        setDraftSubject(activeTemplate.subject)
        setDraftBody(activeTemplate.body)
      }
      onSent()
    } catch {
      setResults([{ to: '', success: false, error: 'Network error — is the server running?' }])
    } finally {
      setLoading(false)
      sendingRef.current = false
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (validEmails.length === 0) return
    setShowConfirm(true)
  }

  const tallyLabel =
    emails.length === 0
      ? 'awaiting addresses'
      : `${validEmails.length} valid${invalidEmails.length > 0 ? ` · ${invalidEmails.length} malformed` : ''}`

  // Tokens to render input fields for: the union of tokens in the active template
  // plus any keys the user has already typed. Preserve the template's order.
  const tokenKeys = useMemo(() => {
    const tpl = activeTemplate?.tokens ?? []
    const extras = Object.keys(tokens).filter((k) => !tpl.includes(k))
    return [...tpl, ...extras]
  }, [activeTemplate, tokens])

  const tokenLabels: Record<string, string> = {
    company: 'Company',
    role: 'Role',
    first_name: 'First name',
    job_url: 'Job URL',
    sender_name: 'Your name',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Follow-up banner if composing from a parent — spans both panes */}
      {parentContext && (
        <div className="border-l-4 border-[var(--color-dispatch)] dark:border-[var(--color-dispatch-n)] pl-4 py-1.5 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <p className="label text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)] mb-0.5">
              Follow-up № {parentContext.threadIndex}
            </p>
            <p className="text-sm muted">Linked to the original dispatch in your ledger.</p>
          </div>
          <button
            type="button"
            onClick={() => setParentContext(null)}
            className="btn-ghost !py-1 !px-2.5 !text-[0.7rem] !tracking-normal !normal-case !font-medium"
          >
            Detach
          </button>
        </div>
      )}

      {/* ═══════ 2-pane split: inputs (left) + preview/edit (right) ═══════ */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6 lg:gap-10 lg:items-start">

      {/* ═══════ LEFT PANE ═══════ */}
      <div className="space-y-5 min-w-0">

      <div>
        <div className="flex items-baseline justify-between mb-2 gap-4">
          <label htmlFor="recipients" className="label">
            Recipients <span className="muted not-italic text-[0.82rem]">— one per line, or comma-separated</span>
          </label>
          <span className="muted text-[0.78rem] font-medium whitespace-nowrap">{tallyLabel}</span>
        </div>

        <textarea
          id="recipients"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setShowConfirm(false)
            setResults(null)
          }}
          placeholder={'recruiter@company.com\nhr@another.com, hiring@startup.io'}
          rows={4}
          className="field"
          disabled={loading}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* Template picker */}
      {templates.length > 0 && (
        <div>
          <label htmlFor="template" className="label block mb-2">
            Template <span className="muted not-italic text-[0.82rem]">— shape of the dispatch</span>
          </label>
          <div className="relative">
            <select
              id="template"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="field !py-2.5 !pr-10 appearance-none cursor-pointer"
              disabled={loading}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none muted">▼</span>
          </div>
        </div>
      )}

      {/* Token fields */}
      {tokenKeys.length > 0 && (
        <div>
          <div className="label mb-2">
            Fill the blanks <span className="muted not-italic text-[0.82rem]">— left empty, they remain visible in the draft</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tokenKeys.map((key) => (
              <div key={key}>
                <label className="text-[0.72rem] muted block mb-1 font-medium">
                  {tokenLabels[key] ?? key}
                  {autoFilled[key] && (
                    <span className="ml-2 italic font-display text-[var(--color-stamp)]">
                      · auto-suggested
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={tokens[key] ?? ''}
                  onChange={(e) => updateToken(key, e.target.value)}
                  placeholder={`{{${key}}}`}
                  className="field !py-2 !text-sm"
                  disabled={loading}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Advisories — malformed / duplicates */}
      {invalidEmails.length > 0 && (
        <div className="border-l-4 border-[var(--color-dispatch)] dark:border-[var(--color-dispatch-n)] pl-4 py-1">
          <p className="label text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)] mb-0.5">Malformed</p>
          <p className="text-sm">{invalidEmails.join(' · ')}</p>
        </div>
      )}

      {duplicates.length > 0 && !showConfirm && !parentContext && (
        <div className="border-l-4 border-[var(--color-stamp)] pl-4 py-1">
          <p className="label text-[var(--color-stamp)] mb-0.5">Previously filed</p>
          <p className="text-sm">{duplicates.join(' · ')}</p>
        </div>
      )}

      {/* Transmit button OR confirmation stamp */}
      {!showConfirm ? (
        <button
          type="submit"
          disabled={loading || validEmails.length === 0}
          className="btn-transmit"
        >
          <span className="inline-flex items-center gap-3">
            {loading
              ? 'Transmitting…'
              : validEmails.length <= 1
                ? <>{parentContext ? 'Send follow-up' : 'Transmit'} <span aria-hidden="true">→</span></>
                : <>Transmit · {validEmails.length} Recipients <span aria-hidden="true">→</span></>}
          </span>
        </button>
      ) : (
        <div className="border-2 border-current p-5 relative">
          <div className="absolute -top-3 left-5 bg-[var(--color-paper)] dark:bg-[var(--color-night)] px-2 label">
            Operator &mdash; confirm
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <p className="font-display text-[1.15rem] leading-snug flex-1 min-w-[200px]">
              You are about to transmit{' '}
              <span className="font-display-wonk font-bold text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]">
                {validEmails.length === 1 ? 'one wire' : `${validEmails.length} wires`}
              </span>
              {validEmails.length === 1 ? (
                <> to <span className="ink-mark">{validEmails[0]}</span>.</>
              ) : (
                <> across the wire.</>
              )}
              {missingTokens.length > 0 && (
                <>
                  <br/>
                  <span className="italic text-[0.95rem] text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]">
                    {missingTokens.length} blank{missingTokens.length !== 1 ? 's' : ''} still in the draft: {missingTokens.map((t) => `{{${t}}}`).join(', ')}
                  </span>
                </>
              )}
              <br/>
              <span className="italic muted text-[0.95rem]">Proceed with caution — this cannot be retrieved.</span>
            </p>
            <div className="stamp text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)] text-xs">
              Pending
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleSend}
              disabled={loading}
              className="btn-transmit !py-3 flex-1 min-w-[180px]"
            >
              {loading ? 'Sending…' : 'Confirm & Transmit'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={loading}
              className="btn-ghost !py-3 !px-6"
            >
              Retract
            </button>
          </div>
        </div>
      )}

      {/* Results report — telegraph style */}
      {progress && results && (
        <div className="border-t border-current pt-4 mt-4">
          <div className="label mb-2">Transmission report</div>
          {progress.total === 1 ? (
            <p className={`font-display text-lg leading-snug ${
              progress.sent === 1
                ? ''
                : 'text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]'
            }`}>
              {progress.sent === 1 ? (
                <>
                  <span className="numeral text-3xl mr-2">✓</span>
                  Delivered to <span className="ink-mark">{results[0].to}</span>.
                </>
              ) : (
                <>
                  <span className="numeral text-3xl mr-2">✕</span>
                  {results[0].error || 'Failed to send.'}
                </>
              )}
            </p>
          ) : (
            <>
              <p className="font-display text-lg leading-snug">
                <span className="numeral text-3xl mr-2">{progress.sent}</span>
                delivered
                <span className="muted mx-2">·</span>
                <span className={`numeral text-3xl mr-2 ${progress.failed > 0 ? 'text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]' : ''}`}>
                  {progress.failed}
                </span>
                returned
                <span className="muted"> of {progress.total}.</span>
              </p>
              {progress.failed > 0 && (
                <div className="mt-3 text-sm space-y-1">
                  {results.filter((r) => !r.success).map((r) => (
                    <p key={r.to}>
                      <span className="label mr-2 text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]">Return:</span>
                      {r.to} — {r.error}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════ END LEFT PANE ═══════ */}
      </div>

      {/* ═══════ RIGHT PANE — preview / edit (sticky on lg+) ═══════ */}
      {activeTemplate && (
        <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="label text-left inline-flex items-center gap-2 hover:text-[var(--color-dispatch)] dark:hover:text-[var(--color-dispatch-n)] transition"
            >
              {showPreview ? '▾' : '▸'} Preview the dispatch
              {missingTokens.length > 0 && (
                <span className="text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)] not-italic text-[0.72rem] font-medium">
                  · {missingTokens.length} blank{missingTokens.length !== 1 ? 's' : ''} unfilled
                </span>
              )}
              {isDirty && !editing && (
                <span className="not-italic text-[0.72rem] font-medium text-[var(--color-stamp)]">· edited</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing((v) => !v)
                setShowPreview(true)
                setSaveStatus(null)
              }}
              className="btn-ghost !py-1 !px-2.5 !text-[0.7rem] !tracking-normal !normal-case !font-medium"
            >
              {editing ? '✕ Done editing' : '✎ Edit this dispatch'}
            </button>
          </div>

          {showPreview && (
            <div className="mt-3 border-l-2 border-current pl-4 py-1 space-y-3">
              {/* Editable source */}
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-[0.7rem] muted block mb-1 font-medium">Subject (source)</label>
                    <input
                      type="text"
                      value={draftSubject}
                      onChange={(e) => setDraftSubject(e.target.value)}
                      className="field !py-2 !text-sm font-mono"
                      spellCheck={false}
                    />
                  </div>
                  <div>
                    <label className="text-[0.7rem] muted block mb-1 font-medium">Body (source)</label>
                    <textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      className="field !py-2 !text-sm font-mono"
                      rows={10}
                      spellCheck={false}
                    />
                    <p className="muted text-[0.7rem] italic font-display mt-1">
                      Any <span className="font-mono not-italic">{'{{token}}'}</span> is filled from the inputs on the left.
                    </p>
                  </div>

                  {/* Save controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveChanges}
                      disabled={!isDirty || isDefaultTemplate}
                      title={
                        isDefaultTemplate
                          ? 'The default template is synthesized from .env — save as a new template instead.'
                          : isDirty
                            ? `Overwrite ${activeTemplate.id}.txt on disk`
                            : 'No unsaved changes'
                      }
                      className="btn-ghost !py-1.5 !px-3 !text-[0.7rem] !tracking-normal !normal-case !font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save to {activeTemplate.id}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAsNew}
                      className="btn-ghost !py-1.5 !px-3 !text-[0.7rem] !tracking-normal !normal-case !font-medium"
                      title="Write a new file under data/templates/"
                    >
                      Save as new…
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardEdits}
                      disabled={!isDirty}
                      className="btn-ghost !py-1.5 !px-3 !text-[0.7rem] !tracking-normal !normal-case !font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Revert subject and body to the saved template"
                    >
                      Discard edits
                    </button>
                    {saveStatus && (
                      <span
                        className={`text-[0.72rem] italic font-display ${
                          saveStatus.kind === 'ok'
                            ? 'text-[var(--color-stamp)]'
                            : 'text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]'
                        }`}
                      >
                        {saveStatus.kind === 'ok' ? '✓ ' : '✕ '}{saveStatus.text}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Rendered preview — always shown when preview is open */}
              <div className={editing ? 'border-t border-current/40 pt-3' : ''}>
                <div className="label mb-1.5">
                  {editing ? 'Rendered preview' : 'What will be sent'}
                </div>
                <p className="font-mono text-sm">
                  <span className="muted mr-2">Subject:</span>
                  {previewSubject}
                </p>
                <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed mt-1">
                  {previewBody}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ END GRID ═══════ */}
      </div>
    </form>
  )
}
