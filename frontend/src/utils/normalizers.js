export function normalizeUsers(data) {
  if (!Array.isArray(data)) return []

  return data.map((user) => ({
    username: user.username,
    createdBy: user.created_by || "admin",
  }))
}

export function normalizeLogs(data, fallbackUsername = "") {
  if (!Array.isArray(data)) return []

  return data.map((log) => ({
    activity: log.activity || "",
    timestamp: log.timestamp,
    username: log.username || fallbackUsername,
  }))
}
