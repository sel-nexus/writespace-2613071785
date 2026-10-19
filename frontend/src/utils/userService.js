/** Administrator-only local account operations. Plaintext demo passwords: never use real passwords. */
import { ADMIN_SESSION, getSession } from "./auth.js";
import { getUsers, saveUsers, getPosts, isId, isText } from "./storage.js";

/** Revalidate privileges and any caller snapshot against fresh persisted identity.
 * @param {object} [supplied] Optional identity snapshot.
 * @returns {object} Current administrator identity.
 * @throws {Error} For guest, non-admin, stale or forged identities.
 */
function requireAdmin(supplied) {
  const current = getSession();
  if (
    !current ||
    current.role !== "admin" ||
    (supplied !== undefined &&
      (!supplied ||
        ["userId", "username", "displayName", "role"].some(
          (key) => supplied[key] !== current[key],
        )))
  ) {
    throw new Error("Administrator access required. Please log in again.");
  }
  return current;
}

/** List public account fields, including the built-in account, without returning passwords.
 * @param {object} [supplied] Optional administrator identity snapshot.
 * @returns {Array<object>} Public accounts; built-in has no stored creation timestamp.
 * @throws {Error} For unauthorized access.
 */
export function listUsers(supplied) {
  requireAdmin(supplied);
  const accounts = getUsers().map(
    ({ id, displayName, username, role, createdAt }) => ({
      id,
      displayName,
      username,
      role,
      createdAt,
    }),
  );
  return [
    {
      id: "admin",
      displayName: ADMIN_SESSION.displayName,
      username: "admin",
      role: "admin",
      createdAt: null,
    },
    ...accounts,
  ];
}

/** Count all accounts (including built-in admin) and actual persisted posts.
 * @param {object} [supplied] Optional administrator snapshot.
 * @returns {object} Post, account and administrator totals.
 * @throws {Error} For unauthorized access.
 */
export function getAdminStats(supplied) {
  const users = listUsers(supplied);
  return {
    totalPosts: getPosts().length,
    totalUsers: users.length,
    totalAdmins: users.filter((user) => user.role === "admin").length,
  };
}

/** Validate required creation fields and case-insensitive username uniqueness.
 * @param {*} values Candidate account fields.
 * @returns {object} Field-associated errors, empty when valid.
 */
export function validateUser(values) {
  const errors = {};
  for (const field of ["displayName", "username", "password"]) {
    if (!isText(values?.[field])) errors[field] = "This field is required.";
  }
  if (!["admin", "user"].includes(values?.role)) {
    errors.role = "Choose Admin or user.";
  }
  if (isText(values?.username)) {
    const username = values.username.trim().toLowerCase();
    if (
      username === "admin" ||
      getUsers().some((user) => user.username.toLowerCase() === username)
    ) {
      errors.username = "That username is already taken.";
    }
  }
  return errors;
}

/** Persist a validated account with authoritative UUID and ISO creation time.
 * @param {object} values Display name, username, plaintext demo password and role.
 * @param {object} [supplied] Optional administrator snapshot.
 * @returns {object} Created record after successful persistence.
 * @throws {Error} For invalid input, unauthorized access or storage failure.
 */
export function createUser(values, supplied) {
  requireAdmin(supplied);
  const errors = validateUser(values);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const account = {
    id: crypto.randomUUID(),
    displayName: values.displayName.trim(),
    username: values.username.trim(),
    password: values.password,
    role: values.role,
    createdAt: new Date().toISOString(),
  };
  saveUsers([...getUsers(), account]);
  return account;
}

/** Delete a permitted account only; its posts are retained because cascade is unspecified.
 * Confirmation is the caller UI's responsibility.
 * @param {*} id Candidate account UUID or built-in admin identifier.
 * @param {object} [supplied] Optional administrator snapshot.
 * @returns {void}
 * @throws {Error} For unauthorized, default/self/missing accounts or failed persistence.
 */
export function deleteUser(id, supplied) {
  const current = requireAdmin(supplied);
  if (id === "admin") throw new Error("Default admin cannot be deleted");
  if (id === current.userId)
    throw new Error("You cannot delete your active account.");
  const users = getUsers();
  if (!isId(id) || !users.some((user) => user.id === id))
    throw new Error("User not found.");
  saveUsers(users.filter((user) => user.id !== id));
}
