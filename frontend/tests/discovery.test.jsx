/** Specify discovery helpers, plain-text cards and public navigation using real local storage. */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "../src/App.jsx";
import LandingPage from "../src/pages/LandingPage.jsx";
import { BlogCard } from "../src/components/BlogCard.jsx";
import { ADMIN_SESSION, setSession } from "../src/utils/auth.js";
import { getPosts, savePosts, saveUsers } from "../src/utils/storage.js";
import {
  sortPostsNewestFirst,
  getLatestPosts,
  formatPostDate,
  getPostExcerpt,
  getPostAccent,
  canEditPost,
  getAuthorRole,
} from "../src/utils/postService.js";

const account = {
  id: "12345678-1234-4234-8234-123456789abc",
  displayName: "Mira Writer",
  username: "mira",
  password: "demo-only",
  role: "user",
  createdAt: "2026-01-01T12:00:00.000Z",
};
const identity = {
  userId: account.id,
  username: account.username,
  displayName: account.displayName,
  role: account.role,
};
const otherId = "92345678-1234-4234-8234-123456789abc";
const post = {
  id: "22345678-1234-4234-8234-123456789abc",
  title: "An ordinary thought",
  content: "A quiet paragraph for a local reader.",
  createdAt: "2026-03-04T12:00:00.000Z",
  authorId: account.id,
  authorName: account.displayName,
};
const posts = [
  { ...post, title: "Oldest", createdAt: "2026-01-01T12:00:00.000Z" },
  {
    ...post,
    id: "32345678-1234-4234-8234-123456789abc",
    title: "Newest",
    createdAt: "2026-04-01T12:00:00.000Z",
  },
  {
    ...post,
    id: "42345678-1234-4234-8234-123456789abc",
    title: "Third",
    createdAt: "2026-02-01T12:00:00.000Z",
  },
  { ...post, id: "52345678-1234-4234-8234-123456789abc", title: "Second" },
];

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Expose the current route to verify actual Router navigation.
 * @returns {JSX.Element} Observable pathname.
 */
function Location() {
  const { pathname } = useLocation();
  return <output aria-label="Current route">{pathname}</output>;
}

/** Render discovery in the existing single-router contract.
 * @param {React.ReactNode} content Content under test.
 * @param {string} route Initial entry.
 * @returns {object} Testing Library render result.
 */
function routed(content, route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {content}
      <Location />
    </MemoryRouter>,
  );
}

describe("read-only post discovery", () => {
  it("sorts newest first without mutating a frozen input or records", () => {
    const input = Object.freeze(
      posts.map((record) => Object.freeze({ ...record })),
    );
    expect(sortPostsNewestFirst(input).map((record) => record.title)).toEqual([
      "Newest",
      "Second",
      "Third",
      "Oldest",
    ]);
    expect(input.map((record) => record.title)).toEqual([
      "Oldest",
      "Newest",
      "Third",
      "Second",
    ]);
    expect(sortPostsNewestFirst(input)).not.toBe(input);
  });

  it.each([null, undefined, {}, "posts", 3])(
    "returns no records for invalid collection %s",
    (input) => {
      expect(sortPostsNewestFirst(input)).toEqual([]);
    },
  );

  it("handles empty arrays and excludes missing or invalid UUIDs", () => {
    expect(sortPostsNewestFirst([])).toEqual([]);
    expect(
      sortPostsNewestFirst([null, {}, { ...post, id: "bad/id" }, post]),
    ).toEqual([post]);
  });

  it("retains stable ties, orders both comparison directions and puts invalid dates last", () => {
    const invalid = { ...post, id: otherId, createdAt: "invalid" };
    const missing = { ...post, id: posts[1].id, createdAt: null };
    const tie = { ...post, id: posts[2].id };
    expect(sortPostsNewestFirst([invalid, tie, missing, post])).toEqual([
      tie,
      post,
      invalid,
      missing,
    ]);
    expect(sortPostsNewestFirst([posts[0], posts[1]])).toEqual([
      posts[1],
      posts[0],
    ]);
    expect(sortPostsNewestFirst([posts[1], posts[0]])).toEqual([
      posts[1],
      posts[0],
    ]);
  });

  it("reads exactly latest three and leaves persisted ordering unchanged", () => {
    savePosts(posts);
    const raw = localStorage.getItem("writespace_posts");
    expect(getLatestPosts().map((record) => record.title)).toEqual([
      "Newest",
      "Second",
      "Third",
    ]);
    expect(localStorage.getItem("writespace_posts")).toBe(raw);
    expect(getPosts()).toEqual(posts);
  });

  it("returns zero, one and two records without inventing previews", () => {
    expect(getLatestPosts()).toEqual([]);
    savePosts([post]);
    expect(getLatestPosts()).toEqual([post]);
    savePosts(posts.slice(0, 2));
    expect(getLatestPosts()).toEqual([posts[1], posts[0]]);
  });

  it.each(["broken-json", "{}", '[{"id":"bad"}]'])(
    "degrades corrupt persisted posts %s to empty",
    (raw) => {
      localStorage.setItem("writespace_posts", raw);
      expect(getLatestPosts()).toEqual([]);
    },
  );

  it("degrades blocked storage reads to empty", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    expect(getLatestPosts()).toEqual([]);
    expect(getAuthorRole(post)).toBe("user");
  });

  it("formats padded days and UTC year boundaries in the specified format", () => {
    expect(formatPostDate(post.createdAt)).toBe("Mar 04, 2026");
    expect(formatPostDate("2025-12-31T23:59:59.000Z")).toBe("Dec 31, 2025");
    expect(formatPostDate("2026-01-01T00:00:00.000Z")).toBe("Jan 01, 2026");
  });

  it.each([
    null,
    undefined,
    {},
    0,
    "",
    "invalid",
    "2026-03-04",
    "2026-02-30T00:00:00.000Z",
  ])("gives an explicit fallback for invalid date %s", (value) => {
    expect(formatPostDate(value)).toBe("Unknown date");
  });

  it("slices text at 120 characters without adding an ellipsis", () => {
    expect(getPostExcerpt("x".repeat(121))).toBe("x".repeat(120));
    expect(getPostExcerpt("x".repeat(120))).toHaveLength(120);
    expect(getPostExcerpt("short")).toBe("short");
    expect(getPostExcerpt("")).toBe("");
  });

  it.each([null, undefined, 12, {}, []])(
    "returns empty excerpt for non-text %s",
    (value) => {
      expect(getPostExcerpt(value)).toBe("");
    },
  );

  it.each([
    [0, "indigo"],
    [1, "violet"],
    [2, "pink"],
    [3, "teal"],
    [4, "indigo"],
    [7, "teal"],
    [100, "indigo"],
  ])("cycles accent %s to %s", (index, color) => {
    expect(getPostAccent(index)).toBe(`border-${color}-500`);
  });

  it.each([-1, 1.5, NaN, Infinity, null, undefined, "2"])(
    "defaults invalid accent %s safely",
    (index) => {
      expect(getPostAccent(index)).toBe("border-indigo-500");
    },
  );

  it("allows admin all valid posts and user only their own", () => {
    expect(canEditPost(ADMIN_SESSION, post)).toBe(true);
    expect(
      canEditPost(
        { ...identity, role: "admin" },
        { ...post, authorId: otherId },
      ),
    ).toBe(true);
    expect(canEditPost(identity, post)).toBe(true);
    expect(canEditPost(identity, { ...post, authorId: otherId })).toBe(false);
    expect(canEditPost(identity, { ...post, authorId: "admin" })).toBe(false);
  });

  it.each([
    [null, post],
    [identity, null],
    [identity, {}],
    [identity, { ...post, id: "invalid" }],
    [ADMIN_SESSION, { ...post, authorId: null }],
    [ADMIN_SESSION, { ...post, authorId: "invalid" }],
    [{ role: "admin" }, post],
    [{ ...identity, userId: "invalid" }, post],
    [{ ...identity, role: "guest" }, post],
    [{}, {}],
  ])("fails closed for invalid permission inputs %#", (session, record) => {
    expect(canEditPost(session, record)).toBe(false);
  });

  it("derives built-in and stored admin roles rather than trusting authorName", () => {
    expect(getAuthorRole({ ...post, authorId: "admin" }, [])).toBe("admin");
    saveUsers([{ ...account, role: "admin" }]);
    expect(getAuthorRole(post)).toBe("admin");
    expect(getAuthorRole({ ...post, authorName: "Admin" }, [account])).toBe(
      "user",
    );
    expect(getAuthorRole(post, [{ ...account, role: "admin" }])).toBe("admin");
  });

  it("uses user avatar for deleted, unknown, malformed and missing authors", () => {
    expect(getAuthorRole(post, [])).toBe("user");
    expect(getAuthorRole(post, [null, { ...account, id: otherId }])).toBe(
      "user",
    );
    expect(getAuthorRole(null, [])).toBe("user");
    expect(getAuthorRole({ authorId: "invalid" }, [])).toBe("user");
    expect(getAuthorRole(post, null)).toBe("user");
    expect(getAuthorRole(post, [{ ...account, role: "unknown" }])).toBe("user");
  });
});

describe("BlogCard", () => {
  it("renders title, exact excerpt, date, author, avatar and read destination", async () => {
    saveUsers([account]);
    routed(<BlogCard post={{ ...post, content: "a".repeat(130) }} />);
    expect(screen.getByText("a".repeat(120))).toBeVisible();
    expect(screen.queryByText("a".repeat(130))).not.toBeInTheDocument();
    expect(screen.getByText("Mar 04, 2026")).toHaveAttribute(
      "dateTime",
      post.createdAt,
    );
    expect(screen.getByText(account.displayName)).toBeVisible();
    expect(screen.getByRole("img", { name: "User avatar" })).toHaveClass(
      "bg-indigo-500",
    );
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: post.title }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      `/blog/${post.id}`,
    );
    expect(
      screen.queryByRole("link", { name: `Edit ${post.title}` }),
    ).not.toBeInTheDocument();
  });

  it.each([0, 1, 2, 3, 4])(
    "renders the correct top accent at index %s",
    (index) => {
      routed(<BlogCard post={post} index={index} />);
      expect(screen.getByRole("article")).toHaveClass(
        "border-t-4",
        getPostAccent(index),
      );
    },
  );

  it.each([ADMIN_SESSION, identity])(
    "exposes an independent edit link to permitted identity %#",
    async (session) => {
      routed(<BlogCard post={post} session={session} />);
      const link = screen.getByRole("link", { name: `Edit ${post.title}` });
      expect(link).toHaveAttribute("href", `/edit/${post.id}`);
      expect(link.parentElement.closest("a")).toBeNull();
      await userEvent.setup().click(link);
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        `/edit/${post.id}`,
      );
    },
  );

  it("hides edit for a nonowner and shows known administrator avatars", () => {
    saveUsers([{ ...account, role: "admin" }]);
    routed(<BlogCard post={post} session={{ ...identity, userId: otherId }} />);
    expect(
      screen.queryByRole("link", { name: `Edit ${post.title}` }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Admin avatar" })).toHaveClass(
      "bg-violet-600",
    );
  });

  it("uses built-in admin avatar and displays invalid dates without an invalid time attribute", () => {
    routed(
      <BlogCard post={{ ...post, authorId: "admin", createdAt: "invalid" }} />,
    );
    expect(screen.getByRole("img", { name: "Admin avatar" })).toBeVisible();
    expect(screen.getByText("Unknown date")).not.toHaveAttribute("dateTime");
  });

  it("renders XSS-shaped title, excerpt and author as inert text", () => {
    const text = '<img src=x onerror="window.evil=true">';
    const { container } = routed(
      <BlogCard
        post={{ ...post, title: text, content: text, authorName: text }}
      />,
    );
    expect(screen.getAllByText(text)).toHaveLength(3);
    expect(container.querySelector("img, script")).toBeNull();
    expect(screen.getByRole("link", { name: text })).toHaveAttribute(
      "href",
      `/blog/${post.id}`,
    );
  });
});

describe("public landing and App wiring", () => {
  it("shows exact brand copy, named features, honest limitation, empty preview and footer", () => {
    routed(<App />);
    expect(
      screen.getByRole("heading", { level: 1, name: "WriteSpace" }),
    ).toBeVisible();
    expect(
      screen.getByText("Your thoughts. Your space. Beautifully simple."),
    ).toBeVisible();
    for (const name of ["Write Freely", "Private & Local", "Instant & Fast"]) {
      expect(screen.getByRole("heading", { name })).toBeVisible();
    }
    expect(screen.getByText(/Passwords are stored in plaintext/)).toBeVisible();
    expect(screen.getByText(/not secure authentication/)).toBeVisible();
    expect(screen.getByText("No posts yet — check back soon!")).toBeVisible();
    const preview = screen.getByRole("complementary", {
      name: "Inside your writing space",
    });
    expect(
      within(preview).getByText("Every story starts with a little space.")
        .parentElement.parentElement,
    ).toHaveClass("shadow-xl", "motion-safe:animate-[bounce_8s_infinite]");
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass("bg-slate-900");
    expect(
      within(footer).getByText(`© ${new Date().getFullYear()} WriteSpace`),
    ).toBeVisible();
    for (const [name, href] of [
      ["Home", "/"],
      ["All Blogs", "/blogs"],
      ["Login", "/login"],
      ["Register", "/register"],
    ]) {
      expect(
        within(footer).getByRole("link", { name, exact: true }),
      ).toHaveAttribute("href", href);
    }
  });

  it("shows only latest three in order and does not seed or mutate browser data", () => {
    savePosts(posts);
    const raw = localStorage.getItem("writespace_posts");
    routed(<LandingPage />);
    const latest = screen.getByRole("region", { name: "Latest from the Blog" });
    expect(
      within(latest)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Newest", "Second", "Third"]);
    expect(screen.queryByText("Oldest")).not.toBeInTheDocument();
    expect(within(latest).getAllByRole("article")).toHaveLength(3);
    const preview = screen.getByRole("complementary", {
      name: "Inside your writing space",
    });
    expect(within(preview).getByRole("article").parentElement).toHaveClass(
      "shadow-xl",
      "motion-safe:animate-[bounce_8s_infinite]",
    );
    expect(localStorage.getItem("writespace_posts")).toBe(raw);
  });

  it.each(["invalid", "{}", '[{"id":"invalid"}]'])(
    "renders corrupt storage %s as specified empty state",
    (raw) => {
      localStorage.setItem("writespace_posts", raw);
      routed(<App />);
      expect(screen.getByText("No posts yet — check back soon!")).toBeVisible();
    },
  );

  it.each([
    ["Start Reading", "/login"],
    ["Get Started Free", "/register"],
  ])("guest CTA %s navigates to %s", async (name, path) => {
    routed(<App />);
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name, exact: true }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent(path);
    expect(screen.getByLabelText("Username", { exact: true })).toBeVisible();
  });

  it("guest selecting a stored preview is redirected by the reader guard to login", async () => {
    savePosts([post]);
    routed(<App />);
    const latest = screen.getByRole("region", { name: "Latest from the Blog" });
    await userEvent
      .setup()
      .click(within(latest).getByRole("link", { name: post.title }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/login");
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  it("direct guest preview entry also fails closed", () => {
    routed(<App />, `/blog/${post.id}`);
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/login");
  });

  it.each([identity, ADMIN_SESSION])(
    "keeps signed-in home public and sends Start Reading to blogs %#",
    async (session) => {
      saveUsers([account]);
      setSession(session);
      routed(<App />);
      expect(
        screen.getByRole("navigation", { name: "Public navigation" }),
      ).toBeVisible();
      expect(
        screen.queryByRole("navigation", {
          name: "Account navigation",
          exact: true,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Start Reading" }),
      ).toHaveAttribute("href", "/blogs");
      expect(
        screen.getByRole("link", { name: "Get Started Free" }),
      ).toHaveAttribute("href", "/register");
      await userEvent
        .setup()
        .click(screen.getByRole("link", { name: "Start Reading" }));
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/blogs",
      );
    },
  );

  it.each([
    [identity, "/blogs"],
    [ADMIN_SESSION, "/admin"],
  ])("public account action respects role home %#", async (session, path) => {
    saveUsers([account]);
    setSession(session);
    routed(<App />);
    const publicNav = screen.getByRole("navigation", {
      name: "Public navigation",
    });
    expect(
      within(publicNav).getByText(session.displayName),
    ).toBeInTheDocument();
    expect(
      within(publicNav).queryByRole("link", { name: "Login" }),
    ).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(within(publicNav).getByRole("link", { name: "Go to Dashboard" }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent(path);
    expect(
      screen.getByRole("heading", {
        name: session.role === "admin" ? "Admin Dashboard" : "All Blogs",
        exact: true,
      }),
    ).toBeVisible();
  });

  it.each([
    [identity, "/blogs"],
    [ADMIN_SESSION, "/admin"],
  ])(
    "signed registration CTA retains shared identity redirect %#",
    async (session, path) => {
      saveUsers([account]);
      setSession(session);
      routed(<App />);
      await userEvent
        .setup()
        .click(screen.getByRole("link", { name: "Get Started Free" }));
      expect(screen.getByLabelText("Current route")).toHaveTextContent(path);
    },
  );

  it("accepts signed reader entry and renders the stored post without redirecting to login", () => {
    setSession(ADMIN_SESSION);
    savePosts([post]);
    routed(<App />, `/blog/${post.id}`);
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      `/blog/${post.id}`,
    );
    expect(screen.getByRole("heading", { name: post.title })).toBeVisible();
    expect(screen.getByText(post.content)).toBeVisible();
  });

  it("refreshes public navbar and CTA after persisted session storage events", () => {
    routed(<App />);
    act(() => {
      setSession(ADMIN_SESSION);
      window.dispatchEvent(new Event("storage"));
    });
    expect(screen.getByRole("link", { name: "Start Reading" })).toHaveAttribute(
      "href",
      "/blogs",
    );
    expect(
      screen.getByRole("navigation", { name: "Public navigation" }),
    ).toBeVisible();
    act(() => {
      localStorage.removeItem("writespace_session");
      window.dispatchEvent(new Event("storage"));
    });
    expect(screen.getByRole("link", { name: "Start Reading" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
