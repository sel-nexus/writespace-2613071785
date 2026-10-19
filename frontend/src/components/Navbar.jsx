/** Show responsive role navigation and storage-aware logout for available destinations only. */
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Avatar } from "./Avatar.jsx";
import { clearSession } from "../utils/auth.js";

/** Render account navigation with mobile and account disclosures.
 * @param {object} props Component props.
 * @param {object} props.session Current identity.
 * @param {Function} props.onSessionChange Notify after successful logout.
 * @param {Array} props.links Available feature links with optional role restrictions.
 * @returns {JSX.Element} Authenticated header.
 */
export function Navbar({ session, onSessionChange, links = [] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const available = [
    { to: "/blogs", label: "All Blogs" },
    { to: "/write", label: "Write" },
    ...(session.role === "admin"
      ? [
          { to: "/admin", label: "Dashboard" },
          { to: "/users", label: "Users" },
        ]
      : []),
    ...links.filter(
      (link) =>
        !["/blogs", "/write", "/admin", "/users"].includes(link.to) &&
        (!link.role || link.role === session.role),
    ),
  ];

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [location.pathname]);

  /** Persist logout before changing visible identity.
   * @returns {void}
   */
  function logout() {
    try {
      clearSession();
      onSessionChange(null);
      setAccountOpen(false);
      setMobileOpen(false);
      navigate("/");
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <header
      className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setAccountOpen(false);
          setMobileOpen(false);
        }
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex min-h-20 items-center justify-between gap-3">
          <Link
            to="/"
            className="rounded-lg font-[Georgia] text-2xl font-bold tracking-tight text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            WriteSpace
          </Link>
          <nav
            aria-label="Account navigation"
            className="hidden items-center gap-2 sm:flex"
          >
            {available.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-indigo-500 ${isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="relative">
            <button
              type="button"
              aria-expanded={accountOpen}
              aria-controls="account-actions"
              aria-label={`Account options for ${session.displayName}`}
              onClick={() => setAccountOpen(!accountOpen)}
              className="flex items-center gap-2 rounded-full p-1 pr-3 text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Avatar role={session.role} />
              <span className="hidden max-w-40 truncate sm:inline">
                {session.displayName}
              </span>
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {accountOpen && (
              <div
                id="account-actions"
                className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
              >
                <p className="break-words px-3 py-2 text-sm text-slate-600">
                  {session.displayName}
                </p>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full rounded-lg px-3 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-3 text-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-500 sm:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        {mobileOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="flex flex-col gap-2 border-t border-slate-100 py-3 sm:hidden"
          >
            {available.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-indigo-500 ${isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}
        {error && (
          <p role="alert" className="pb-4 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </header>
  );
}

Navbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }).isRequired,
  onSessionChange: PropTypes.func.isRequired,
  links: PropTypes.arrayOf(
    PropTypes.shape({
      to: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      role: PropTypes.oneOf(["admin", "user"]),
    }),
  ),
};
