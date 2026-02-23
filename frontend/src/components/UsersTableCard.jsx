export default function UsersTableCard({ users, onOpenUser }) {
  return (
    <article className="rounded-2xl border border-[#e1e6fb] bg-white p-5 shadow-[0_14px_40px_-24px_rgba(66,46,145,0.35)]">
      <h3 className="text-lg font-semibold text-[#1f2450]">Users</h3>
      <p className="mt-1 text-sm text-[#7982ad]">Card click opens next user details page</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {users.length === 0 ? (
          <p className="rounded-xl border border-[#e6eaff] bg-[#f7f8ff] px-3 py-3 text-sm text-[#7982ad]">
            No users found.
          </p>
        ) : (
          users.map((user) => (
            <button
              key={user.username}
              onClick={() => onOpenUser(user.username)}
              className="rounded-xl border border-[#e6eaff] bg-[#fbfcff] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#cfd6ff] hover:shadow-[0_12px_30px_-20px_rgba(66,46,145,0.45)]"
            >
              <p className="text-base font-semibold text-[#1f2450]">{user.username}</p>
              <p className="mt-1 text-xs text-[#7d87b2]">Created by {user.createdBy}</p>
              <span className="mt-3 inline-block rounded-lg bg-[#7a4cff] px-2.5 py-1 text-[11px] font-semibold text-white">
                View Details
              </span>
            </button>
          ))
        )}
      </div>
    </article>
  )
}
