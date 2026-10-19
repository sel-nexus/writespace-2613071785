/** Discover browser-local posts without adding persistence mutations or CRUD. */
import { getPosts, getUsers, isId } from "./storage.js";

const ACCENTS = [
  "border-indigo-500",
  "border-violet-500",
  "border-pink-500",
  "border-teal-500",
];

/** Parse only canonical stored timestamps, never loosely interpreted date strings.
 * @param {*} value Candidate ISO timestamp.
 * @returns {number} Epoch milliseconds, or negative infinity for invalid dates.
 */
function timestamp(value) {
  if (typeof value !== "string") return -Infinity;
  const time = Date.parse(value);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== value) {
    return -Infinity;
  }
  return time;
}

/** Order a fresh array newest first, retaining stable ties and placing invalid dates last.
 * @param {Array} posts Candidate posts; malformed identifiers are excluded.
 * @returns {Array} Ordered records without modifying the input or its records.
 */
export function sortPostsNewestFirst(posts) {
  if (!Array.isArray(posts)) return [];
  return posts
    .filter((post) => post && isId(post.id))
    .sort((left, right) => {
      const leftTime = timestamp(left.createdAt);
      const rightTime = timestamp(right.createdAt);
      return leftTime === rightTime ? 0 : leftTime > rightTime ? -1 : 1;
    });
}

/** Read up to three latest posts from validated browser storage.
 * @returns {Array} Latest previews, or an empty array on storage failure.
 */
export function getLatestPosts() {
  return sortPostsNewestFirst(getPosts()).slice(0, 3);
}

/** Present a stored date consistently in UTC, independent of the visitor's timezone.
 * @param {*} value Canonical ISO timestamp.
 * @returns {string} Date in MMM DD, YYYY format, or an explicit fallback.
 */
export function formatPostDate(value) {
  const time = timestamp(value);
  if (!Number.isFinite(time)) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(time));
}

/** Return exactly the first 120 characters, rendered later as plain React text.
 * @param {*} content Candidate post body.
 * @returns {string} Unadorned excerpt, or an empty string for non-text values.
 */
export function getPostExcerpt(content) {
  return typeof content === "string" ? content.slice(0, 120) : "";
}

/** Resolve the four-color card cycle with a safe first accent for invalid indexes.
 * @param {number} index Nonnegative integer position in the displayed list.
 * @returns {string} Tailwind top-border color class.
 */
export function getPostAccent(index) {
  return ACCENTS[Number.isInteger(index) && index >= 0 ? index % 4 : 0];
}

/** Permit valid administrator identities or the valid owning user, never guests.
 * @param {object|null} session Validated identity supplied by the shared auth layer.
 * @param {object|null} post Candidate post.
 * @returns {boolean} Whether the card may expose an edit link; not a security boundary.
 */
export function canEditPost(session, post) {
  if (!session || !post || !isId(post.id)) return false;
  if (post.authorId !== "admin" && !isId(post.authorId)) return false;
  if (session.userId !== "admin" && !isId(session.userId)) return false;
  if (session.role === "admin") return true;
  return session.role === "user" && session.userId === post.authorId;
}

/** Derive an author's avatar role from their stored account or the built-in administrator.
 * @param {object|null} post Candidate post with author identity.
 * @param {Array} users Accounts, defaulting to validated browser storage.
 * @returns {string} Admin for known administrators; user for missing/deleted accounts.
 */
export function getAuthorRole(post, users = getUsers()) {
  if (post?.authorId === "admin") return "admin";
  if (!isId(post?.authorId) || !Array.isArray(users)) return "user";
  const author = users.find((user) => user?.id === post.authorId);
  return author?.role === "admin" ? "admin" : "user";
}
