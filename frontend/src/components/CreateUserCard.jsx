export default function CreateUserCard({ newUser, setNewUser, onCreate, loading }) {
  return (
    <article className="rounded-2xl border border-[#e1e6fb] bg-white p-5 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.35)]">
      <h3 className="text-lg font-semibold text-[#1f2450]">Create User</h3>
      <p className="mt-1 text-sm text-[#7982ad]">Create users for kiosk unlock access</p>

      <div className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-[#36406c]">
          Username
          <input
            type="text"
            className="mt-1 w-full rounded-xl border border-[#d7dcf5] bg-[#f7f8ff] px-3 py-2 text-[#1f2450] outline-none ring-[#b5baff] focus:ring-2"
            value={newUser.username}
            onChange={(e) => setNewUser((prev) => ({ ...prev, username: e.target.value }))}
          />
        </label>
        <label className="block text-sm font-medium text-[#36406c]">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-xl border border-[#d7dcf5] bg-[#f7f8ff] px-3 py-2 text-[#1f2450] outline-none ring-[#b5baff] focus:ring-2"
            value={newUser.password}
            onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
          />
        </label>
        <button
          onClick={onCreate}
          disabled={loading}
          className="rounded-xl bg-[#7a4cff] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6a3df0] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Saving..." : "Create User"}
        </button>
      </div>
    </article>
  )
}
