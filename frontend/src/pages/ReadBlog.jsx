/** Read full plain-text posts and offer ownership-restricted management. */
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Avatar } from "../components/Avatar.jsx";
import { getSession } from "../utils/auth.js";
import {
  canEditPost,
  deletePost,
  formatPostDate,
  getAuthorRole,
  getPostById,
} from "../utils/postService.js";

/** Render a post without HTML interpretation; delete only after browser confirmation.
 * @returns {JSX.Element} Reader or an explicit missing-post state.
 */
export default function ReadBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  const post = getPostById(id);

  /** Keep the post visible on cancelled confirmation or failed persistence.
   * @returns {void}
   */
  function remove() {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      deletePost(id, session);
      navigate("/blogs");
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      {post ? (
        <article>
          <header className="border-b border-slate-200 pb-8">
            <h1 className="break-words font-[Georgia] text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {post.title}
            </h1>
            <div className="mt-6 flex items-center gap-3">
              <Avatar role={getAuthorRole(post)} />
              <div className="min-w-0">
                <p className="break-words font-medium">{post.authorName}</p>
                <time
                  dateTime={post.createdAt}
                  className="text-sm text-slate-500"
                >
                  {formatPostDate(post.createdAt)}
                </time>
              </div>
            </div>
          </header>
          <p className="whitespace-pre-wrap break-words py-10 text-lg leading-relaxed text-slate-800">
            {post.content}
          </p>
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-red-50 p-4 text-red-600"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
            {canEditPost(session, post) && (
              <>
                <Link
                  to={`/edit/${id}`}
                  className="rounded-lg border border-indigo-200 bg-white px-4 py-2 font-medium text-indigo-600 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={remove}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  Delete
                </button>
              </>
            )}
            <Link
              to="/blogs"
              className="rounded-lg px-4 py-2 font-medium text-slate-500 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Back to All Posts
            </Link>
          </div>
        </article>
      ) : (
        <section>
          <h1 className="font-[Georgia] text-4xl font-bold">Post not found</h1>
          <Link
            to="/blogs"
            className="mt-6 inline-block rounded-lg py-2 text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Back to All Posts
          </Link>
        </section>
      )}
    </main>
  );
}

ReadBlog.propTypes = {};
