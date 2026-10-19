/** Offer only available public identity actions and a signed-in account destination. */
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Avatar } from "./Avatar.jsx";
import { getRoleHome } from "../utils/auth.js";

/** Render the sticky public brand and identity navigation.
 * @param {object} props Component props.
 * @param {object|null} props.session Current identity.
 * @returns {JSX.Element} Public header.
 */
export function PublicNavbar({ session = null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <nav
        aria-label="Public navigation"
        className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6"
      >
        <Link
          to="/"
          className="rounded-lg font-[Georgia] text-2xl font-bold tracking-tight text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          WriteSpace
        </Link>
        {session ? (
          <div className="flex items-center gap-3">
            <Avatar role={session.role} />
            <span className="hidden text-sm font-medium sm:inline">
              {session.displayName}
            </span>
            <Link
              to={getRoleHome(session)}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/login"
              className="rounded-lg px-2 py-2 text-sm font-medium text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Get Started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

PublicNavbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }),
};
