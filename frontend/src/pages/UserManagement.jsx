/** Administrator account creation and protected deletion using browser-local persistence. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { getSession } from "../utils/auth.js";
import {
  listUsers,
  validateUser,
  createUser,
  deleteUser,
} from "../utils/userService.js";
import { UserRow } from "../components/UserRow.jsx";

const emptyForm = { displayName: "", username: "", password: "", role: "" };

/** Render required field associations and responsive public account details.
 * @returns {JSX.Element} Guarded account management page.
 */
export default function UserManagement() {
  const [session] = useState(getSession);
  const [values, setValues] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  let users = [];
  let accessError = "";
  try {
    users = listUsers(session);
  } catch (failure) {
    accessError = failure.message;
  }

  /** Validate and save, retaining typed values when persistence fails.
   * @param {Event} event Form submission.
   * @returns {void}
   */
  function submit(event) {
    event.preventDefault();
    setError("");
    setStatus("");
    const validation = validateUser(values);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    try {
      createUser(values, session);
      setValues(emptyForm);
      setRevision(revision + 1);
      setStatus("Account created.");
    } catch (failure) {
      setError(failure.message);
    }
  }

  /** Confirm permitted account deletion, retaining records on cancel or write failure.
   * @param {object} user Account selected by the administrator.
   * @returns {void}
   */
  function removeUser(user) {
    setError("");
    setStatus("");
    if (
      !window.confirm(
        `Delete account “${user.username}”? Their posts will be retained.`,
      )
    ) {
      setStatus("Account deletion cancelled.");
      return;
    }
    try {
      deleteUser(user.id, session);
      setRevision(revision + 1);
      setStatus("Account deleted. Their posts were retained.");
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main
      id="main-content"
      className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6"
    >
      <header>
        <Link
          to="/admin"
          className="text-sm font-medium text-indigo-600 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Back to Dashboard
        </Link>
        <h1 className="mt-4 font-[Georgia] text-3xl font-bold">Manage Users</h1>
        <p className="mt-2 text-slate-500">
          Manage local accounts. Deleted accounts’ posts remain available.
        </p>
      </header>
      {(error || accessError) && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-600">
          {error || accessError}
        </p>
      )}
      <p role="status" className="text-sm text-slate-600">
        {status}
      </p>
      {!accessError && (
        <>
          <section
            aria-labelledby="create-user-heading"
            className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            <h2 id="create-user-heading" className="text-xl font-semibold">
              Create User
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Demo only: passwords are stored in plaintext. Never use real
              passwords.
            </p>
            <form
              noValidate
              onSubmit={submit}
              className="mt-5 grid gap-5 sm:grid-cols-2"
            >
              {[
                ["displayName", "Display Name", "text"],
                ["username", "Username", "text"],
                ["password", "Password", "password"],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label
                    htmlFor={`create-${field}`}
                    className="mb-2 block text-sm font-medium"
                  >
                    {label}
                  </label>
                  <input
                    id={`create-${field}`}
                    type={type}
                    value={values[field]}
                    required
                    aria-required="true"
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={
                      errors[field] ? `create-${field}-error` : undefined
                    }
                    autoComplete={field === "password" ? "new-password" : "off"}
                    onChange={(event) =>
                      setValues({ ...values, [field]: event.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {errors[field] && (
                    <p
                      id={`create-${field}-error`}
                      role="alert"
                      className="mt-2 text-sm text-red-600"
                    >
                      {errors[field]}
                    </p>
                  )}
                </div>
              ))}
              <div>
                <label
                  htmlFor="create-role"
                  className="mb-2 block text-sm font-medium"
                >
                  Role
                </label>
                <select
                  id="create-role"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors.role)}
                  aria-describedby={
                    errors.role ? "create-role-error" : undefined
                  }
                  value={values.role}
                  onChange={(event) =>
                    setValues({ ...values, role: event.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Choose a role</option>
                  <option value="admin">Admin</option>
                  <option value="user">user</option>
                </select>
                {errors.role && (
                  <p
                    id="create-role-error"
                    role="alert"
                    className="mt-2 text-sm text-red-600"
                  >
                    {errors.role}
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="justify-self-start rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Create User
              </button>
            </form>
          </section>
          <section aria-labelledby="accounts-heading">
            <h2 id="accounts-heading" className="mb-4 text-xl font-semibold">
              Accounts
            </h2>
            {users.length === 1 && (
              <p className="mb-4 text-slate-500">
                No created accounts yet. The built-in admin is always available.
              </p>
            )}
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
              <table aria-label="Accounts" className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    {[
                      "Display Name",
                      "Username",
                      "Role",
                      "Created",
                      "Actions",
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-4 py-4 font-medium"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      currentUserId={session.userId}
                      onDelete={removeUser}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div aria-label="Account cards" className="space-y-4 sm:hidden">
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  currentUserId={session.userId}
                  onDelete={removeUser}
                  mobile
                />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

UserManagement.propTypes = {};
