/** Present local login or the current persisted account; use demo credentials only. */
import { useState } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { login, getRoleHome } from "../utils/auth.js";
import { Avatar } from "../components/Avatar.jsx";

/** Render login fields or meaningful signed-in identity details.
 * @param {object} props Component props.
 * @param {object|null} props.session Valid current session.
 * @param {Function} props.onSessionChange Notify after persisted login.
 * @returns {JSX.Element} Identity view.
 */
export default function LoginPage({ session = null, onSessionChange }) {
  const [values, setValues] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const navigate = useNavigate();

  /** Validate required fields and report storage or credential errors inline.
   * @param {Event} event Form submission.
   * @returns {void}
   */
  function submit(event) {
    event.preventDefault();
    const nextErrors = {};
    if (!values.username.trim()) nextErrors.username = "Username is required.";
    if (!values.password.trim()) nextErrors.password = "Password is required.";
    setErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) return;
    try {
      const identity = login(values.username, values.password);
      onSessionChange(identity);
      navigate(getRoleHome(identity), { replace: true });
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main
      id="main-content"
      className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:py-20"
    >
      <section aria-label="About local identity" className="max-w-xl">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
          A place for your words
        </p>
        <h1 className="font-[Georgia] text-5xl leading-tight tracking-tight text-slate-800 sm:text-6xl">
          {session ? "Your space, signed in." : "Your thoughts. Your space."}
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
          Beautifully simple. A browser-local writing demo, starting with an
          account that lives on this device.
        </p>
        <div className="mt-10 border-l-2 border-indigo-200 pl-5">
          <p className="text-sm font-semibold text-slate-800">
            Demo only · not secure authentication
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Passwords are stored in plaintext in this browser. Never use a real
            password or sensitive data. Accounts do not sync across devices.
          </p>
          <p className="mt-3 text-sm text-slate-700">
            Demo administrator: username <strong>admin</strong> / password{" "}
            <strong>admin</strong>.
          </p>
        </div>
      </section>
      <section
        aria-labelledby="identity-title"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-9"
      >
        {session ? (
          <div>
            <Avatar role={session.role} />
            <h2
              id="identity-title"
              className="mt-5 text-2xl font-semibold text-slate-800"
            >
              Welcome, {session.displayName}
            </h2>
            <p role="status" className="mt-3 text-sm text-slate-600">
              You are signed in on this browser.
            </p>
            <dl className="mt-6 space-y-4 border-t border-slate-100 pt-6">
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">
                  Username
                </dt>
                <dd className="mt-1 break-words font-medium text-slate-800">
                  {session.username}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-slate-500">
                  Role
                </dt>
                <dd
                  className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-medium ${session.role === "admin" ? "bg-violet-100 text-violet-700 ring-1 ring-violet-300" : "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300"}`}
                >
                  {session.role === "admin" ? "Admin" : "user"}
                </dd>
              </div>
            </dl>
            <p className="mt-7 text-sm leading-6 text-slate-600">
              Use your account menu to log out. Your saved account stays in this
              browser for your next login.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-indigo-600">WriteSpace</p>
            <h2
              id="identity-title"
              className="mt-3 text-2xl font-semibold text-slate-800"
            >
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Log in to your local account.
            </p>
            <form noValidate onSubmit={submit} className="mt-7 space-y-5">
              {["username", "password"].map((field) => (
                <div key={field}>
                  <label
                    htmlFor={`login-${field}`}
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    {field === "username" ? "Username" : "Password"}
                  </label>
                  <input
                    id={`login-${field}`}
                    name={field}
                    type={field === "password" ? "password" : "text"}
                    autoComplete={
                      field === "password" ? "current-password" : "username"
                    }
                    required
                    aria-required="true"
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={
                      errors[field] ? `login-${field}-error` : undefined
                    }
                    value={values[field]}
                    onChange={(event) =>
                      setValues({ ...values, [field]: event.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  {errors[field] && (
                    <p
                      id={`login-${field}-error`}
                      role="alert"
                      className="mt-2 text-sm text-red-600"
                    >
                      {errors[field]}
                    </p>
                  )}
                </div>
              ))}
              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
                >
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Login
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-600">
              New here?{" "}
              <Link
                to="/register"
                className="rounded text-indigo-600 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Register
              </Link>
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

LoginPage.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }),
  onSessionChange: PropTypes.func.isRequired,
};
