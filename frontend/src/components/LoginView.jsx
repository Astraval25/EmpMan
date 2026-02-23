export default function LoginView({
  auth,
  setAuth,
  onLogin,
  onRegister,
  loading,
  status,
}) {
  return (
    <main className="min-h-screen bg-[#edf0f9] p-6">
      <section className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-[#e1e6fb] bg-white p-6 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.45)]">
        <h1 className="text-2xl font-semibold text-[#1f2450]">Admin Login</h1>
        <p className="mt-1 text-sm text-[#7982ad]">
          Manage kiosk users and activity logs
        </p>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-[#36406c]">
            Username
            <input
              type="text"
              className="mt-1 w-full rounded-xl border border-[#d7dcf5] bg-[#f7f8ff] px-3 py-2 text-[#1f2450] outline-none ring-[#b5baff] focus:ring-2"
              value={auth.username}
              onChange={(e) => setAuth((prev) => ({ ...prev, username: e.target.value }))}
            />
          </label>

          <label className="block text-sm font-medium text-[#36406c]">
            Password
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-[#d7dcf5] bg-[#f7f8ff] px-3 py-2 text-[#1f2450] outline-none ring-[#b5baff] focus:ring-2"
              value={auth.password}
              onChange={(e) => setAuth((prev) => ({ ...prev, password: e.target.value }))}
            />
          </label>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onLogin}
            disabled={loading}
            className="rounded-xl bg-[#7a4cff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6a3df0] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Loading..." : "Login"}
          </button>
          <button
            onClick={onRegister}
            disabled={loading}
            className="rounded-xl border border-[#d7dcf5] bg-[#f7f8ff] px-4 py-2 text-sm font-semibold text-[#4b5588] hover:bg-[#eef1ff] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Loading..." : "Register"}
          </button>
        </div>

        {status ? <p className="mt-4 text-sm font-medium text-[#6a3df0]">{status}</p> : null}
      </section>
    </main>
  )
}
