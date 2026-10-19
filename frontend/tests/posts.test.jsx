/** Verify posts against real jsdom localStorage, including every mutation failure boundary. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App.jsx";
import {
  ADMIN_SESSION,
  clearSession,
  getSession,
  login,
  setSession,
} from "../src/utils/auth.js";
import { getPosts, isId, savePosts, saveUsers } from "../src/utils/storage.js";
import {
  createPost,
  deletePost,
  getPostById,
  updatePost,
  validatePost,
} from "../src/utils/postService.js";

const alice = {
  id: "12345678-1234-4234-8234-123456789abc",
  displayName: "Alice",
  username: "alice",
  password: "demo",
  role: "user",
  createdAt: "2026-01-01T12:00:00.000Z",
};
const bob = {
  ...alice,
  id: "32345678-1234-4234-8234-123456789abc",
  displayName: "Bob",
  username: "bob",
};
const editor = {
  ...bob,
  id: "42345678-1234-4234-8234-123456789abc",
  username: "editor",
  role: "admin",
};
const post = {
  id: "22345678-1234-4234-8234-123456789abc",
  title: "Original title",
  content: "  First line\n\nSecond line\t  ",
  createdAt: "2026-03-04T12:00:00.000Z",
  authorId: alice.id,
  authorName: alice.displayName,
};
const values = { title: "A new title", content: "  Words\n\n  with space\t " };
const xss =
  '<img src=x onerror="window.postsInjected=true"><script>alert(1)</script>';

beforeEach(() => {
  localStorage.clear();
  saveUsers([alice, bob, editor]);
  login("alice", "demo");
});

/** Render actual routes, services and storage rather than mocked pages.
 * @param {string|object} route Initial browser-equivalent entry.
 * @returns {object} Testing Library result.
 */
function open(route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

/** Simulate only the browser's storage failure boundary.
 * @returns {object} Restorable storage spy.
 */
function blockSave() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("Quota exceeded");
  });
}

/** Fill editor through DOM events; large payload tests do not type 100k individual keys.
 * @param {object} data Title and content.
 * @returns {void}
 */
function fill(data = values) {
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: data.title },
  });
  fireEvent.change(screen.getByLabelText("Content"), {
    target: { value: data.content },
  });
}

describe("storage-backed post CRUD", () => {
  it.each([undefined, null, {}, [], 42, "post"])(
    "validates malformed form %j with two required errors",
    (input) => {
      expect(validatePost(input)).toEqual({
        title: "Title is required.",
        content: "Content is required.",
      });
      expect(() => createPost(input)).toThrow("Title is required.");
      savePosts([post]);
      expect(() => updatePost(post.id, input)).toThrow("Title is required.");
      expect(getPosts()).toEqual([post]);
    },
  );

  it.each(["title", "content"])(
    "rejects each missing, empty, whitespace or nonstring %s without mutation",
    (field) => {
      savePosts([post]);
      for (const value of [undefined, null, "", " \n\t ", 42, {}, []]) {
        const input = { ...values, [field]: value };
        expect(validatePost(input)[field]).toBe(
          `${field === "title" ? "Title" : "Content"} is required.`,
        );
        expect(() => createPost(input)).toThrow("required");
        expect(() => updatePost(post.id, input)).toThrow("required");
        expect(getPosts()).toEqual([post]);
      }
    },
  );

  it.each(["alice", "admin", "editor"])(
    "creates UUID/ISO and true author metadata for %s, ignoring forged metadata",
    (username) => {
      login(username, username === "admin" ? "admin" : "demo");
      const current = getSession();
      savePosts([post]);
      const saved = createPost(
        {
          ...values,
          id: post.id,
          createdAt: "fake",
          authorId: bob.id,
          authorName: "Fake",
        },
        current,
      );
      expect(isId(saved.id)).toBe(true);
      expect(saved.id).not.toBe(post.id);
      expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
      expect(saved).toMatchObject({
        ...values,
        authorId: current.userId,
        authorName: current.displayName,
      });
      expect(getPostById(saved.id)).toEqual(saved);
      expect(getPosts()).toEqual([post, saved]);
    },
  );

  it("accepts large and XSS-shaped plain text and duplicate titles with independent IDs", () => {
    const content = `  ${xss}\n${"x".repeat(100000)}  `;
    expect(validatePost({ title: xss, content })).toEqual({});
    const one = createPost({ title: xss, content });
    const two = createPost({ title: xss, content });
    expect(one.id).not.toBe(two.id);
    expect(getPostById(one.id).content).toBe(content);
    const revised = updatePost(one.id, {
      title: xss,
      content: `${content}\nend`,
    });
    expect(getPosts()).toEqual([revised, two]);
  });

  it.each([
    undefined,
    null,
    "",
    "bad/id",
    42,
    {},
    "92345678-1234-4234-8234-123456789abc",
  ])("handles missing/invalid post ID %j without mutation", (id) => {
    savePosts([post]);
    expect(getPostById(id)).toBeNull();
    expect(() => updatePost(id, values)).toThrow("Post not found");
    expect(() => deletePost(id)).toThrow("Post not found");
    expect(getPosts()).toEqual([post]);
  });

  it.each(["alice", "admin", "editor"])(
    "updates and deletes as permitted %s, preserving original metadata and unrelated posts",
    (username) => {
      savePosts([post, { ...post, id: bob.id, title: "Untouched" }]);
      login(username, username === "admin" ? "admin" : "demo");
      const updated = updatePost(
        post.id,
        {
          ...values,
          id: bob.id,
          authorId: "admin",
          authorName: "Imposter",
          createdAt: new Date().toISOString(),
        },
        getSession(),
      );
      expect(updated).toEqual({ ...post, ...values });
      expect(getPostById(post.id)).toEqual(updated);
      deletePost(post.id, getSession());
      expect(getPostById(post.id)).toBeNull();
      expect(getPosts()).toEqual([{ ...post, id: bob.id, title: "Untouched" }]);
    },
  );

  it("rejects nonowner edit/delete but permits that user to create their own", () => {
    savePosts([post]);
    login("bob", "demo");
    expect(() => updatePost(post.id, values)).toThrow(
      "only change your own posts",
    );
    expect(() => deletePost(post.id)).toThrow("only change your own posts");
    expect(getPosts()).toEqual([post]);
    const own = createPost(values);
    expect(own.authorId).toBe(bob.id);
    expect(getPosts()).toEqual([post, own]);
  });

  it.each(["guest", "removed", "forged-storage", "blocked-session"])(
    "rejects all CRUD with %s current session",
    (kind) => {
      savePosts([post]);
      const snapshot = getSession();
      if (kind === "guest") clearSession();
      if (kind === "removed") saveUsers([bob]);
      if (kind === "forged-storage")
        localStorage.setItem(
          "writespace_session",
          JSON.stringify({ ...snapshot, role: "admin" }),
        );
      if (kind === "blocked-session") {
        const original = Storage.prototype.getItem;
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(
          function (key) {
            if (key === "writespace_session") throw new Error("blocked");
            return original.call(this, key);
          },
        );
      }
      expect(() => createPost(values, snapshot)).toThrow("log in again");
      expect(() => updatePost(post.id, values, snapshot)).toThrow(
        "log in again",
      );
      expect(() => deletePost(post.id, snapshot)).toThrow("log in again");
      expect(getPosts()).toEqual([post]);
    },
  );

  it.each([null, {}, { role: "admin" }, { userId: "admin" }])(
    "rejects forged caller %j even with a valid stored session",
    (patch) => {
      savePosts([post]);
      const supplied =
        patch === null
          ? null
          : { ...getSession(), ...patch, username: "forged" };
      expect(() => createPost(values, supplied)).toThrow("log in again");
      expect(() => updatePost(post.id, values, supplied)).toThrow(
        "log in again",
      );
      expect(() => deletePost(post.id, supplied)).toThrow("log in again");
      expect(getPosts()).toEqual([post]);
    },
  );

  it("rejects a previously valid admin snapshot after switching accounts", () => {
    savePosts([post]);
    setSession(ADMIN_SESSION);
    const stale = getSession();
    login("bob", "demo");
    expect(() => createPost(values, stale)).toThrow("log in again");
    expect(() => updatePost(post.id, values, stale)).toThrow("log in again");
    expect(() => deletePost(post.id, stale)).toThrow("log in again");
    expect(getPosts()).toEqual([post]);
  });

  it.each(["create", "update", "delete"])(
    "reports failed %s storage without in-memory fallback success",
    (operation) => {
      savePosts([post]);
      blockSave();
      const actions = {
        create: () => createPost(values),
        update: () => updatePost(post.id, values),
        delete: () => deletePost(post.id),
      };
      expect(actions[operation]).toThrow("Enable local storage or free space");
      expect(getPosts()).toEqual([post]);
    },
  );

  it.each(["{broken", "{}", "[null]"])(
    "reads corrupt posts %s as missing and never invents updates/deletes",
    (raw) => {
      localStorage.setItem("writespace_posts", raw);
      expect(getPostById(post.id)).toBeNull();
      expect(() => updatePost(post.id, values)).toThrow("Post not found");
      expect(() => deletePost(post.id)).toThrow("Post not found");
      expect(localStorage.getItem("writespace_posts")).toBe(raw);
    },
  );

  it("returns missing on blocked post reads and forwards save failure during creation", () => {
    const original = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (key) {
      if (key === "writespace_posts") throw new Error("blocked");
      return original.call(this, key);
    });
    expect(getPostById(post.id)).toBeNull();
    expect(() => updatePost(post.id, values)).toThrow("Post not found");
    expect(() => deletePost(post.id)).toThrow("Post not found");
    blockSave();
    expect(() => createPost(values)).toThrow("Could not save browser data");
  });
});

describe("post pages and routes", () => {
  it.each([
    ["/admin", "write", "Admin Dashboard"],
    ["/blogs", "write", "All Blogs"],
    ["/blogs", "edit", "All Blogs"],
    [`/blog/${post.id}`, "write", post.title],
    [`/blog/${post.id}`, "edit", post.title],
  ])("cancels %s-origin %s back to the origin without storage changes", async (origin, action, heading) => {
    if (origin === "/admin") setSession(ADMIN_SESSION);
    savePosts([post]);
    const snapshot = { ...localStorage };
    open(origin);
    const user = userEvent.setup();
    const link = action === "write"
      ? within(screen.getByRole("navigation", { name: "Account navigation" })).getByRole("link", { name: "Write", exact: true })
      : screen.getByRole("link", { name: origin === "/blogs" ? `Edit ${post.title}` : "Edit", exact: true });
    await user.click(link);
    expect(screen.getByLabelText("Title")).toBeVisible();
    fill();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(screen.queryByLabelText("Content")).not.toBeInTheDocument();
    expect({ ...localStorage }).toEqual(snapshot);
  });

  it.each([
    ["/write", "All Blogs"],
    [`/edit/${post.id}`, post.title],
  ])("uses a safe local fallback for direct-entry %s without saving", async (pathname, heading) => {
    savePosts([post]);
    const snapshot = { ...localStorage };
    open({ pathname, key: "default", state: { from: "https://example.com", origin: "//example.com" } });
    fill();
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(screen.queryByLabelText("Content")).not.toBeInTheDocument();
    expect({ ...localStorage }).toEqual(snapshot);
  });

  it.each(["/blogs", "/write", `/edit/${post.id}`, `/blog/${post.id}`])(
    "redirects guest %s to login",
    (route) => {
      clearSession();
      open(route);
      expect(
        screen.getByRole("heading", { name: "Welcome back" }),
      ).toBeVisible();
      expect(screen.queryByLabelText("Content")).not.toBeInTheDocument();
    },
  );

  it.each(["alice", "admin"])(
    "shows exact empty CTA for %s and opens/cancels writing without mutation",
    async (username) => {
      login(username, username === "admin" ? "admin" : "demo");
      open("/blogs");
      expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
      expect(
        screen.getByText("No blogs yet. Be the first to write one!"),
      ).toBeVisible();
      await userEvent
        .setup()
        .click(
          within(screen.getByRole("main")).getByRole("link", { name: "Write" }),
        );
      expect(
        screen.getByRole("heading", { name: "Write a Blog" }),
      ).toBeVisible();
      fill();
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
      expect(getPosts()).toEqual([]);
    },
  );

  it("renders all records newest first in 1/md2/lg3 grid, opens read and card edit routes", async () => {
    savePosts([
      post,
      {
        ...post,
        id: bob.id,
        title: "Newest",
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    open("/blogs");
    const grid = screen.getByRole("region", { name: "All posts" });
    expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-2", "lg:grid-cols-3");
    expect(
      within(grid)
        .getAllByRole("heading")
        .map((node) => node.textContent),
    ).toEqual(["Newest", post.title]);
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: post.title, exact: true }));
    expect(
      screen.getByRole("heading", { level: 1, name: post.title }),
    ).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: "Back to All Posts" }));
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: `Edit ${post.title}` }));
    expect(screen.getByLabelText("Title")).toHaveValue(post.title);
    expect(getPosts()).toHaveLength(2);
  });

  it("degrades corrupted posts to the exact list empty state", () => {
    localStorage.setItem("writespace_posts", "[null]");
    open("/blogs");
    expect(
      screen.getByText("No blogs yet. Be the first to write one!"),
    ).toBeVisible();
  });

  it("shows each field error, associated accessible descriptions and whitespace-sensitive counter before creating", async () => {
    open("/write");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Title is required.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.getByText("Content is required.")).toHaveAttribute(
      "role",
      "alert",
    );
    for (const label of ["Title", "Content"]) {
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(screen.getByLabelText(label)).toHaveAttribute(
        "aria-required",
        "true",
      );
    }
    expect(screen.getByLabelText("Content")).toHaveClass("min-h-64");
    fill({ title: " ", content: " \n " });
    expect(screen.getByRole("status")).toHaveTextContent("3 characters");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(getPosts()).toEqual([]);
    fill({ title: values.title, content: "" });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.queryByText("Title is required.")).not.toBeInTheDocument();
    expect(screen.getByText("Content is required.")).toBeVisible();
    fill({ title: "", content: values.content });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Title is required.")).toBeVisible();
    expect(screen.queryByText("Content is required.")).not.toBeInTheDocument();
    fill();
    expect(screen.getByRole("status")).toHaveTextContent(
      `${values.content.length} characters`,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("heading", { name: values.title })).toBeVisible();
    expect(getPosts()[0]).toMatchObject({
      ...values,
      authorId: alice.id,
      authorName: "Alice",
    });
    expect(
      screen.getByText(values.content, { normalizer: (text) => text }),
    ).toHaveClass("whitespace-pre-wrap");
  });

  it("prefills edit, validates, cancels without saving then saves while preserving metadata", async () => {
    savePosts([post]);
    open(`/blog/${post.id}`);
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: "Edit", exact: true }));
    expect(screen.getByRole("heading", { name: "Edit Post" })).toBeVisible();
    expect(screen.getByLabelText("Title")).toHaveValue(post.title);
    expect(screen.getByLabelText("Content")).toHaveValue(post.content);
    expect(screen.getByRole("status")).toHaveTextContent(
      `${post.content.length} characters`,
    );
    fill({ title: "", content: "" });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(getPostById(post.id)).toEqual(post);
    fill();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { name: post.title })).toBeVisible();
    expect(getPostById(post.id)).toEqual(post);
    await user.click(screen.getByRole("link", { name: "Edit", exact: true }));
    fill();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("heading", { name: values.title })).toBeVisible();
    expect(getPostById(post.id)).toEqual({ ...post, ...values });
    cleanup();
    open(`/blog/${post.id}`);
    expect(screen.getByRole("heading", { name: values.title })).toBeVisible();
  });

  it.each(["/write", `/edit/${post.id}`])(
    "keeps %s form and data intact after failed save then allows retry",
    async (route) => {
      savePosts([post]);
      open(route);
      fill();
      const spy = blockSave();
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enable local storage or free space",
      );
      expect(screen.getByLabelText("Content")).toHaveValue(values.content);
      expect(getPosts()).toEqual([post]);
      spy.mockRestore();
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Save" }));
      expect(screen.getByRole("heading", { name: values.title })).toBeVisible();
      expect(getPosts()).toHaveLength(route === "/write" ? 2 : 1);
    },
  );

  it.each(["bad", "92345678-1234-4234-8234-123456789abc"])(
    "reader missing %s shows not-found and functional back link; editor redirects",
    async (id) => {
      savePosts([post]);
      open(`/blog/${id}`);
      expect(
        screen.getByRole("heading", { name: "Post not found" }),
      ).toBeVisible();
      await userEvent
        .setup()
        .click(screen.getByRole("link", { name: "Back to All Posts" }));
      expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
      cleanup();
      open(`/edit/${id}`);
      expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
      expect(screen.queryByLabelText("Content")).not.toBeInTheDocument();
      expect(getPosts()).toEqual([post]);
    },
  );

  it("nonowner reads full text with only back action and cannot open editor", () => {
    savePosts([post]);
    login("bob", "demo");
    open(`/blog/${post.id}`);
    const main = screen.getByRole("main");
    expect(within(main).getAllByRole("link")).toHaveLength(1);
    expect(
      within(main).getByRole("link", { name: "Back to All Posts" }),
    ).toBeVisible();
    expect(
      within(main).queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(post.content, { normalizer: (text) => text }),
    ).toBeVisible();
    cleanup();
    open(`/edit/${post.id}`);
    expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
    expect(
      screen.queryByRole("link", { name: `Edit ${post.title}` }),
    ).not.toBeInTheDocument();
    expect(getPosts()).toEqual([post]);
  });

  it.each(["alice", "admin", "editor"])(
    "%s reader confirms cancellation, save failure, retry and deletion persistence",
    async (username) => {
      savePosts([post]);
      login(username, username === "admin" ? "admin" : "demo");
      open(`/blog/${post.id}`);
      expect(screen.getByText("Mar 04, 2026")).toHaveAttribute(
        "datetime",
        post.createdAt,
      );
      expect(
        within(screen.getByRole("main")).getByRole("img", {
          name: "User avatar",
        }),
      ).toBeVisible();
      const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(getPosts()).toEqual([post]);
      expect(screen.getByRole("heading", { name: post.title })).toBeVisible();
      confirm.mockReturnValue(true);
      const failure = blockSave();
      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not save browser data",
      );
      expect(getPosts()).toEqual([post]);
      failure.mockRestore();
      await user.click(screen.getByRole("button", { name: "Delete" }));
      expect(screen.getByRole("heading", { name: "All Blogs" })).toBeVisible();
      expect(getPosts()).toEqual([]);
      cleanup();
      open(`/blog/${post.id}`);
      expect(
        screen.getByRole("heading", { name: "Post not found" }),
      ).toBeVisible();
    },
  );

  it("admin edits another author's post via UI without claiming authorship", async () => {
    savePosts([post]);
    setSession(ADMIN_SESSION);
    open(`/edit/${post.id}`);
    fill();
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    expect(getPostById(post.id)).toEqual({ ...post, ...values });
    expect(within(screen.getByRole("main")).getByText("Alice")).toBeVisible();
  });

  it("renders large text and XSS-shaped title/content/author as inert full text", async () => {
    const content = `${xss}\n\n${"z".repeat(100000)}  `;
    savePosts([{ ...post, title: xss, content, authorName: xss }]);
    const { container } = open(`/blog/${post.id}`);
    expect(screen.getByRole("heading", { name: xss })).toBeVisible();
    expect(
      screen.getByText(content, { normalizer: (text) => text }).textContent,
    ).toBe(content);
    expect(container.querySelector("img, script")).toBeNull();
    await userEvent
      .setup()
      .click(screen.getByRole("link", { name: "Edit", exact: true }));
    expect(screen.getByLabelText("Content")).toHaveValue(content);
    expect(screen.getByRole("status")).toHaveTextContent(
      `${content.length} characters`,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));
    expect(getPostById(post.id).content).toBe(content);
    expect(container.querySelector("img, script")).toBeNull();
  });
});
