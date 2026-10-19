/** Administrator overview with actual local statistics and recent-post management. */
import { useState } from "react";
import { Link } from "react-router-dom";
import { getSession } from "../utils/auth.js";
import { getPosts } from "../utils/storage.js";
import { getAdminStats } from "../utils/userService.js";
import {
  deletePost,
  sortPostsNewestFirst,
  formatPostDate,
} from "../utils/postService.js";
import { StatCard } from "../components/StatCard.jsx";

/** Render the guarded dashboard with storage-aware delete and cancellation feedback.
 * @returns {JSX.Element} Administrator dashboard.
 */
export default function AdminDashboard() {
  const [session] = useState(getSession);
  const [posts, setPosts] = useState(getPosts);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  let stats;
  let accessError = "";
  try {
    stats = getAdminStats(session);
  } catch (failure) {
    accessError = failure.message;
  }

  /** Confirm deletion and refresh data only after a successful persisted write.
   * @param {object} post Recent post to delete.
   * @returns {void}
   */
  function removePost(post) {
    setError("");
    setStatus("");
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) {
      setStatus("Post deletion cancelled.");
      return;
    }
    try {
      deletePost(post.id, session);
      setPosts(getPosts());
      setStatus("Post deleted.");
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <main
      id="main-content"
      className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6"
    >
      <header className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white sm:p-8">
        <p className="mb-2 text-sm font-medium">WriteSpace administration</p>
        <h1 className="font-[Georgia] text-3xl font-bold sm:text-4xl">
          Admin Dashboard
        </h1>
        <p className="mt-3 max-w-xl">
          Oversee the writing and accounts stored in this browser.
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
      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Posts"
              value={stats.totalPosts}
              color="indigo"
            />
            <StatCard
              label="Total Users"
              value={stats.totalUsers}
              color="violet"
            />
            <StatCard
              label="Total Admins"
              value={stats.totalAdmins}
              color="pink"
            />
            <StatCard
              label="Total users"
              value={stats.totalUsers}
              color="teal"
            />
          </div>
          <p className="text-sm text-slate-500">
            Product clarification: “Total Users” and “Total users” are duplicate
            product labels; both count all accounts, including the built-in
            admin. Total Admins also includes the built-in admin.
          </p>
          <nav
            aria-label="Admin quick actions"
            className="flex flex-col gap-3 sm:flex-row"
          >
            <Link
              to="/write"
              className="rounded-lg bg-indigo-600 px-4 py-3 text-center font-medium text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Write New Post
            </Link>
            <Link
              to="/users"
              className="rounded-lg border border-indigo-200 bg-white px-4 py-3 text-center font-medium text-indigo-600 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Manage Users
            </Link>
          </nav>
          <section
            aria-labelledby="recent-posts-heading"
            className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
          >
            <h2 id="recent-posts-heading" className="text-xl font-semibold">
              Recent Posts
            </h2>
            {posts.length === 0 ? (
              <p className="mt-4 text-slate-500">
                No posts yet. Write a new post to get started.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {sortPostsNewestFirst(posts)
                  .slice(0, 5)
                  .map((post) => (
                    <li
                      key={post.id}
                      className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/blog/${post.id}`}
                          className="break-words font-medium text-indigo-600 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          {post.title}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">
                          {post.authorName} ·{" "}
                          <time dateTime={post.createdAt}>
                            {formatPostDate(post.createdAt)}
                          </time>
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Link
                          to={`/edit/${post.id}`}
                          aria-label={`Edit ${post.title}`}
                          className="rounded-lg border border-indigo-200 px-4 py-2 font-medium text-indigo-600 hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          aria-label={`Delete ${post.title}`}
                          onClick={() => removePost(post)}
                          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-medium text-red-600 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}

AdminDashboard.propTypes = {};
