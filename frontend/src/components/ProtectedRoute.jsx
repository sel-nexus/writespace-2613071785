/** Gate local demo routes using validated persisted identity, not a security boundary. */
import PropTypes from "prop-types";
import { Navigate } from "react-router-dom";
import { getSession } from "../utils/auth.js";

/** Redirect guests and wrong roles before rendering protected content.
 * @param {object} props Component props.
 * @param {React.ReactNode} props.children Protected content.
 * @param {string} [props.role] Optional administrator restriction.
 * @returns {JSX.Element} Content or a fail-closed redirect.
 */
export function ProtectedRoute({ children, role }) {
  const session = getSession();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (role === "admin" && session.role !== "admin") {
    return <Navigate to="/blogs" replace />;
  }
  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  role: PropTypes.oneOf(["admin", "user"]),
};
