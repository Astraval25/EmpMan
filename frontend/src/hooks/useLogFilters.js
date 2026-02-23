import { useCallback, useMemo, useRef, useState } from "react"

const getInitialFilters = () => ({
  activity: "",
  activityMode: "contains",
  dateMode: "on_or_after",
  dateValue: "",
  dateEnd: "",
  timeMode: "at_or_after",
  timeValue: "",
  timeEnd: "",
})

export function useLogFilters(logs) {
  const [filters, setFilters] = useState(getInitialFilters)
  const [showFilters, setShowFilters] = useState(true)
  const [filterType, setFilterType] = useState("activity")

  const activityRef = useRef(null)
  const dateRef = useRef(null)
  const timeRef = useRef(null)

  const filteredLogs = useMemo(() => {
    const parseDate = (value) => {
      if (!value) return null
      const parsed = new Date(`${value}T00:00:00`)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const parseTimeToMinutes = (value) => {
      if (!value) return null
      const [hours, minutes] = value.split(":").map(Number)
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
      return hours * 60 + minutes
    }

    const selectedDate = parseDate(filters.dateValue)
    const selectedDateEnd = parseDate(filters.dateEnd)
    const selectedTime = parseTimeToMinutes(filters.timeValue)
    const selectedTimeEnd = parseTimeToMinutes(filters.timeEnd)
    const activityQuery = filters.activity.trim().toLowerCase()

    return logs.filter((log) => {
      const logDate = new Date(log.timestamp)
      if (Number.isNaN(logDate.getTime())) return false

      const logActivity = (log.activity || "").toLowerCase()
      if (activityQuery) {
        if (filters.activityMode === "is" && logActivity !== activityQuery) return false
        if (filters.activityMode === "is_not" && logActivity === activityQuery) return false
        if (
          filters.activityMode === "starts_with" &&
          !logActivity.startsWith(activityQuery)
        ) {
          return false
        }
        if (
          filters.activityMode === "ends_with" &&
          !logActivity.endsWith(activityQuery)
        ) {
          return false
        }
        if (
          filters.activityMode === "contains" &&
          !logActivity.includes(activityQuery)
        ) {
          return false
        }
      }

      const logDay = new Date(
        logDate.getFullYear(),
        logDate.getMonth(),
        logDate.getDate()
      )
      if (selectedDate) {
        if (filters.dateMode === "on" && logDay.getTime() !== selectedDate.getTime()) {
          return false
        }
        if (filters.dateMode === "on_or_after" && logDay < selectedDate) return false
        if (filters.dateMode === "on_or_before" && logDay > selectedDate) return false
        if (filters.dateMode === "not_on" && logDay.getTime() === selectedDate.getTime()) {
          return false
        }
      }
      if (filters.dateMode === "between" && selectedDate && selectedDateEnd) {
        if (logDay < selectedDate || logDay > selectedDateEnd) return false
      }

      const logMinutes = logDate.getHours() * 60 + logDate.getMinutes()
      if (selectedTime !== null) {
        if (filters.timeMode === "at" && logMinutes !== selectedTime) return false
        if (filters.timeMode === "at_or_after" && logMinutes < selectedTime) return false
        if (filters.timeMode === "at_or_before" && logMinutes > selectedTime) return false
      }
      if (
        filters.timeMode === "between" &&
        selectedTime !== null &&
        selectedTimeEnd !== null
      ) {
        if (logMinutes < selectedTime || logMinutes > selectedTimeEnd) return false
      }

      return true
    })
  }, [filters, logs])

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(getInitialFilters())
    setShowFilters(true)
    setFilterType("activity")
  }, [])

  const selectFilterType = useCallback((type) => {
    setFilterType(type)
    setShowFilters(true)

    const refMap = {
      activity: activityRef,
      date: dateRef,
      time: timeRef,
    }
    const targetRef = refMap[type]
    if (targetRef?.current) targetRef.current.focus()
  }, [])

  return {
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
  }
}
