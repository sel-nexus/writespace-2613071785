/** Render the PRD's native role emojis with accessible role labels. */
import PropTypes from "prop-types";

/** Return the reusable styled role span.
 * @param {string} role Account role.
 * @returns {JSX.Element} Crown for Admin or book for a user.
 */
export function getAvatar(role) {
  const admin = role === "admin";
  return (
    <span
      role="img"
      aria-label={admin ? "Admin avatar" : "User avatar"}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-white ${admin ? "bg-violet-600" : "bg-indigo-500"}`}
    >
      {admin ? "👑" : "📚"}
    </span>
  );
}

/** Display a role avatar.
 * @param {object} props Component props.
 * @param {string} props.role Account role.
 * @returns {JSX.Element} Accessible avatar.
 */
export function Avatar({ role = "user" }) {
  return getAvatar(role);
}

Avatar.propTypes = { role: PropTypes.oneOf(["admin", "user"]) };
