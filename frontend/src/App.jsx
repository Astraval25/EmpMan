import { useEffect, useMemo, useState } from "react"

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL ||
    "http://127.0.0.1:5000/api").trim()

function normalizeUsers(data) {
  if (!Array.isArray(data)) return []
  return data.map((u) => ({
    username: u.username,
    createdBy: u.created_by || "admin",
  }))
}

function normalizeLogs(data) {
  if (!Array.isArray(data)) return []
  return data.map((l) => ({
    activity: l.activity,
    timestamp: l.timestamp,
  }))
}

function App() {
  const [auth, setAuth] = useState({ username: "", password: "" })
  const [newUser, setNewUser] = useState({ username: "", password: "" })
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState("")
  const [logs, setLogs] = useState([])
  const [token, setToken] = useState(localStorage.getItem("token") || "")
  const [loggedInAdmin, setLoggedInAdmin] = useState(
    localStorage.getItem("admin") || ""
  )
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token) {
      loadUsers(token)
    }
  }, [token])

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username)),
    [users]
  )

  const sortedLogs = useMemo(
    () => [...logs].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    ),
    [logs]
  )

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  })

  // ================= SAFE FETCH =================
  const safeFetch = async (url, options) => {
    const res = await fetch(url, options)

    let data
    try {
      data = await res.json()
    } catch {
      throw new Error("Server error")
    }

    if (!res.ok) {
      throw new Error(data?.error || "Request failed")
    }

    return data
  }

  // ================= LOGIN =================
  const handleLogin = async () => {
    if (!auth.username || !auth.password) {
      setStatus("Username and password required")
      return
    }

    setLoading(true)
    setStatus("")

    try {
      const data = await safeFetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth),
      })

      setToken(data.token)
      setLoggedInAdmin(data.admin)

      localStorage.setItem("token", data.token)
      localStorage.setItem("admin", data.admin)

      setAuth({ username: "", password: "" })
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ================= REGISTER =================
  const handleRegister = async () => {
    if (!auth.username || !auth.password) {
      setStatus("Username and password required")
      return
    }

    setLoading(true)
    setStatus("")

    try {
      await safeFetch(`${API_BASE}/admin/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(auth),
      })

      setStatus("Admin registered. You can login now.")
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ================= LOAD USERS =================
  const loadUsers = async (sessionToken = token) => {
    try {
      const data = await safeFetch(`${API_BASE}/admin/users`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })

      setUsers(normalizeUsers(data))
    } catch (err) {
      setStatus(err.message)
    }
  }

  // ================= CREATE USER =================
  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      setStatus("Username and password required")
      return
    }

    setLoading(true)
    setStatus("")

    try {
      await safeFetch(`${API_BASE}/admin/users`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(newUser),
      })

      setNewUser({ username: "", password: "" })
      await loadUsers()
      setStatus("User created successfully.")
    } catch (err) {
      setStatus(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ================= LOAD LOGS =================
  const loadLogs = async (username) => {
    try {
      const data = await safeFetch(
        `${API_BASE}/admin/users/${username}/logs`,
        { headers: authHeaders() }
      )

      setSelectedUser(username)
      setLogs(normalizeLogs(data))
    } catch (err) {
      setStatus(err.message)
    }
  }

  // ================= LOGOUT =================
  const handleLogout = () => {
    setToken("")
    setUsers([])
    setLogs([])
    setSelectedUser("")
    setLoggedInAdmin("")
    localStorage.clear()
  }

  // ================= LOGIN PAGE =================
  if (!token) {
    return (
      <main className="page">
        <section className="card auth-card">
          <h1>Admin Login</h1>
          <p className="sub">Manage kiosk users and activity logs</p>
          <div className="form">
            <label>
              Username
              <input
                type="text"
                placeholder="Username"
                value={auth.username}
                onChange={(e) =>
                  setAuth({ ...auth, username: e.target.value })
                }
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder="Password"
                value={auth.password}
                onChange={(e) =>
                  setAuth({ ...auth, password: e.target.value })
                }
              />
            </label>

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button onClick={handleLogin} disabled={loading}>
                {loading ? "Loading..." : "Login"}
              </button>

              <button
                className="secondary"
                onClick={handleRegister}
                disabled={loading}
              >
                {loading ? "Loading..." : "Register"}
              </button>
            </div>
          </div>

          {status && <p className="status">{status}</p>}
        </section>
      </main>
    )
  }

  // ================= DASHBOARD =================
  return (
    <main className="page">
      <header className="header">
        <h2>Welcome, {loggedInAdmin}</h2>
        <button className="secondary" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <section className="grid-two">
        <article className="card">
          <h3>Create User</h3>
          <p className="hint">Create users for kiosk unlock access</p>
          <div className="form">
            <label>
              Username
              <input
                type="text"
                placeholder="New username"
                value={newUser.username}
                onChange={(e) =>
                  setNewUser({ ...newUser, username: e.target.value })
                }
              />
            </label>
            <label>
              Password
              <input
                type="password"
                placeholder="New password"
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
              />
            </label>
            <button onClick={handleCreateUser} disabled={loading}>
              {loading ? "Saving..." : "Create User"}
            </button>
          </div>
        </article>

        <article className="card">
          <h3>Users</h3>
          <p className="hint">Users created by this admin account</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Created By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No users found.</td>
                  </tr>
                ) : (
                  sortedUsers.map((u) => (
                    <tr key={u.username}>
                      <td>{u.username}</td>
                      <td>{u.createdBy}</td>
                      <td>
                        <button
                          className="secondary"
                          onClick={() => loadLogs(u.username)}
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {selectedUser && (
        <section className="card" style={{ marginTop: "18px" }}>
          <h3>Logs for {selectedUser}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {sortedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No logs found.</td>
                  </tr>
                ) : (
                  sortedLogs.map((log, i) => (
                    <tr key={i}>
                      <td>{log.activity}</td>
                      <td>{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {status && <p className="status">{status}</p>}
    </main>
  )
}

export default App
