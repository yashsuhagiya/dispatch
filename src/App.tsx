import { useState, useEffect, useCallback } from 'react'
import SendForm from './components/SendForm'
import HistoryTable from './components/HistoryTable'

interface SendRecord {
  to: string
  timestamp: string
  status: 'sent' | 'failed'
  error?: string
}

export default function App() {
  const [history, setHistory] = useState<SendRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [dark, setDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )

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

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  const todayCount = history.filter((r) => {
    const d = new Date(r.timestamp)
    const now = new Date()
    return (
      r.status === 'sent' &&
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    )
  }).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email Application Sender</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Send your job application with one click.
            </p>
          </div>
          <button
            onClick={() => setDark(!dark)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 transition"
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06l-1.06-1.06a.75.75 0 1 0-1.06 1.06l1.06 1.06Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                <path fillRule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </header>

        <div className="space-y-6">
          <section className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Send Email</h2>
              <span className="text-xs text-gray-400">{todayCount} / 100 sent today</span>
            </div>
            <SendForm onSent={fetchHistory} history={history} />
          </section>

          <section className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm border border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Send History
              {history.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400">({history.length})</span>
              )}
            </h2>
            <HistoryTable history={history} loading={loading} />
          </section>
        </div>
      </div>
    </div>
  )
}
