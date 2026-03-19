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
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Email Application Sender</h1>
          <p className="mt-1 text-sm text-gray-500">
            Send your job application with one click.
          </p>
        </header>

        <div className="space-y-6">
          {/* Send Form Card */}
          <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Send Email</h2>
              <span className="text-xs text-gray-400">{todayCount} / 100 sent today</span>
            </div>
            <SendForm onSent={fetchHistory} history={history} />
          </section>

          {/* History Card */}
          <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
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
