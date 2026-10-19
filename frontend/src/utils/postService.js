/** Discover and maintain plain-text browser-local posts; client controls are demo-only. */
import { getPosts, savePosts, getUsers, isId, isText } from "./storage.js";
import { getSession } from "./auth.js";

/** Validate required text without changing the writer's whitespace.
 * @param {*} values Candidate title and content.
 * @returns {object} Inline field errors, empty for valid input.
 */
export function validatePost(values) {
  const errors = {};
  if (!isText(values?.title)) errors.title = "Title is required.";
  if (!isText(values?.content)) errors.content = "Content is required.";
  return errors;
}

/** Read a matching validated post, never an invented fallback.
 * @param {*} id Candidate UUID.
 * @returns {object|null} Stored record or null for invalid/missing IDs and failed reads.
 */
export function getPostById(id) {
  if (!isId(id)) return null;
  return getPosts().find((post) => post.id === id) || null;
}

/** Resolve the current identity and reject a stale or forged caller snapshot.
 * @param {object|undefined} supplied Optional identity snapshot from the calling page.
 * @returns {object} Current validated session.
 * @throws {Error} When logged out, invalid, or different from the current identity.
 */
function requireSession(supplied) {
  const current = getSession();
  if (
    !current ||
    (supplied !== undefined &&
      (!supplied ||
        ["userId", "username", "displayName", "role"].some(
          (key) => supplied[key] !== current[key],
        )))
  ) {
    throw new Error("Please log in again before changing posts.");
  }
  return current;
}

/** Reject missing records and enforce ownership using the freshly read identity.
 * @param {object} session Current validated session.
 * @param {object|null} post Stored record.
 * @returns {void}
 * @throws {Error} For missing posts or forbidden edits/deletions.
 */
function requireOwnership(session, post) {
  if (!post) throw new Error("Post not found");
  if (!canEditPost(session, post)) {
    throw new Error("You can only change your own posts.");
  }
}

/** Create a post with browser-generated identity and authoritative author metadata.
 * @param {object} values Required title/content; caller metadata is ignored.
 * @param {object} [supplied] Optional current identity snapshot.
 * @returns {object} Post only after persistence succeeds.
 * @throws {Error} For invalid input, unauthorized access or failed persistence.
 */
export function createPost(values, supplied) {
  const session = requireSession(supplied);
  const errors = validatePost(values);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const post = {
    id: crypto.randomUUID(),
    title: values.title,
    content: values.content,
    createdAt: new Date().toISOString(),
    authorId: session.userId,
    authorName: session.displayName,
  };
  savePosts([...getPosts(), post]);
  return post;
}

/** Update only text fields while preserving the original ID, author and creation date.
 * @param {*} id Post UUID.
 * @param {object} values Required title/content.
 * @param {object} [supplied] Optional current identity snapshot.
 * @returns {object} Updated persisted post.
 * @throws {Error} For missing posts, forbidden access, invalid text or failed saves.
 */
export function updatePost(id, values, supplied) {
  const session = requireSession(supplied);
  const posts = getPosts();
  const original = isId(id) ? posts.find((post) => post.id === id) : null;
  requireOwnership(session, original);
  const errors = validatePost(values);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const updated = { ...original, title: values.title, content: values.content };
  savePosts(posts.map((post) => (post.id === id ? updated : post)));
  return updated;
}

/** Delete a permitted existing post; confirmation belongs to the caller's UI.
 * @param {*} id Post UUID.
 * @param {object} [supplied] Optional current identity snapshot.
 * @returns {void}
 * @throws {Error} For missing posts, forbidden access or failed persistence.
 */
export function deletePost(id, supplied) {
  const session = requireSession(supplied);
  const posts = getPosts();
  const post = isId(id) ? posts.find((record) => record.id === id) : null;
  requireOwnership(session, post);
  savePosts(posts.filter((record) => record.id !== id));
}

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
