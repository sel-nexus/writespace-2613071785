/** Persist validated browser-local demo records; passwords are plaintext, never use real ones. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Return whether a value is a nonempty string.
 * @param {*} value Candidate field.
 * @returns {boolean} Whether the field contains non-whitespace text.
 */
export function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** Validate a UUID identifier.
 * @param {*} value Candidate identifier.
 * @returns {boolean} Whether it follows the UUID shape.
 */
export function isId(value) {
  return typeof value === "string" && UUID.test(value);
}

/** Validate a serialized creation timestamp.
 * @param {*} value Candidate timestamp.
 * @returns {boolean} Whether it is a canonical ISO timestamp.
 */
function isDate(value) {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

/** Validate all local account fields without trusting parsed JSON.
 * @param {*} user Candidate record.
 * @returns {boolean} Whether the record satisfies the account contract.
 */
export function isUser(user) {
  return Boolean(
    user &&
      isId(user.id) &&
      isText(user.displayName) &&
      isText(user.username) &&
      user.username.trim() === user.username &&
      user.username.toLowerCase() !== "admin" &&
      isText(user.password) &&
      ["user", "admin"].includes(user.role) &&
      isDate(user.createdAt),
  );
}

/** Validate the shared post persistence shape without implementing post features.
 * @param {*} post Candidate record.
 * @returns {boolean} Whether all required post fields are valid.
 */
function isPost(post) {
  return Boolean(
    post &&
      isId(post.id) &&
      isText(post.title) &&
      isText(post.content) &&
      isDate(post.createdAt) &&
      (post.authorId === "admin" || isId(post.authorId)) &&
      isText(post.authorName),
  );
}

/** Read a whole validated array, falling back safely on corruption or blocked access.
 * @param {string} key Storage key.
 * @param {Function} validate Record validator.
 * @returns {Array} Valid records or an empty array.
 */
function readArray(key, validate) {
  try {
    const records = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(records) && records.every(validate) ? records : [];
  } catch {
    return [];
  }
}

/** Save only valid arrays; never replace a failed write with in-memory success.
 * @param {string} key Storage key.
 * @param {Array} records Records to save.
 * @param {Function} validate Record validator.
 * @returns {void}
 * @throws {Error} If records are invalid or browser storage cannot save.
 */
function writeArray(key, records, validate) {
  if (!Array.isArray(records) || !records.every(validate)) {
    throw new Error("Cannot save invalid records. Check all required fields.");
  }
  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch {
    throw new Error(
      "Could not save browser data. Enable local storage or free space, then try again.",
    );
  }
}

/** Read validated local accounts.
 * @returns {Array} Accounts or an empty array on read failure.
 */
export function getUsers() {
  return readArray("writespace_users", isUser);
}

/** Save local accounts with plaintext demo passwords.
 * @param {Array} users Complete account array.
 * @returns {void}
 * @throws {Error} If validation or persistence fails.
 */
export function saveUsers(users) {
  writeArray("writespace_users", users, isUser);
}

/** Read validated local posts.
 * @returns {Array} Posts or an empty array on read failure.
 */
export function getPosts() {
  return readArray("writespace_posts", isPost);
}

/** Save records using the shared post contract.
 * @param {Array} posts Complete post array.
 * @returns {void}
 * @throws {Error} If validation or persistence fails.
 */
export function savePosts(posts) {
  writeArray("writespace_posts", posts, isPost);
}
