import { useCallback, useEffect, useMemo, useState } from "react"
import {
  adminLogin,
  adminRegister,
  createUser,
  fetchUserAnalytics,
  fetchUserLogs,
  fetchUsers,
} from "./api/adminApi"
import CreateUserCard from "./components/CreateUserCard"
import LoginView from "./components/LoginView"
import UserDetailsPage from "./components/UserDetailsPage"
import UsersTableCard from "./components/UsersTableCard"
import { normalizeLogs, normalizeUsers } from "./utils/normalizers"

function getErrorMessage(error, fallback = "Request failed") {
  return error?.response?.data?.error || error?.message || fallback
}

function buildAnalyticsFromLogs(username, logs) {
  const safeLogs = Array.isArray(logs) ? logs : []
  if (safeLogs.length === 0) {
    return {
      username,
      total_logs: 0,
      total_span_seconds: 0,
      total_span_hours: 0,
      first_log: null,
      last_log: null,
      hourly_counts: [],
      daily_counts: [],
    }
  }

  const dates = safeLogs
    .map((log) => new Date(log.timestamp))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  if (dates.length === 0) {
    return {
      username,
      total_logs: safeLogs.length,
      total_span_seconds: 0,
      total_span_hours: 0,
      first_log: null,
      last_log: null,
      hourly_counts: [],
      daily_counts: [],
    }
  }

  const first = dates[0]
  const last = dates[dates.length - 1]
  const totalSpanSeconds = Math.max(0, Math.floor((last - first) / 1000))

  const hourCountMap = new Map()
  dates.forEach((d) => {
    const hour = d.getHours()
    hourCountMap.set(hour, (hourCountMap.get(hour) || 0) + 1)
  })

  const hourly_counts = Array.from(hourCountMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, count }))

  return {
    username,
    total_logs: safeLogs.length,
    total_span_seconds: totalSpanSeconds,
    total_span_hours: Number((totalSpanSeconds / 3600).toFixed(2)),
    first_log: first.toISOString(),
    last_log: last.toISOString(),
    hourly_counts,
    daily_counts: [],
  }
}

export default function App() {
  const [auth, setAuth] = useState({ username: "", password: "" })
  const [newUser, setNewUser] = useState({ username: "", password: "" })
  const [users, setUsers] = useState([])
  const [token, setToken] = useState(localStorage.getItem("token") || "")
  const [loggedInAdmin, setLoggedInAdmin] = useState(
    localStorage.getItem("admin") || ""
  )
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)

  const [currentPage, setCurrentPage] = useState("dashboard")
  const [selectedUser, setSelectedUser] = useState("")
  const [selectedUserLogs, setSelectedUserLogs] = useState([])
  const [selectedUserAnalytics, setSelectedUserAnalytics] = useState(null)
  const [selectedUserSearch, setSelectedUserSearch] = useState("")

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username)),
    [users]
  )

  const loadUsers = useCallback(async (sessionToken = token) => {
    try {
      const data = await fetchUsers(sessionToken)
      setUsers(normalizeUsers(data))
    } catch (error) {
      setStatus(getErrorMessage(error))
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    loadUsers(token)
  }, [loadUsers, token])

  const handleLogin = async () => {
    if (!auth.username || !auth.password) {
      setStatus("Username and password required")
      return
    }

    setLoading(true)
    setStatus("")
    try {
      const data = await adminLogin(auth)
      setToken(data.token)
      setLoggedInAdmin(data.admin)
      localStorage.setItem("token", data.token)
      localStorage.setItem("admin", data.admin)
      setAuth({ username: "", password: "" })
    } catch (error) {
      setStatus(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (!auth.username || !auth.password) {
      setStatus("Username and password required")
      return
    }

    setLoading(true)
    setStatus("")
    try {
      await adminRegister(auth)
      setStatus("Admin registered. You can login now.")
    } catch (error) {
      setStatus(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      setStatus("Username and password required")
      return
    }

    setLoading(true)
    setStatus("")
    try {
      await createUser(token, newUser)
      setNewUser({ username: "", password: "" })
      await loadUsers()
      setStatus("User created successfully.")
      setShowCreateUserModal(false)
    } catch (error) {
      setStatus(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const openUserDetails = async (username) => {
    setLoading(true)
    setStatus("")
    setCurrentPage("user")
    setSelectedUser(username)
    setSelectedUserSearch("")
    setSelectedUserLogs([])
    setSelectedUserAnalytics(null)

    try {
      const logsData = await fetchUserLogs(token, username)
      const normalizedLogs = normalizeLogs(logsData, username)
      setSelectedUserLogs(normalizedLogs)

      try {
        const analyticsData = await fetchUserAnalytics(token, username)
        setSelectedUserAnalytics(analyticsData)
      } catch (analyticsError) {
        if (analyticsError?.response?.status === 404) {
          setSelectedUserAnalytics(buildAnalyticsFromLogs(username, normalizedLogs))
          setStatus("Analytics endpoint not found. Showing computed analytics from logs.")
        } else {
          throw analyticsError
        }
      }
    } catch (error) {
      setStatus(getErrorMessage(error))
      setSelectedUserLogs([])
      setSelectedUserAnalytics(null)
    } finally {
      setLoading(false)
    }
  }

  const goDashboard = () => {
    setCurrentPage("dashboard")
  }

  const handleLogout = () => {
    setToken("")
    setUsers([])
    setCurrentPage("dashboard")
    setSelectedUser("")
    setSelectedUserLogs([])
    setSelectedUserAnalytics(null)
    setSelectedUserSearch("")
    setLoggedInAdmin("")
    setStatus("")
    localStorage.clear()
  }

  if (!token) {
    return (
      <LoginView
        auth={auth}
        setAuth={setAuth}
        onLogin={handleLogin}
        onRegister={handleRegister}
        loading={loading}
        status={status}
      />
    )
  }

  return (
    <main className="min-h-screen w-full bg-[#eef1fb]">
      <div className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex">
        <aside className="w-16 shrink-0 flex-col items-center justify-between border-r border-[#e5e9fb] bg-[#f7f8ff] py-4 md:flex">
          <div className="flex flex-col items-center gap-3">
            <div className="text-sm font-bold text-[#7a4cff]">KS</div>
            <button
              onClick={goDashboard}
              className={`h-8 w-8 rounded-lg text-xs font-semibold ${currentPage === "dashboard" ? "bg-[#7a4cff] text-white" : "bg-[#eef1ff] text-[#6470a3]"}`}
              title="Dashboard"
            >
              H
            </button>
            <button
              onClick={() => selectedUser && setCurrentPage("user")}
              disabled={!selectedUser}
              className={`h-8 w-8 rounded-lg text-xs font-semibold ${currentPage === "user" ? "bg-[#7a4cff] text-white" : "bg-[#eef1ff] text-[#6470a3]"} ${!selectedUser ? "opacity-50" : ""}`}
              title="User Details"
            >
              U
            </button>
          </div>
          <div className="h-8 w-8 rounded-full bg-[#dfe4ff] text-center text-xs font-semibold leading-8 text-[#3f4a7d]">
            {loggedInAdmin?.[0]?.toUpperCase() || "A"}
          </div>
        </aside>

        <aside className="w-56 shrink-0 border-r border-[#e5e9fb] bg-[#f7f8ff] text-[#5f6998]">
          <div className="border-b border-[#e5e9fb] px-5 py-4">
            <p className="text-sm font-semibold text-[#1f2450]">Kiosk Dashboard</p>
          </div>
          <nav className="space-y-1 px-3 py-4">
            <button
              onClick={goDashboard}
              className={`w-full rounded-sm px-3 py-2 text-left text-sm font-medium transition ${currentPage === "dashboard"
                ? "bg-[#7a4cff] text-white shadow-sm"
                : "hover:bg-[#eceffe] text-[#4f598c]"
                }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => selectedUser && setCurrentPage("user")}
              className={`w-full rounded-sm px-3 py-2 text-left text-sm font-medium transition ${currentPage === "user"
                ? "bg-[#7a4cff] text-white shadow-sm"
                : "hover:bg-[#eceffe] text-[#4f598c]"
                } ${!selectedUser ? "cursor-not-allowed opacity-50" : ""}`}
              disabled={!selectedUser}
            >
              User Details
            </button>
          </nav>
          <div className="mt-6 border-t border-[#e5e9fb] px-4 py-4 text-xs">
            <p className="text-[#8b95bd]">Current User</p>
            <p className="mt-1 truncate text-sm text-[#1f2450]">{selectedUser || "No user selected"}</p>
            <p className="mt-3 text-[#8b95bd]">Admin</p>
            <p className="mt-1 truncate text-sm text-[#1f2450]">{loggedInAdmin}</p>
          </div>
        </aside>
      </div>

      <div className="min-h-screen w-full md:pl-72">
        <div className="min-h-screen bg-[#f3f5fd]">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9fb] bg-white px-4 py-3">
            <h2 className="text-base font-semibold text-[#1f2450]">Admin: {loggedInAdmin}</h2>
            <div className="flex items-center gap-3">
              <span className="text-[#8d97bf]">N</span>
              <span className="text-[#8d97bf]">S</span>
              <div className="h-8 w-8 rounded-full bg-[#dfe4ff] text-center text-xs font-semibold leading-8 text-[#3f4a7d]">
                {loggedInAdmin?.[0]?.toUpperCase() || "A"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-[#d7dcf5] bg-[#f7f8ff] px-3 py-1.5 text-xs font-semibold text-[#4b5588] hover:bg-[#eef1ff]"
            >
              Logout
            </button>
          </header>

          <div className="space-y-4 p-4">
            <div className="block md:hidden">
              <div className="rounded-lg border border-[#e5e9fb] bg-white p-2">
                <button
                  onClick={goDashboard}
                  className={`mr-2 rounded px-3 py-1.5 text-xs font-semibold ${currentPage === "dashboard"
                    ? "bg-[#7a4cff] text-white"
                    : "bg-[#eef1ff] text-[#4b5588]"
                    }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => selectedUser && setCurrentPage("user")}
                  disabled={!selectedUser}
                  className={`rounded px-3 py-1.5 text-xs font-semibold ${currentPage === "user"
                    ? "bg-[#7a4cff] text-white"
                    : "bg-[#eef1ff] text-[#4b5588]"
                    } ${!selectedUser ? "opacity-50" : ""}`}
                >
                  User Details
                </button>
              </div>
            </div>

            {currentPage === "dashboard" ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl border border-[#e1e6fb] bg-white px-4 py-3 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.35)]">
                  <div>
                    <p className="text-base font-semibold text-[#1f2450]">Users</p>
                    <p className="text-xs text-[#7982ad]">Manage users and open details</p>
                  </div>
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#7a4cff] text-xl font-bold text-white hover:bg-[#6a3df0]"
                    title="Create User"
                  >
                    +
                  </button>
                </div>
                <UsersTableCard users={sortedUsers} onOpenUser={openUserDetails} />
              </section>
            ) : (
              <UserDetailsPage
                username={selectedUser}
                logs={selectedUserLogs}
                analytics={selectedUserAnalytics}
                loading={loading}
                search={selectedUserSearch}
                setSearch={setSelectedUserSearch}
                onBack={goDashboard}
              />
            )}

            {loading ? (
              <p className="rounded-xl border border-[#d7dcf5] bg-[#f7f8ff] px-3 py-2 text-sm font-medium text-[#6a3df0]">
                Loading...
              </p>
            ) : null}
            {status ? (
              <p className="rounded-xl border border-[#d7dcf5] bg-[#f7f8ff] px-3 py-2 text-sm font-medium text-[#6a3df0]">
                {status}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {showCreateUserModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#11142a]/45 p-4">
          <div className="relative w-full max-w-xl">
            <button
              onClick={() => setShowCreateUserModal(false)}
              className="absolute right-3 top-3 z-10 h-8 w-8 rounded-lg bg-[#eef1ff] text-lg font-bold text-[#4b5588] hover:bg-[#dfe4ff]"
              title="Close"
            >
              x
            </button>
            <CreateUserCard
              newUser={newUser}
              setNewUser={setNewUser}
              onCreate={handleCreateUser}
              loading={loading}
            />
          </div>
        </div>
      ) : null}
    </main>
  )
}
