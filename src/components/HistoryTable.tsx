interface SendRecord {
  to: string
  timestamp: string
  status: 'sent' | 'failed'
  error?: string
}

interface HistoryTableProps {
  history: SendRecord[]
  loading: boolean
}

export default function HistoryTable({ history, loading }: HistoryTableProps) {
  if (loading) {
    return <p className="text-sm text-gray-500 py-8 text-center">Loading history...</p>
  }

  if (history.length === 0) {
    return <p className="text-sm text-gray-500 py-8 text-center">No emails sent yet.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left text-gray-600">
            <th className="px-4 py-3 font-medium">Recipient</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {history.map((record, i) => (
            <tr key={`${record.to}-${record.timestamp}-${i}`} className="hover:bg-gray-50 transition">
              <td className="px-4 py-3 text-gray-900 font-mono text-xs">{record.to}</td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(record.timestamp).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                {record.status === 'sent' ? (
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                    Sent
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
                    title={record.error}
                  >
                    Failed
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
