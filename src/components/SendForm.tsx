import { useState, useRef } from 'react'

interface SendFormProps {
  onSent: () => void
  history: { to: string }[]
}

function parseEmails(input: string): string[] {
  return input
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0)
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function SendForm({ onSent, history }: SendFormProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(null)
  const [results, setResults] = useState<{ to: string; success: boolean; error?: string }[] | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const sendingRef = useRef(false)

  const emails = parseEmails(input)
  const validEmails = emails.filter(isValidEmail)
  const invalidEmails = emails.filter((e) => !isValidEmail(e))
  const duplicates = validEmails.filter((e) =>
    history.some((r) => r.to.toLowerCase() === e.toLowerCase())
  )

  async function handleSend() {
    if (sendingRef.current || validEmails.length === 0) return
    sendingRef.current = true
    setLoading(true)
    setResults(null)
    setProgress(null)
    setShowConfirm(false)

    try {
      if (validEmails.length === 1) {
        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: validEmails[0] }),
        })
        const data = await res.json()
        setResults([{ to: validEmails[0], success: data.success, error: data.error }])
        setProgress({ sent: data.success ? 1 : 0, failed: data.success ? 0 : 1, total: 1 })
      } else {
        const res = await fetch('/api/send-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipients: validEmails }),
        })
        const data = await res.json()
        setResults(data.results)
        setProgress({ sent: data.sent, failed: data.failed, total: validEmails.length })
      }
      setInput('')
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="recipients" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Recipient Emails
        </label>
        <textarea
          id="recipients"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setShowConfirm(false)
            setResults(null)
          }}
          placeholder={"recruiter@company.com\nhr@another.com, hiring@startup.io"}
          rows={3}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 outline-none transition resize-y"
          disabled={loading}
        />
        <div className="flex items-center justify-between mt-1.5">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            One per line, or comma/semicolon separated
          </p>
          {emails.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {validEmails.length} valid{invalidEmails.length > 0 && `, ${invalidEmails.length} invalid`}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || validEmails.length === 0}
        className="w-full rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? 'Sending...' : validEmails.length <= 1 ? 'Send' : `Send to ${validEmails.length} recipients`}
      </button>

      {invalidEmails.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          Invalid: {invalidEmails.join(', ')}
        </div>
      )}

      {duplicates.length > 0 && !showConfirm && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
          Already sent to: {duplicates.join(', ')}
        </div>
      )}

      {showConfirm && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 px-4 py-3">
          <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
            Send application email to{' '}
            <span className="font-medium">
              {validEmails.length === 1 ? validEmails[0] : `${validEmails.length} recipients`}
            </span>
            ?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={loading}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Sending...' : 'Confirm Send'}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={loading}
              className="rounded-md bg-gray-200 dark:bg-gray-700 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {progress && results && (
        <div className="space-y-2">
          <div className={`rounded-lg px-4 py-3 text-sm ${
            progress.failed === 0
              ? 'border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-400'
              : progress.sent === 0
                ? 'border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-400'
                : 'border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-400'
          }`}>
            {progress.total === 1
              ? (progress.sent === 1 ? `Sent to ${results[0].to}` : results[0].error || 'Failed to send')
              : `${progress.sent} sent, ${progress.failed} failed out of ${progress.total}`
            }
          </div>
          {progress.total > 1 && progress.failed > 0 && (
            <div className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
              {results.filter((r) => !r.success).map((r) => (
                <p key={r.to}>{r.to}: {r.error}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  )
}
