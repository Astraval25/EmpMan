import { useEffect } from "react"
import { useLogFilters } from "../hooks/useLogFilters"

const optionBoxClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-indigo-200 focus:ring-2"

function modeLabel(value) {
  return value.split("_").join(" ")
}

function RadioOption({ checked, onChange, name, label }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-indigo-600"
      />
      {label}
    </label>
  )
}

export default function LogsPanel({ selectedUser, logs }) {
  const {
    filters,
    showFilters,
    setShowFilters,
    filterType,
    filteredLogs,
    activityRef,
    dateRef,
    timeRef,
    updateFilter,
    resetFilters,
    selectFilterType,
  } = useLogFilters(logs)

  useEffect(() => {
    resetFilters()
  }, [logs, resetFilters])

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">
        {selectedUser === "ALL_USERS" ? "Logs for All Users" : `Logs for ${selectedUser}`}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        Showing {filteredLogs.length} of {logs.length} entries
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <button
          onClick={() => setShowFilters((prev) => !prev)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Filter Options
        </button>
        <label className="text-sm font-medium text-slate-700">
          Filter Type
          <select
            value={filterType}
            onChange={(e) => selectFilterType(e.target.value)}
            className={`${optionBoxClass} ml-2 min-w-44`}
          >
            <option value="activity">Search Activity</option>
            <option value="date">Date</option>
            <option value="time">Time</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {filters.activity ? (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Search {modeLabel(filters.activityMode)} {filters.activity}
          </span>
        ) : null}
        {filters.dateValue ? (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Date {modeLabel(filters.dateMode)} {filters.dateValue}
            {filters.dateMode === "between" && filters.dateEnd ? ` to ${filters.dateEnd}` : ""}
          </span>
        ) : null}
        {filters.timeValue ? (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Time {modeLabel(filters.timeMode)} {filters.timeValue}
            {filters.timeMode === "between" && filters.timeEnd ? ` to ${filters.timeEnd}` : ""}
          </span>
        ) : null}
      </div>

      {showFilters ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          {filterType === "activity" ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Search Activity</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <RadioOption
                  name="activityMode"
                  label="is"
                  checked={filters.activityMode === "is"}
                  onChange={() => updateFilter("activityMode", "is")}
                />
                <RadioOption
                  name="activityMode"
                  label="is not"
                  checked={filters.activityMode === "is_not"}
                  onChange={() => updateFilter("activityMode", "is_not")}
                />
                <RadioOption
                  name="activityMode"
                  label="starts with"
                  checked={filters.activityMode === "starts_with"}
                  onChange={() => updateFilter("activityMode", "starts_with")}
                />
                <RadioOption
                  name="activityMode"
                  label="ends with"
                  checked={filters.activityMode === "ends_with"}
                  onChange={() => updateFilter("activityMode", "ends_with")}
                />
                <RadioOption
                  name="activityMode"
                  label="contains"
                  checked={filters.activityMode === "contains"}
                  onChange={() => updateFilter("activityMode", "contains")}
                />
              </div>
              <input
                ref={activityRef}
                type="search"
                placeholder="Type activity text"
                value={filters.activity}
                onChange={(e) => updateFilter("activity", e.target.value)}
                className={`${optionBoxClass} w-full`}
              />
            </div>
          ) : null}

          {filterType === "date" ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Date</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <RadioOption
                  name="dateMode"
                  label="on"
                  checked={filters.dateMode === "on"}
                  onChange={() => updateFilter("dateMode", "on")}
                />
                <RadioOption
                  name="dateMode"
                  label="on or after"
                  checked={filters.dateMode === "on_or_after"}
                  onChange={() => updateFilter("dateMode", "on_or_after")}
                />
                <RadioOption
                  name="dateMode"
                  label="on or before"
                  checked={filters.dateMode === "on_or_before"}
                  onChange={() => updateFilter("dateMode", "on_or_before")}
                />
                <RadioOption
                  name="dateMode"
                  label="between"
                  checked={filters.dateMode === "between"}
                  onChange={() => updateFilter("dateMode", "between")}
                />
                <RadioOption
                  name="dateMode"
                  label="is not"
                  checked={filters.dateMode === "not_on"}
                  onChange={() => updateFilter("dateMode", "not_on")}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  ref={dateRef}
                  type="date"
                  value={filters.dateValue}
                  onChange={(e) => updateFilter("dateValue", e.target.value)}
                  className={optionBoxClass}
                />
                {filters.dateMode === "between" ? (
                  <input
                    type="date"
                    value={filters.dateEnd}
                    onChange={(e) => updateFilter("dateEnd", e.target.value)}
                    className={optionBoxClass}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          {filterType === "time" ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Time</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <RadioOption
                  name="timeMode"
                  label="at"
                  checked={filters.timeMode === "at"}
                  onChange={() => updateFilter("timeMode", "at")}
                />
                <RadioOption
                  name="timeMode"
                  label="at or after"
                  checked={filters.timeMode === "at_or_after"}
                  onChange={() => updateFilter("timeMode", "at_or_after")}
                />
                <RadioOption
                  name="timeMode"
                  label="at or before"
                  checked={filters.timeMode === "at_or_before"}
                  onChange={() => updateFilter("timeMode", "at_or_before")}
                />
                <RadioOption
                  name="timeMode"
                  label="between"
                  checked={filters.timeMode === "between"}
                  onChange={() => updateFilter("timeMode", "between")}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  ref={timeRef}
                  type="time"
                  value={filters.timeValue}
                  onChange={(e) => updateFilter("timeValue", e.target.value)}
                  className={optionBoxClass}
                />
                {filters.timeMode === "between" ? (
                  <input
                    type="time"
                    value={filters.timeEnd}
                    onChange={(e) => updateFilter("timeEnd", e.target.value)}
                    className={optionBoxClass}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <button
            onClick={resetFilters}
            className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Clear Filters
          </button>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">User</th>
              <th className="px-3 py-2 text-left font-semibold">Activity</th>
              <th className="px-3 py-2 text-left font-semibold">Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-3 text-slate-500">
                  {logs.length === 0 ? "No logs found." : "No logs match selected filters."}
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, index) => (
                <tr key={`${log.timestamp}-${index}`} className="border-t border-slate-100">
                  <td className="px-3 py-3 text-slate-700">{log.username || "-"}</td>
                  <td className="px-3 py-3 text-slate-800">{log.activity}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
