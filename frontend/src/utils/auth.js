/** Provide local-only demo identity, not secure authentication. Never use real passwords. */
import { getUsers, saveUsers, isText } from "./storage.js";

export const ADMIN_SESSION = Object.freeze({
  userId: "admin",
  username: "admin",
  displayName: "Admin",
  role: "admin",
});
const SESSION_KEY = "writespace_session";

/** Match session fields to a currently existing account, failing closed.
 * @param {*} session Parsed or supplied session.
 * @returns {boolean} Whether identity and role match a valid account.
 */
function isSession(session) {
  if (
    !session ||
    !isText(session.userId) ||
    !isText(session.username) ||
    !isText(session.displayName) ||
    !["admin", "user"].includes(session.role)
  )
    return false;
  if (session.userId === "admin") {
    return Object.keys(ADMIN_SESSION).every(
      (key) => session[key] === ADMIN_SESSION[key],
    );
  }
  return getUsers().some(
    (user) =>
      user.id === session.userId &&
      user.username === session.username &&
      user.displayName === session.displayName &&
      user.role === session.role,
  );
}

/** Read a session without trusting corrupted or stale browser data.
 * @returns {object|null} Valid session or null on any read/validation failure.
 */
export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return isSession(session) ? session : null;
  } catch {
    return null;
  }
}

/** Persist only the public session fields of a valid identity.
 * @param {object} session Identity matching a current account.
 * @returns {object} Persisted public identity.
 * @throws {Error} If identity is invalid or persistence fails.
 */
export function setSession(session) {
  if (!isSession(session))
    throw new Error("Cannot save an invalid session. Please log in again.");
  const identity = {
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    role: session.role,
  };
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(identity));
  } catch {
    throw new Error(
      "Could not save your session. Enable local storage or free space, then try again.",
    );
  }
  return identity;
}

/** Clear the persisted session before reporting logout success.
 * @returns {void}
 * @throws {Error} If browser storage prevents removal.
 */
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    throw new Error("Could not log out. Enable local storage and try again.");
  }
}

/** Resolve the role destination used by identity and future feature slices.
 * @param {object|null} session Current session.
 * @returns {string} Role home or guest login.
 */
export function getRoleHome(session) {
  return session?.role === "admin"
    ? "/admin"
    : session?.role === "user"
      ? "/blogs"
      : "/login";
}

/** Log in using the built-in credential first, then validated local accounts.
 * @param {string} username Exact username.
 * @param {string} password Plaintext demo password.
 * @returns {object} Persisted session.
 * @throws {Error} If credentials are invalid or storage cannot persist the session.
 */
export function login(username, password) {
  if (!isText(username) || !isText(password))
    throw new Error("Invalid username or password.");
  if (username === "admin" && password === "admin")
    return setSession(ADMIN_SESSION);
  const user = getUsers().find(
    (record) => record.username === username && record.password === password,
  );
  if (!user) throw new Error("Invalid username or password.");
  return setSession({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });
}

/** Validate self-registration fields without allowing privileged role selection.
 * @param {object} values Display name, username, password, confirmation, optional role.
 * @returns {object} Field-specific errors; empty when valid.
 */
export function validateRegistration(values = {}) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    values = {};
  }
  const errors = {};
  for (const field of [
    "displayName",
    "username",
    "password",
    "confirmPassword",
  ]) {
    if (!isText(values[field])) errors[field] = "This field is required.";
  }
  if (
    isText(values.username) &&
    (values.username.trim().toLowerCase() === "admin" ||
      getUsers().some(
        (user) =>
          user.username.toLowerCase() === values.username.trim().toLowerCase(),
      ))
  ) {
    errors.username = "That username is already taken.";
  }
  if (
    isText(values.confirmPassword) &&
    values.password !== values.confirmPassword
  ) {
    errors.confirmPassword = "Passwords must match.";
  }
  if (values.role !== undefined && values.role !== "user")
    errors.role = "Self-registration only allows the user role.";
  return errors;
}

/** Register a user and persist identity only after successful account storage.
 * @param {object} values Required registration fields.
 * @returns {object} Persisted user session.
 * @throws {Error} If validation, account save, or session save fails.
 * Notes: If session storage fails, the saved account remains usable for a later login.
 */
export function register(values = {}) {
  const errors = validateRegistration(values);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const user = {
    id: crypto.randomUUID(),
    displayName: values.displayName.trim(),
    username: values.username.trim(),
    password: values.password,
    role: "user",
    createdAt: new Date().toISOString(),
  };
  saveUsers([...getUsers(), user]);
  try {
    return setSession({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });
  } catch (error) {
    throw new Error(
      `Your account was saved, but login failed. ${error.message} Use Login to retry.`,
    );
  }
}
