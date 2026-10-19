/** Admin requirements exercised through real services, localStorage, components and Router. */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "../src/App.jsx";
import AdminDashboard from "../src/pages/AdminDashboard.jsx";
import UserManagement from "../src/pages/UserManagement.jsx";
import { StatCard } from "../src/components/StatCard.jsx";
import { UserRow } from "../src/components/UserRow.jsx";
import {
  ADMIN_SESSION,
  setSession,
  getSession,
  clearSession,
  login,
} from "../src/utils/auth.js";
import {
  getUsers,
  saveUsers,
  getPosts,
  savePosts,
  isId,
} from "../src/utils/storage.js";
import {
  listUsers,
  getAdminStats,
  validateUser,
  createUser,
  deleteUser,
} from "../src/utils/userService.js";

const account = {
  id: "12345678-1234-4234-8234-123456789abc",
  displayName: "Writer",
  username: "writer",
  password: "demo-secret",
  role: "user",
  createdAt: "2026-03-04T12:00:00.000Z",
};
const editor = {
  ...account,
  id: "22345678-1234-4234-8234-123456789abc",
  username: "editor",
  displayName: "Editor",
  role: "admin",
};
const values = {
  displayName: "New Writer",
  username: "new-writer",
  password: "demo-only",
  role: "user",
};
const posts = Array.from({ length: 7 }, (_, index) => ({
  id: `${index + 3}2345678-1234-4234-8234-123456789abc`,
  title: `Post ${index + 1}`,
  content: "Plain words",
  authorId: account.id,
  authorName: account.displayName,
  createdAt: `2026-03-0${index + 1}T12:00:00.000Z`,
}));

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Expose Router output for actual navigation assertions.
 * @returns {JSX.Element} Current pathname.
 */
function Location() {
  const { pathname } = useLocation();
  return <span aria-label="Current route">{pathname}</span>;
}
Location.propTypes = {};

/** Render inside a single test router.
 * @param {React.ReactNode} content Component under test.
 * @param {string} route Initial route.
 * @returns {object} Render result.
 */
function routed(content, route = "/admin") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {content}
      <Location />
    </MemoryRouter>,
  );
}

/** Submit the public admin creation form via associated labels.
 * @param {object} driver userEvent driver.
 * @param {object} data Required fields.
 * @returns {Promise<void>} Submitted form.
 */
async function fillUser(driver, data = values) {
  await driver.type(
    screen.getByLabelText("Display Name", { exact: true }),
    data.displayName,
  );
  await driver.type(
    screen.getByLabelText("Username", { exact: true }),
    data.username,
  );
  await driver.type(
    screen.getByLabelText("Password", { exact: true }),
    data.password,
  );
  await driver.selectOptions(
    screen.getByLabelText("Role", { exact: true }),
    data.role,
  );
  await driver.click(
    screen.getByRole("button", { name: "Create User", exact: true }),
  );
}

/** Select the real desktop account list (jsdom does not apply Tailwind visibility).
 * @returns {object} Scoped table queries.
 */
function table() {
  return within(screen.getByRole("table", { name: "Accounts" }));
}

/** Simulate browser write failure only, leaving real reads available.
 * @returns {object} Restore-capable storage spy.
 */
function failWrites() {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
}

describe("userService actual account persistence", () => {
  it("lists built-in admin without credentials or fabricated date and counts all accounts", () => {
    setSession(ADMIN_SESSION);
    expect(listUsers()).toEqual([
      {
        id: "admin",
        displayName: "Admin",
        username: "admin",
        role: "admin",
        createdAt: null,
      },
    ]);
    expect(getAdminStats()).toEqual({
      totalUsers: 1,
      totalAdmins: 1,
      totalPosts: 0,
    });
    saveUsers([account, editor]);
    savePosts(posts);
    expect(listUsers()).toHaveLength(3);
    expect(listUsers().every((user) => !("password" in user))).toBe(true);
    expect(getAdminStats(ADMIN_SESSION)).toEqual({
      totalUsers: 3,
      totalAdmins: 2,
      totalPosts: 7,
    });
  });

  it.each(["user", "admin"])(
    "creates %s with UUID ISO timestamp trimmed names and rereads persistence",
    (role) => {
      setSession(ADMIN_SESSION);
      const result = createUser({
        ...values,
        role,
        displayName: " New Writer ",
        username: " new-writer ",
        id: "fake",
        createdAt: "fake",
      });
      expect(isId(result.id)).toBe(true);
      expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
      expect(result).toMatchObject({ ...values, role });
      expect(getUsers()).toEqual([result]);
      expect(getSession()).toEqual(ADMIN_SESSION);
      clearSession();
      expect(login(values.username, values.password)).toMatchObject({
        userId: result.id,
        role,
      });
    },
  );

  it.each(["displayName", "username", "password", "role"])(
    "rejects every missing/invalid type for %s without mutation",
    (field) => {
      setSession(ADMIN_SESSION);
      for (const invalid of [
        undefined,
        null,
        "",
        "   ",
        0,
        false,
        {},
        [],
        ["user"],
      ]) {
        const candidate = { ...values, [field]: invalid };
        expect(validateUser(candidate)[field]).toBeDefined();
        expect(() => createUser(candidate)).toThrow();
        expect(getUsers()).toEqual([]);
      }
      const missing = { ...values };
      delete missing[field];
      expect(() => createUser(missing)).toThrow();
      expect(getUsers()).toEqual([]);
    },
  );

  it.each([undefined, null, 42, false, "account", [], {}])(
    "rejects invalid/missing whole input %j",
    (input) => {
      setSession(ADMIN_SESSION);
      expect(Object.keys(validateUser(input))).toHaveLength(4);
      expect(() => createUser(input)).toThrow();
      expect(getUsers()).toEqual([]);
    },
  );

  it("accepts valid roles but rejects unsupported role and reserved/case-insensitive duplicates", () => {
    setSession(ADMIN_SESSION);
    saveUsers([account]);
    expect(validateUser(values)).toEqual({});
    expect(validateUser({ ...values, role: "owner" }).role).toBe(
      "Choose Admin or user.",
    );
    expect(() => createUser({ ...values, role: "owner" })).toThrow("Choose");
    for (const username of [
      "writer",
      "WRITER",
      " Writer ",
      "admin",
      "ADMIN",
      " Admin ",
    ]) {
      expect(validateUser({ ...values, username }).username).toBe(
        "That username is already taken.",
      );
      expect(() => createUser({ ...values, username })).toThrow(
        "already taken",
      );
      expect(getUsers()).toEqual([account]);
    }
  });

  it("deletes permitted user and admin, rereads state and retains their posts", () => {
    setSession(ADMIN_SESSION);
    saveUsers([account, editor]);
    savePosts(posts);
    deleteUser(account.id, ADMIN_SESSION);
    expect(getUsers()).toEqual([editor]);
    expect(getPosts()).toEqual(posts);
    deleteUser(editor.id);
    expect(getUsers()).toEqual([]);
    expect(listUsers()).toHaveLength(1);
    expect(getAdminStats().totalAdmins).toBe(1);
  });

  it("protects built-in and active local admin and rejects missing/invalid IDs", () => {
    saveUsers([account, editor]);
    login("editor", "demo-secret");
    expect(() => deleteUser("admin")).toThrow(
      "Default admin cannot be deleted",
    );
    expect(() => deleteUser(editor.id)).toThrow("active account");
    for (const id of [
      undefined,
      null,
      4,
      {},
      "missing",
      "../admin",
      posts[0].id,
    ]) {
      expect(() => deleteUser(id)).toThrow("User not found");
      expect(getUsers()).toEqual([account, editor]);
    }
  });

  it.each(["guest", "user", "removed", "forged-role", "forged-default"])(
    "rejects %s on every privileged operation",
    (kind) => {
      saveUsers([account, editor]);
      if (kind === "user") login("writer", "demo-secret");
      if (kind === "removed") {
        login("editor", "demo-secret");
        saveUsers([account]);
      }
      if (kind === "forged-role")
        localStorage.setItem(
          "writespace_session",
          JSON.stringify({
            userId: account.id,
            username: account.username,
            displayName: account.displayName,
            role: "admin",
          }),
        );
      if (kind === "forged-default")
        localStorage.setItem(
          "writespace_session",
          JSON.stringify({ ...ADMIN_SESSION, displayName: "Fake" }),
        );
      const before = getUsers();
      for (const operation of [
        () => listUsers(),
        () => getAdminStats(),
        () => createUser(values),
        () => deleteUser(account.id),
      ]) {
        expect(operation).toThrow("Administrator access required");
        expect(getUsers()).toEqual(before);
      }
    },
  );

  it.each([
    null,
    {},
    { ...ADMIN_SESSION, userId: editor.id },
    { ...ADMIN_SESSION, username: "fake" },
    { ...ADMIN_SESSION, displayName: "fake" },
    { ...ADMIN_SESSION, role: "user" },
  ])("rejects forged supplied snapshot %j on every operation", (supplied) => {
    setSession(ADMIN_SESSION);
    saveUsers([account]);
    for (const operation of [
      () => listUsers(supplied),
      () => getAdminStats(supplied),
      () => createUser(values, supplied),
      () => deleteUser(account.id, supplied),
    ]) {
      expect(operation).toThrow("Administrator access required");
      expect(getUsers()).toEqual([account]);
    }
  });

  it("rejects previously valid snapshot after switching administrator identity", () => {
    setSession(ADMIN_SESSION);
    saveUsers([editor]);
    login("editor", "demo-secret");
    expect(() => createUser(values, ADMIN_SESSION)).toThrow(
      "Administrator access required",
    );
    expect(() => listUsers(ADMIN_SESSION)).toThrow(
      "Administrator access required",
    );
    expect(() => getAdminStats(ADMIN_SESSION)).toThrow(
      "Administrator access required",
    );
    expect(() => deleteUser(account.id, ADMIN_SESSION)).toThrow(
      "Administrator access required",
    );
    expect(getUsers()).toEqual([editor]);
  });

  it("reports create/delete write failure without mutation and handles corrupt/blocked reads", () => {
    setSession(ADMIN_SESSION);
    saveUsers([account]);
    const writes = failWrites();
    expect(() => createUser(values)).toThrow("Could not save browser data");
    expect(() => deleteUser(account.id)).toThrow("Could not save browser data");
    expect(getUsers()).toEqual([account]);
    writes.mockRestore();
    localStorage.setItem("writespace_users", "{broken");
    localStorage.setItem("writespace_posts", "{broken");
    expect(listUsers()).toHaveLength(1);
    expect(getAdminStats()).toEqual({
      totalPosts: 0,
      totalUsers: 1,
      totalAdmins: 1,
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => listUsers()).toThrow("Administrator access required");
  });

  it("preserves large plaintext fields and treats HTML-shaped data as data", () => {
    setSession(ADMIN_SESSION);
    const result = createUser({
      ...values,
      displayName: "<script>alert(1)</script>",
      password: "x".repeat(20000),
    });
    expect(getUsers()[0]).toEqual(result);
    expect(getUsers()[0].password).toHaveLength(20000);
  });
});

describe("StatCard and UserRow", () => {
  it.each(["indigo", "violet", "pink", "teal"])(
    "renders real zero/count and %s icon treatment",
    (color) => {
      const { rerender } = render(
        <StatCard label="Total Posts" value={0} color={color} />,
      );
      expect(
        screen
          .getByRole("region", { name: "Total Posts" })
          .querySelector(":scope > p").textContent,
      ).toBe("0");
      expect(document.querySelector(`.bg-${color}-100`)).not.toBeNull();
      rerender(<StatCard label="Total Posts" value={123} />);
      expect(
        screen
          .getByRole("region", { name: "Total Posts" })
          .querySelector(":scope > p").textContent,
      ).toBe("123");
    },
  );

  it.each([false, true])(
    "renders public user fields and delete callback in mobile=%s",
    async (mobile) => {
      const remove = vi.fn();
      const content = (
        <UserRow
          user={account}
          currentUserId="admin"
          onDelete={remove}
          mobile={mobile}
        />
      );
      const { container } = render(
        mobile ? (
          content
        ) : (
          <table>
            <tbody>{content}</tbody>
          </table>
        ),
      );
      expect(screen.getByText(account.displayName)).toBeVisible();
      expect(screen.getByText(account.username)).toBeVisible();
      expect(screen.getByText("user", { exact: true })).toBeVisible();
      expect(screen.getByText("Mar 04, 2026")).toHaveAttribute(
        "dateTime",
        account.createdAt,
      );
      expect(screen.getByRole("img", { name: "User avatar" })).toHaveClass(
        "bg-indigo-500",
      );
      expect(container).not.toHaveTextContent(account.password);
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Delete writer" }));
      expect(remove).toHaveBeenCalledWith(account);
    },
  );

  it("disables built-in admin with exact tooltip and active account with reason", async () => {
    setSession(ADMIN_SESSION);
    const remove = vi.fn();
    const { rerender } = render(
      <UserRow
        user={listUsers()[0]}
        currentUserId="admin"
        onDelete={remove}
        mobile
      />,
    );
    const button = screen.getByRole("button", { name: "Delete admin" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Default admin cannot be deleted");
    expect(screen.getByText(/no stored creation date/)).toBeVisible();
    await userEvent.setup().click(button);
    expect(remove).not.toHaveBeenCalled();
    rerender(
      <UserRow
        user={editor}
        currentUserId={editor.id}
        onDelete={remove}
        mobile
      />,
    );
    expect(
      screen.getByRole("button", { name: "Delete editor" }),
    ).toBeDisabled();
    expect(screen.getByRole("img", { name: "Admin avatar" })).toHaveClass(
      "bg-violet-600",
    );
  });

  it("renders hostile account strings inertly and never displays password", () => {
    const text = "<img src=x onerror=alert(1)>";
    const { container } = render(
      <UserRow
        user={{ ...account, displayName: text, username: text }}
        currentUserId="admin"
        onDelete={vi.fn()}
        mobile
      />,
    );
    expect(screen.getAllByText(text)).toHaveLength(2);
    expect(container.querySelector("img,script")).toBeNull();
    expect(container).not.toHaveTextContent(account.password);
  });
});

describe("UserManagement interactions", () => {
  it("shows only built-in empty state, semantic table and stacked cards with required errors associated", async () => {
    setSession(ADMIN_SESSION);
    routed(<UserManagement />, "/users");
    expect(screen.getByText(/No created accounts yet/)).toBeVisible();
    expect(screen.getByRole("table")).toHaveClass("w-full");
    expect(screen.getByLabelText("Account cards")).toHaveClass("sm:hidden");
    expect(screen.getByRole("table").parentElement).toHaveClass(
      "hidden",
      "sm:block",
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Create User" }));
    for (const label of ["Display Name", "Username", "Password", "Role"]) {
      const input = screen.getByLabelText(label, { exact: true });
      expect(input).toHaveAttribute("aria-required", "true");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(
        document.getElementById(input.getAttribute("aria-describedby")),
      ).toHaveAttribute("role", "alert");
    }
    expect(screen.getAllByRole("alert")).toHaveLength(4);
    expect(getUsers()).toEqual([]);
  });

  it.each(["admin", "user"])(
    "creates %s through form, clears fields and persists across remount",
    async (role) => {
      setSession(ADMIN_SESSION);
      routed(<UserManagement />, "/users");
      await fillUser(userEvent.setup(), { ...values, role });
      expect(screen.getByRole("status")).toHaveTextContent("Account created.");
      expect(screen.getByLabelText("Username", { exact: true })).toHaveValue(
        "",
      );
      expect(table().getByText(values.username)).toBeVisible();
      expect(getUsers()[0]).toMatchObject({ ...values, role });
      cleanup();
      routed(<UserManagement />, "/users");
      expect(table().getByText(values.username)).toBeVisible();
      expect(document.querySelector("main")).not.toHaveTextContent(
        values.password,
      );
    },
  );

  it("shows duplicate validation inline and retains values without creation", async () => {
    setSession(ADMIN_SESSION);
    saveUsers([account]);
    routed(<UserManagement />, "/users");
    await fillUser(userEvent.setup(), { ...values, username: "WRITER" });
    expect(screen.getByRole("alert")).toHaveTextContent("already taken");
    expect(screen.getByLabelText("Username", { exact: true })).toHaveAttribute(
      "aria-describedby",
      "create-username-error",
    );
    expect(getUsers()).toEqual([account]);
  });

  it("retains entered fields on failed create and allows a successful retry", async () => {
    setSession(ADMIN_SESSION);
    routed(<UserManagement />, "/users");
    const writes = failWrites();
    const driver = userEvent.setup();
    await fillUser(driver);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not save browser data",
    );
    expect(screen.getByLabelText("Username", { exact: true })).toHaveValue(
      values.username,
    );
    expect(getUsers()).toEqual([]);
    writes.mockRestore();
    await driver.click(screen.getByRole("button", { name: "Create User" }));
    expect(getUsers()).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cancel keeps account, failed delete keeps row, successful delete persists and keeps posts", async () => {
    setSession(ADMIN_SESSION);
    saveUsers([account]);
    savePosts(posts);
    routed(<UserManagement />, "/users");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const driver = userEvent.setup();
    await driver.click(table().getByRole("button", { name: "Delete writer" }));
    expect(getUsers()).toEqual([account]);
    expect(screen.getByRole("status")).toHaveTextContent("cancelled");
    confirm.mockReturnValue(true);
    const writes = failWrites();
    await driver.click(table().getByRole("button", { name: "Delete writer" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not save browser data",
    );
    expect(table().getByText("writer")).toBeVisible();
    expect(getUsers()).toEqual([account]);
    writes.mockRestore();
    await driver.click(table().getByRole("button", { name: "Delete writer" }));
    expect(getUsers()).toEqual([]);
    expect(getPosts()).toEqual(posts);
    expect(table().queryByText("writer")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("posts were retained");
  });

  it("protects active/default accounts and reports a stale session on creation", async () => {
    saveUsers([editor]);
    login("editor", "demo-secret");
    routed(<UserManagement />, "/users");
    expect(
      table().getByRole("button", { name: "Delete editor" }),
    ).toBeDisabled();
    expect(
      table().getByRole("button", { name: "Delete admin" }),
    ).toBeDisabled();
    const driver = userEvent.setup();
    await driver.type(
      screen.getByLabelText("Display Name", { exact: true }),
      values.displayName,
    );
    await driver.type(
      screen.getByLabelText("Username", { exact: true }),
      values.username,
    );
    await driver.type(
      screen.getByLabelText("Password", { exact: true }),
      values.password,
    );
    await driver.selectOptions(
      screen.getByLabelText("Role", { exact: true }),
      values.role,
    );
    clearSession();
    await driver.click(
      screen.getByRole("button", { name: "Create User", exact: true }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Administrator access required",
    );
    expect(getUsers()).toEqual([editor]);
  });

  it("reports a concurrently removed account rather than silent successful deletion", async () => {
    setSession(ADMIN_SESSION);
    saveUsers([account]);
    routed(<UserManagement />, "/users");
    vi.spyOn(window, "confirm").mockImplementation(() => {
      saveUsers([]);
      return true;
    });
    await userEvent
      .setup()
      .click(table().getByRole("button", { name: "Delete writer" }));
    expect(screen.getByRole("alert")).toHaveTextContent("User not found");
    expect(screen.getByRole("status")).not.toHaveTextContent("Account deleted");
  });
});

describe("AdminDashboard interactions and routes", () => {
  it("displays exact four stats, equal user labels with clarification, latest five sorted and edit/read links", async () => {
    setSession(ADMIN_SESSION);
    saveUsers([account, editor]);
    savePosts(posts);
    routed(<AdminDashboard />);
    for (const [label, value] of [
      ["Total Posts", 7],
      ["Total Users", 3],
      ["Total Admins", 2],
      ["Total users", 3],
    ]) {
      expect(
        screen
          .getByRole("region", { name: label, exact: true })
          .querySelector(":scope > p").textContent,
      ).toBe(String(value));
    }
    expect(screen.getByText(/Product clarification/)).toHaveTextContent(
      "duplicate product labels",
    );
    const recent = within(screen.getByRole("region", { name: "Recent Posts" }));
    expect(
      recent
        .getAllByRole("listitem")
        .map(
          (row) =>
            within(row).getByRole("link", { name: /^Post / }).textContent,
        ),
    ).toEqual(["Post 7", "Post 6", "Post 5", "Post 4", "Post 3"]);
    expect(recent.queryByText("Post 2")).not.toBeInTheDocument();
    expect(
      recent.getByRole("link", { name: "Post 7", exact: true }),
    ).toHaveAttribute("href", `/blog/${posts[6].id}`);
    await userEvent
      .setup()
      .click(recent.getByRole("link", { name: "Edit Post 7" }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      `/edit/${posts[6].id}`,
    );
    expect(getPosts()).toEqual(posts);
  });

  it.each(["empty", "corrupt"])(
    "renders %s posts with actual zero count and built-in admin total",
    (kind) => {
      setSession(ADMIN_SESSION);
      if (kind === "corrupt") {
        localStorage.setItem("writespace_posts", "broken");
        localStorage.setItem("writespace_users", "broken");
      }
      routed(<AdminDashboard />);
      expect(screen.getByText(/No posts yet. Write a new post/)).toBeVisible();
      expect(
        screen
          .getByRole("region", { name: "Total Posts" })
          .querySelector(":scope > p").textContent,
      ).toBe("0");
      expect(
        screen
          .getByRole("region", { name: "Total Users", exact: true })
          .querySelector(":scope > p").textContent,
      ).toBe("1");
      expect(
        screen.getByRole("heading", { level: 1 }).parentElement,
      ).toHaveClass("from-violet-600", "to-indigo-600");
    },
  );

  it("cancel retains recent posts, write failure retains data, success updates count and fills latest fifth", async () => {
    setSession(ADMIN_SESSION);
    savePosts(posts);
    routed(<AdminDashboard />);
    const driver = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await driver.click(screen.getByRole("button", { name: "Delete Post 7" }));
    expect(getPosts()).toEqual(posts);
    expect(screen.getByRole("status")).toHaveTextContent("cancelled");
    confirm.mockReturnValue(true);
    const writes = failWrites();
    await driver.click(screen.getByRole("button", { name: "Delete Post 7" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not save browser data",
    );
    expect(getPosts()).toEqual(posts);
    writes.mockRestore();
    await driver.click(screen.getByRole("button", { name: "Delete Post 7" }));
    expect(getPosts()).toEqual(posts.slice(0, 6));
    expect(
      screen.queryByRole("link", { name: "Post 7", exact: true }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Post 2", exact: true }),
    ).toBeVisible();
    expect(
      screen
        .getByRole("region", { name: "Total Posts" })
        .querySelector(":scope > p").textContent,
    ).toBe("6");
  });

  it.each(["missing", "stale"])(
    "reports %s recent-delete failure without successful mutation",
    async (kind) => {
      setSession(ADMIN_SESSION);
      savePosts([posts[0]]);
      routed(<AdminDashboard />);
      vi.spyOn(window, "confirm").mockImplementation(() => {
        if (kind === "missing") savePosts([]);
        else clearSession();
        return true;
      });
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Delete Post 1" }));
      expect(screen.getByRole("alert")).toHaveTextContent(
        kind === "missing" ? "Post not found" : "Please log in again",
      );
      expect(screen.getByRole("status")).not.toHaveTextContent("Post deleted");
      expect(getPosts()).toEqual(kind === "missing" ? [] : [posts[0]]);
    },
  );

  it.each(["/admin", "/users"])(
    "guards %s for guest/user and permits admin",
    (route) => {
      routed(<App />, route);
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/login",
      );
      expect(
        screen.queryByRole("heading", { name: "Manage Users" }),
      ).not.toBeInTheDocument();
      cleanup();
      saveUsers([account]);
      login("writer", "demo-secret");
      routed(<App />, route);
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/blogs",
      );
      expect(
        screen.queryByRole("link", { name: "Users", exact: true }),
      ).not.toBeInTheDocument();
      cleanup();
      setSession(ADMIN_SESSION);
      routed(<App />, route);
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: route === "/admin" ? "Admin Dashboard" : "Manage Users",
        }),
      ).toBeVisible();
      expect(screen.getByLabelText("Current route")).toHaveTextContent(route);
    },
  );

  it("quick actions and navbar provide working user management, dashboard and write entries", async () => {
    setSession(ADMIN_SESSION);
    routed(<App />, "/admin");
    const driver = userEvent.setup();
    await driver.click(
      screen.getByRole("link", { name: "Manage Users", exact: true }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Manage Users" }),
    ).toBeVisible();
    await driver.click(screen.getByRole("link", { name: "Back to Dashboard" }));
    await driver.click(screen.getByRole("link", { name: "Write New Post" }));
    expect(screen.getByRole("heading", { name: "Write a Blog" })).toBeVisible();
    await driver.click(
      screen.getByRole("link", { name: "Dashboard", exact: true }),
    );
    expect(
      screen.getByRole("heading", { name: "Admin Dashboard" }),
    ).toBeVisible();
    await driver.click(
      screen.getByRole("button", { name: "Toggle navigation" }),
    );
    await driver.click(
      within(
        screen.getByRole("navigation", { name: "Mobile navigation" }),
      ).getByRole("link", { name: "Users" }),
    );
    expect(screen.getByRole("heading", { name: "Manage Users" })).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
  });

  it.each([AdminDashboard, UserManagement])(
    "fails closed if rendered without admin session",
    (Page) => {
      routed(<Page />);
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Administrator access required",
      );
      expect(
        screen.queryByRole("button", { name: "Create User" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("region", { name: "Total Posts" }),
      ).not.toBeInTheDocument();
    },
  );
});
