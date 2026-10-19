/** Display a plain-text post preview with account-derived role and ownership controls. */
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Avatar } from "./Avatar.jsx";
import {
  canEditPost,
  formatPostDate,
  getAuthorRole,
  getPostAccent,
  getPostExcerpt,
} from "../utils/postService.js";

/** Render independent read and edit links without nested interactive elements.
 * @param {object} props Component props.
 * @param {object} props.post Validated stored post.
 * @param {number} props.index Position used for the repeating accent.
 * @param {object|null} props.session Validated current identity.
 * @returns {JSX.Element} Accessible post summary.
 */
export function BlogCard({ post, index = 0, session = null }) {
  const date = formatPostDate(post.createdAt);
  return (
    <article
      className={`flex h-full min-w-0 flex-col rounded-2xl border border-slate-200 border-t-4 bg-white p-6 ${getPostAccent(index)}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-[Georgia] text-2xl font-bold leading-snug text-slate-800">
          <Link
            to={`/blog/${post.id}`}
            className="break-words rounded hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {post.title}
          </Link>
        </h3>
        {canEditPost(session, post) && (
          <Link
            to={`/edit/${post.id}`}
            aria-label={`Edit ${post.title}`}
            className="shrink-0 rounded-lg border border-indigo-200 p-2 text-indigo-600 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
              <path d="m14 5 5 5" />
            </svg>
          </Link>
        )}
      </div>
      <p className="mt-4 break-words leading-relaxed text-slate-600">
        {getPostExcerpt(post.content)}
      </p>
      <div className="mt-auto flex items-center gap-3 pt-6">
        <Avatar role={getAuthorRole(post)} />
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-slate-800">
            {post.authorName}
          </p>
          <time
            dateTime={date === "Unknown date" ? undefined : post.createdAt}
            className="text-sm text-slate-500"
          >
            {date}
          </time>
        </div>
      </div>
    </article>
  );
}

BlogCard.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string.isRequired,
    authorId: PropTypes.string.isRequired,
    authorName: PropTypes.string.isRequired,
  }).isRequired,
  index: PropTypes.number,
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }),
};
