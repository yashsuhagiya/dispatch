interface Stats {
  todayCount: number
  weekCount: number
  total: number
  rate: number
  streak: number
  responded: number
}

function Stat({
  value,
  label,
  suffix,
  emphasis,
}: {
  value: string | number
  label: string
  suffix?: string
  emphasis?: boolean
}) {
  return (
    <div className="flex flex-col justify-between gap-3 py-5 px-4 sm:px-6 relative">
      <div className="flex items-baseline gap-1.5">
        <span
          className={`numeral text-[clamp(3rem,8vw,6rem)] ${
            emphasis ? 'text-[var(--color-dispatch)] dark:text-[var(--color-dispatch-n)]' : ''
          }`}
        >
          {value}
        </span>
        {suffix && (
          <span className="font-display italic text-xl sm:text-2xl muted translate-y-[-0.2em]">
            {suffix}
          </span>
        )}
      </div>
      <div className="font-display italic text-[0.95rem] leading-tight">
        {label}
      </div>
    </div>
  )
}

export default function StatsStrip({ stats }: { stats: Stats }) {
  return (
    <div className="relative">
      <div
        className="grid grid-cols-2 md:grid-cols-4 border-y-2 border-current"
      >
        <div className="border-r border-current">
          <Stat value={stats.todayCount} label="Dispatched today" emphasis={stats.todayCount > 0} />
        </div>
        <div className="md:border-r border-current border-r-0">
          <Stat value={stats.weekCount} label="Trailing seven days" />
        </div>
        <div className="border-t md:border-t-0 md:border-r border-current">
          <Stat value={stats.streak} suffix="d." label="Consecutive streak" emphasis={stats.streak >= 3} />
        </div>
        <div className="border-t md:border-t-0 border-current">
          <Stat value={stats.rate} suffix="%" label={`Responses, of ${stats.total} sent`} />
        </div>
      </div>
    </div>
  )
}
