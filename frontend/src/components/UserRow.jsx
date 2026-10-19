/** Render public account details as a table row or stacked mobile card; never display credentials. */
import PropTypes from "prop-types";
import { Avatar } from "./Avatar.jsx";
import { formatPostDate } from "../utils/postService.js";

const badges = {
  admin: "bg-violet-100 text-violet-700 ring-violet-300",
  user: "bg-indigo-100 text-indigo-700 ring-indigo-300",
};

/** Render account metadata and its protected delete action.
 * @param {object} props Account, active identity ID, delete callback and mobile presentation flag.
 * @returns {JSX.Element} Desktop row or mobile article.
 */
export function UserRow({ user, currentUserId, onDelete, mobile = false }) {
  const reason =
    user.id === "admin"
      ? "Default admin cannot be deleted"
      : user.id === currentUserId
        ? "You cannot delete your active account."
        : "";
  const name = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar role={user.role} />
      <span className="break-words font-medium">{user.displayName}</span>
    </div>
  );
  const role = (
    <span
      className={`rounded-full px-3 py-0.5 text-sm font-medium ring-1 ${badges[user.role]}`}
    >
      {user.role === "admin" ? "Admin" : "user"}
    </span>
  );
  const date = user.createdAt ? (
    <time dateTime={user.createdAt}>{formatPostDate(user.createdAt)}</time>
  ) : (
    <span>Built-in account · no stored creation date</span>
  );
  const action = (
    <span title={reason || undefined} className="inline-block">
      <button
        type="button"
        aria-label={`Delete ${user.username}`}
        title={reason || undefined}
        disabled={Boolean(reason)}
        onClick={() => onDelete(user)}
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Delete
      </button>
    </span>
  );
  if (mobile) {
    return (
      <article
        aria-label={`Account ${user.username}`}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"
      >
        {name}
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Username</dt>
            <dd className="break-words">{user.username}</dd>
          </div>
          <div>
            <dt className="mb-1 text-slate-500">Role</dt>
            <dd>{role}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-600">{date}</dd>
          </div>
        </dl>
        {action}
      </article>
    );
  }
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-4">{name}</td>
      <td className="break-all px-4 py-4">{user.username}</td>
      <td className="px-4 py-4">{role}</td>
      <td className="px-4 py-4 text-sm text-slate-500">{date}</td>
      <td className="px-4 py-4">{action}</td>
    </tr>
  );
}

UserRow.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
    createdAt: PropTypes.string,
  }).isRequired,
  currentUserId: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
  mobile: PropTypes.bool,
};
