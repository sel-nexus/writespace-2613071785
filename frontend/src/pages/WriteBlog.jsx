/** Compose or revise plain-text posts, preserving content exactly as entered. */
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { getSession } from "../utils/auth.js";
import {
  canEditPost,
  createPost,
  getPostById,
  updatePost,
  validatePost,
} from "../utils/postService.js";

/** Render required fields, a live character count, and a non-saving back action.
 * @returns {JSX.Element} Editor or fail-closed redirect.
 */
export default function WriteBlog() {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = id ? getPostById(id) : null;
  const [title, setTitle] = useState(post?.title || "");
  const [content, setContent] = useState(post?.content || "");
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const session = getSession();

  useEffect(() => {
    const original = id ? getPostById(id) : null;
    setTitle(original?.title || "");
    setContent(original?.content || "");
    setErrors({});
    setError("");
  }, [id]);

  if (!session) return <Navigate to="/login" replace />;
  if (id && !canEditPost(session, post))
    return <Navigate to="/blogs" replace />;

  /** Validate locally and navigate only when the storage-backed operation succeeds.
   * @param {object} event Submit event.
   * @returns {void}
   */
  function save(event) {
    event.preventDefault();
    const values = { title, content };
    const nextErrors = validatePost(values);
    setErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) return;
    try {
      const saved = id
        ? updatePost(id, values, session)
        : createPost(values, session);
      navigate(`/blog/${saved.id}`);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main id="main-content" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-[Georgia] text-4xl font-bold tracking-tight">
        {id ? "Edit Post" : "Write a Blog"}
      </h1>
      <p className="mb-8 mt-4 text-slate-600">
        A title. Your words. Nothing in the way.
      </p>
      <form
        noValidate
        onSubmit={save}
        className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <label htmlFor="post-title" className="mb-2 block font-medium">
          Title
        </label>
        <input
          id="post-title"
          type="text"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? "title-error" : undefined}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.title && (
          <p
            id="title-error"
            role="alert"
            className="mt-2 text-sm text-red-600"
          >
            {errors.title}
          </p>
        )}
        <label htmlFor="post-content" className="mb-2 mt-6 block font-medium">
          Content
        </label>
        <textarea
          id="post-content"
          required
          aria-required="true"
          aria-invalid={Boolean(errors.content)}
          aria-describedby={
            errors.content ? "content-error content-counter" : "content-counter"
          }
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className="min-h-64 w-full resize-y rounded-lg border border-slate-300 px-4 py-3 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.content && (
          <p
            id="content-error"
            role="alert"
            className="mt-2 text-sm text-red-600"
          >
            {errors.content}
          </p>
        )}
        <p
          id="content-counter"
          role="status"
          className="mt-2 text-right text-sm tabular-nums text-slate-500"
        >
          {content.length} characters
        </p>
        {error && (
          <p
            role="alert"
            className="mt-6 rounded-lg bg-red-50 p-4 text-red-600"
          >
            {error}
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Save
          </button>
          <Link
            to={id ? `/blog/${id}` : "/blogs"}
            className="rounded-lg px-4 py-2 text-center font-medium text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}

WriteBlog.propTypes = {};
