/** Create browser-local user accounts with visible plaintext demo limitations. */
import { useState } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { register, validateRegistration, getRoleHome } from "../utils/auth.js";

const FIELDS = [
  {
    name: "displayName",
    label: "Display Name",
    type: "text",
    autoComplete: "nickname",
  },
  {
    name: "username",
    label: "Username",
    type: "text",
    autoComplete: "username",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "new-password",
  },
  {
    name: "confirmPassword",
    label: "Confirm Password",
    type: "password",
    autoComplete: "new-password",
  },
];

/** Render self-registration with field-associated errors and persisted success.
 * @param {object} props Component props.
 * @param {Function} props.onSessionChange Notify only after session persistence.
 * @returns {JSX.Element} Registration form.
 */
export default function RegisterPage({ onSessionChange }) {
  const [values, setValues] = useState({
    displayName: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const navigate = useNavigate();

  /** Validate all fields before saving the local account and session.
   * @param {Event} event Form submission.
   * @returns {void}
   */
  function submit(event) {
    event.preventDefault();
    const nextErrors = validateRegistration(values);
    setErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) return;
    try {
      const identity = register(values);
      onSessionChange(identity);
      navigate(getRoleHome(identity), { replace: true });
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main
      id="main-content"
      className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.15fr_1fr] lg:gap-20"
    >
      <section aria-label="About registration" className="max-w-xl">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Begin with a name
        </p>
        <h1 className="font-[Georgia] text-5xl leading-tight tracking-tight text-slate-800 sm:text-6xl">
          Make room for your words.
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-slate-600">
          Create a local account. Keep it simple, keep it on this browser, and
          use a made-up password.
        </p>
        <div className="mt-8 border-l-2 border-indigo-200 pl-5 text-sm leading-6 text-slate-600">
          <p className="font-semibold text-slate-800">
            Demo only · plaintext passwords
          </p>
          <p className="mt-2">
            Never use a real password or sensitive data. Client-side role
            controls are not a security boundary. Clearing browser storage
            removes your account.
          </p>
          <p className="mt-3">
            Demo administrator: username <strong>admin</strong> / password{" "}
            <strong>admin</strong>.
          </p>
        </div>
      </section>
      <section
        aria-labelledby="register-title"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-9"
      >
        <p className="text-sm font-semibold text-indigo-600">WriteSpace</p>
        <h2
          id="register-title"
          className="mt-3 text-2xl font-semibold text-slate-800"
        >
          Create your account
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          All fields are required. Registration creates a user account.
        </p>
        <form noValidate onSubmit={submit} className="mt-6 space-y-4">
          {FIELDS.map((field) => (
            <div key={field.name}>
              <label
                htmlFor={`register-${field.name}`}
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                {field.label}
              </label>
              <input
                id={`register-${field.name}`}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                required
                aria-required="true"
                aria-invalid={Boolean(errors[field.name])}
                aria-describedby={
                  errors[field.name]
                    ? `register-${field.name}-error`
                    : undefined
                }
                value={values[field.name]}
                onChange={(event) =>
                  setValues({ ...values, [field.name]: event.target.value })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              {errors[field.name] && (
                <p
                  id={`register-${field.name}-error`}
                  role="alert"
                  className="mt-2 text-sm text-red-600"
                >
                  {errors[field.name]}
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
            Register
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link
            to="/login"
            className="rounded text-indigo-600 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}

RegisterPage.propTypes = { onSessionChange: PropTypes.func.isRequired };
