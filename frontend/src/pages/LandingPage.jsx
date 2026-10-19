/** Introduce the browser-local writing demo and expose its latest real posts publicly. */
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { BlogCard } from "../components/BlogCard.jsx";
import { getLatestPosts } from "../utils/postService.js";

const FEATURES = [
  {
    title: "Write Freely",
    description: "Plain-text writing, without distractions. Give your ideas room to unfold.",
    number: "01",
  },
  {
    title: "Private & Local",
    description: "Your data lives in this browser. Nothing is shared or synchronized across devices.",
    number: "02",
  },
  {
    title: "Instant & Fast",
    description: "No server to wait for. Open your space and get straight to your thoughts.",
    number: "03",
  },
];
const FOOTER_LINKS = [
  ["Home", "/"],
  ["All Blogs", "/blogs"],
  ["Login", "/login"],
  ["Register", "/register"],
];

/** Render public discovery on light slate surfaces, using only real stored previews.
 * @param {object} props Component props.
 * @param {object|null} props.session Validated current identity.
 * @returns {JSX.Element} Landing content and dark-slate footer.
 * Notes: Credentials are plaintext and local controls are not a security boundary.
 */
export default function LandingPage({ session = null }) {
  const posts = getLatestPosts();
  return (
    <>
      <main id="main-content">
        <section
          aria-labelledby="landing-title"
          className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-5 lg:gap-16"
        >
          <div className="lg:col-span-3">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
              A little room for big ideas
            </p>
            <h1
              id="landing-title"
              className="mt-6 break-words font-[Georgia] text-5xl font-bold tracking-tight text-slate-800 sm:text-7xl"
            >
              WriteSpace
            </h1>
            <p className="mt-6 max-w-xl font-[Georgia] text-3xl leading-snug text-slate-800 sm:text-4xl">
              Your thoughts. Your space. Beautifully simple.
            </p>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
              A place to put words down and discover what others have written.
              Just plain text, a quiet page, and space to begin.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to={session ? "/blogs" : "/login"}
                className="rounded-lg bg-indigo-600 px-6 py-3 text-center font-semibold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Start Reading
              </Link>
              <Link
                to="/register"
                className="rounded-lg border border-indigo-200 bg-white px-6 py-3 text-center font-semibold text-indigo-600 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Get Started Free
              </Link>
            </div>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-slate-600">
              Local demo only. Passwords are stored in plaintext in this browser;
              never use real passwords or sensitive data. Client-side access
              controls are not secure authentication.
            </p>
          </div>
          <aside
            aria-label="Inside your writing space"
            className="min-w-0 rounded-3xl bg-indigo-50 p-5 sm:p-8 lg:col-span-2"
          >
            <p className="mb-5 text-sm font-semibold text-indigo-600">
              Words from this browser
            </p>
            {posts.length > 0 ? (
              <div className="shadow-xl motion-safe:animate-[bounce_8s_infinite]">
                <BlogCard post={posts[0]} session={session} />
              </div>
            ) : (
              <div className="rounded-2xl border-t-4 border-indigo-500 bg-white p-8 shadow-lg">
                <p className="font-[Georgia] text-3xl leading-snug text-slate-800">
                  Every story starts with a little space.
                </p>
                <p className="mt-4 leading-relaxed text-slate-600">
                  Your first words belong here. Create a local account to begin.
                </p>
              </div>
            )}
          </aside>
        </section>
        <section
          aria-labelledby="features-title"
          className="border-y border-slate-200 bg-white py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="features-title" className="font-[Georgia] text-3xl font-bold sm:text-4xl">
              Less in the way. More on the page.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {FEATURES.map((feature) => (
                <article key={feature.title} className="rounded-2xl bg-slate-50 p-6">
                  <p className="text-sm font-semibold tabular-nums text-indigo-600">
                    {feature.number}
                  </p>
                  <h3 className="mt-5 text-xl font-semibold text-slate-800">
                    {feature.title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-slate-600">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="latest-title"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600">
            The latest words
          </p>
          <h2 id="latest-title" className="mt-3 font-[Georgia] text-3xl font-bold sm:text-4xl">
            Latest from the Blog
          </h2>
          {posts.length > 0 ? (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post, index) => (
                <BlogCard key={post.id} post={post} index={index} session={session} />
              ))}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-slate-600">
              No posts yet — check back soon!
            </p>
          )}
        </section>
      </main>
      <footer className="bg-slate-900 py-10 text-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="text-sm">
            © {new Date().getFullYear()} WriteSpace
          </p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-6 text-sm">
            {FOOTER_LINKS.map(([label, path]) => (
              <Link
                key={path}
                to={path}
                className="rounded hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}

LandingPage.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    role: PropTypes.oneOf(["admin", "user"]).isRequired,
  }),
};
