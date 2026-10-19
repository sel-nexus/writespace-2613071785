/** Present all browser-local writing newest first. */
import { Link, Navigate } from "react-router-dom";
import { BlogCard } from "../components/BlogCard.jsx";
import { getSession } from "../utils/auth.js";
import { getPosts } from "../utils/storage.js";
import { sortPostsNewestFirst } from "../utils/postService.js";

/** Render the authenticated reading collection and its exact empty invitation.
 * @returns {JSX.Element} Responsive post grid or empty state.
 */
export default function Home() {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  const posts = sortPostsNewestFirst(getPosts());
  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-10 border-b border-slate-200 pb-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-600">
          The reading room
        </p>
        <h1 className="font-[Georgia] text-4xl font-bold tracking-tight sm:text-5xl">
          All Blogs
        </h1>
        <p className="mt-4 text-slate-600">
          Thoughts and stories from this browser.
        </p>
      </header>
      {posts.length ? (
        <section
          aria-label="All posts"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {posts.map((post, index) => (
            <BlogCard
              key={post.id}
              post={post}
              index={index}
              session={session}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-2xl bg-white px-6 py-16 text-center">
          <p className="font-[Georgia] text-2xl">
            No blogs yet. Be the first to write one!
          </p>
          <Link
            to="/write"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Write
          </Link>
        </section>
      )}
    </main>
  );
}

Home.propTypes = {};
