import { useMemo, useState } from "react"

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  return `${hours}h ${minutes}m`
}

function GraphCard({ title, data, color = "#7a4cff" }) {
  const width = 520
  const height = 180
  const padding = 20
  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0

  const points = data.map((item, index) => {
    const x = padding + index * stepX
    const y =
      height - padding - ((item.value || 0) / maxValue) * (height - padding * 2)
    return { x, y, label: item.label, value: item.value }
  })

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ")
  const areaPath = `${linePath} L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`

  return (
    <div className="rounded-3xl border border-[#dfe3ff] bg-gradient-to-b from-white to-[#f7f8ff] p-4 shadow-[0_20px_45px_-26px_rgba(74,53,170,0.45)]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#1f2450]">{title}</p>
        <span className="rounded-full bg-[#eef1ff] px-2.5 py-1 text-[11px] font-semibold text-[#5b67a0]">
          Active
        </span>
      </div>

      <div className="rounded-2xl border border-[#e7eaff] bg-white p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
          <defs>
            <linearGradient id={`fill-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.26" />
              <stop offset="100%" stopColor={color} stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((f, idx) => {
            const y = padding + f * (height - padding * 2)
            return (
              <line
                key={`grid-${idx}`}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#edf0ff"
                strokeWidth="1"
              />
            )
          })}

          <path
            d={areaPath}
            fill={`url(#fill-${title.replace(/\s+/g, "-")})`}
          />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p, i) => (
            <circle
              key={`dot-${title}-${i}`}
              cx={p.x}
              cy={p.y}
              r="3"
              fill={color}
              opacity="0.9"
            />
          ))}
        </svg>

        <div className="mt-1 grid grid-cols-6 gap-1 text-center md:grid-cols-12">
          {data.map((item, index) => (
            <span key={`${title}-label-${index}`} className="text-[10px] text-[#8690ba]">
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[#f5f7ff] px-2 py-1.5 text-[11px] text-[#5b67a0]">
          Max: <span className="font-semibold">{maxValue}</span>
        </div>
        <div className="rounded-xl bg-[#f5f7ff] px-2 py-1.5 text-[11px] text-[#5b67a0]">
          Points: <span className="font-semibold">{data.length}</span>
        </div>
        <div className="rounded-xl bg-[#f5f7ff] px-2 py-1.5 text-[11px] text-[#5b67a0]">
          Live: <span className="font-semibold">On</span>
        </div>
      </div>
    </div>
  )
}

function GraphSummaryCard({ totalHours }) {
  const pct = Math.max(0, Math.min(100, Math.round((Number(totalHours) || 0) % 100)))
  return (
    <div className="rounded-3xl border border-[#dfe3ff] bg-gradient-to-b from-white to-[#f7f8ff] p-4 shadow-[0_20px_45px_-26px_rgba(74,53,170,0.45)]">
      <p className="text-sm font-semibold text-[#1f2450]">Hours Summary</p>
      <div className="mt-4 flex items-center justify-center">
        <div
          className="grid h-32 w-32 place-items-center rounded-full"
          style={{
            background: `conic-gradient(#7a4cff ${pct}%, #e9edff ${pct}% 100%)`,
          }}
        >
          <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-[#1f2450]">
            <span className="text-lg font-semibold">{pct}%</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-[#5b67a0]">
        Total Hours: <span className="font-semibold text-[#1f2450]">{totalHours || 0}</span>
      </p>
    </div>
  )
}

function buildTodaySeries(logDates) {
  const counts = Array.from({ length: 24 }, () => 0)
  const now = new Date()
  logDates.forEach((d) => {
    if (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    ) {
      counts[d.getHours()] += 1
    }
  })

  return counts.map((value, hour) => ({
    label: String(hour).padStart(2, "0"),
    value,
  }))
}

function buildMonthSeries(logDates) {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const counts = Array.from({ length: daysInMonth }, () => 0)

  logDates.forEach((d) => {
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      counts[d.getDate() - 1] += 1
    }
  })

  return counts.map((value, index) => ({
    label: String(index + 1),
    value,
  }))
}

function buildYearSeries(logDates) {
  const now = new Date()
  const counts = Array.from({ length: 12 }, () => 0)
  const monthLabels = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]

  logDates.forEach((d) => {
    if (d.getFullYear() === now.getFullYear()) {
      counts[d.getMonth()] += 1
    }
  })

  return counts.map((value, i) => ({
    label: monthLabels[i],
    value,
  }))
}

export default function UserDetailsPage({
  username,
  logs,
  analytics,
  loading,
  search,
  setSearch,
  onBack,
}) {
  const [view, setView] = useState("overview")
  const logDates = useMemo(
    () =>
      logs
        .map((log) => new Date(log.timestamp))
        .filter((date) => !Number.isNaN(date.getTime())),
    [logs]
  )

  const todaySeries = useMemo(() => buildTodaySeries(logDates), [logDates])
  const monthSeries = useMemo(() => buildMonthSeries(logDates), [logDates])
  const yearSeries = useMemo(() => buildYearSeries(logDates), [logDates])

  const filteredLogs = useMemo(() => {
    const sorted = [...logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    const q = search.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((log) => (log.activity || "").toLowerCase().includes(q))
  }, [logs, search])

  const menuItems = [
    { id: "overview", label: "Overview" },
    { id: "graphs", label: "Graphs" },
  ]

  return (
    <section className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="rounded-2xl border border-[#e1e6fb] bg-white p-3 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.35)] lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-sm font-semibold text-[#1f2450]">{username}</p>
        <div className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${view === item.id
                ? "bg-[#7a4cff] text-white"
                : "text-[#4f598c] hover:bg-[#eceffe]"
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          onClick={onBack}
          className="mt-3 w-full rounded-lg border border-[#d7dcf5] bg-[#f7f8ff] px-3 py-2 text-xs font-semibold text-[#4b5588] hover:bg-[#eef1ff]"
        >
          Back
        </button>
      </aside>

      <div className="space-y-4">
        <div className="rounded-2xl border border-[#e1e6fb] bg-white p-4 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.35)]">
          <h3 className="text-xl font-semibold text-[#1f2450]">User: {username}</h3>
          <p className="text-sm text-[#7982ad]">All details and graph views</p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-[#d7dcf5] bg-[#f7f8ff] p-6 text-sm font-medium text-[#6a3df0]">
            Loading user details...
          </div>
        ) : null}

        {view === "overview" ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#e1e6fb] bg-white p-4 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.35)]">
                <p className="text-xs uppercase tracking-wide text-[#7f88b4]">Total Logs</p>
                <p className="mt-2 text-2xl font-semibold text-[#1f2450]">{analytics?.total_logs || 0}</p>
              </div>
              <div className="rounded-2xl border border-[#e1e6fb] bg-white p-4 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.35)]">
                <p className="text-xs uppercase tracking-wide text-[#7f88b4]">Total Time</p>
                <p className="mt-2 text-2xl font-semibold text-[#1f2450]">
                  {formatDuration(analytics?.total_span_seconds)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#e1e6fb] bg-white p-4 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.35)]">
                <p className="text-xs uppercase tracking-wide text-[#7f88b4]">Total Hours</p>
                <p className="mt-2 text-2xl font-semibold text-[#1f2450]">
                  {analytics?.total_span_hours || 0}
                </p>
              </div>
              <div className="rounded-2xl border border-[#e1e6fb] bg-white p-4 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.35)]">
                <p className="text-xs uppercase tracking-wide text-[#7f88b4]">First Log</p>
                <p className="mt-2 text-sm font-semibold text-[#1f2450]">
                  {analytics?.first_log ? new Date(analytics.first_log).toLocaleString() : "-"}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {view === "graphs" && (
          <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <GraphCard title="Today Graph (Hourly)" data={todaySeries} color="#7a4cff" />
              <GraphCard title="Month Graph (Daily)" data={monthSeries} color="#40c4aa" />
              <GraphCard title="Year Graph (Monthly)" data={yearSeries} color="#ff7b4b" />
            </div>
            <div>
              <GraphSummaryCard totalHours={analytics?.total_span_hours || 0} />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-[#e1e6fb] bg-white p-4 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.35)]">
          <label className="text-sm font-medium text-[#36406c]">
            Search Logs
            <input
              type="search"
              placeholder="Search activity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[#d7dcf5] bg-[#f7f8ff] px-3 py-2 text-[#1f2450] outline-none ring-[#b5baff] focus:ring-2"
            />
          </label>

          <div className="mt-3 overflow-x-auto rounded-xl border border-[#e6eaff]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f5f7ff] text-[#4b5588]">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Activity</th>
                  <th className="px-3 py-2 text-left font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-[#7982ad]" colSpan={2}>
                      No logs found.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, index) => (
                    <tr key={`${log.timestamp}-${index}`} className="border-t border-[#eef1ff]">
                      <td className="px-3 py-3 text-[#1f2450]">{log.activity}</td>
                      <td className="px-3 py-3 text-[#626c9d]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
