/** Compose identity and public discovery; post reading and CRUD arrive in later slices. */
import { useEffect, useState } from "react";
import { Navigate, Routes, Route, useLocation } from "react-router-dom";
import { getSession, getRoleHome } from "./utils/auth.js";
import { PublicNavbar } from "./components/PublicNavbar.jsx";
import { Navbar } from "./components/Navbar.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

/** Render available routes and synchronize persisted session changes without Context.
 * @returns {JSX.Element} Public discovery and guarded identity routes.
 */
export default function App() {
  const [session, setSession] = useState(getSession);
  const { pathname } = useLocation();
  useEffect(() => {
    /** Refresh identity after storage changes in another tab.
     * @returns {void}
     */
    function syncSession() {
      setSession(getSession());
    }
    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  const identity = (
    <LoginPage session={session} onSessionChange={setSession} />
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-white p-3 text-indigo-600 focus:not-sr-only focus:absolute focus:z-50"
      >
        Skip to content
      </a>
      {session && pathname !== "/" ? (
        <Navbar session={session} onSessionChange={setSession} />
      ) : (
        <PublicNavbar session={session} />
      )}
      <Routes>
        <Route path="/" element={<LandingPage session={session} />} />
        <Route
          path="/login"
          element={
            session ? <Navigate to={getRoleHome(session)} replace /> : identity
          }
        />
        <Route
          path="/register"
          element={
            session ? (
              <Navigate to={getRoleHome(session)} replace />
            ) : (
              <RegisterPage onSessionChange={setSession} />
            )
          }
        />
        <Route
          path="/blogs"
          element={
            <ProtectedRoute>
              {identity}
            </ProtectedRoute>
          }
        />
        {/* Keep preview access guarded until the post slice replaces this identity view. */}
        <Route
          path="/blog/:id"
          element={
            <ProtectedRoute>
              {identity}
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              {identity}
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={<Navigate to={getRoleHome(session)} replace />}
        />
      </Routes>
    </div>
  );
}

App.propTypes = {};
