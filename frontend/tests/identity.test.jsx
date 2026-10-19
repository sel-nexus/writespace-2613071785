/** Specify identity persistence, fail-closed boundaries, and accessible form/navigation behavior. */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import {
  getUsers,
  saveUsers,
  getPosts,
  savePosts,
  isUser,
  isId,
  isText,
} from "../src/utils/storage.js";
import {
  ADMIN_SESSION,
  getSession,
  setSession,
  clearSession,
  getRoleHome,
  login,
  register,
  validateRegistration,
} from "../src/utils/auth.js";
import { Avatar, getAvatar } from "../src/components/Avatar.jsx";
import { ProtectedRoute } from "../src/components/ProtectedRoute.jsx";
import { Navbar } from "../src/components/Navbar.jsx";
import { PublicNavbar } from "../src/components/PublicNavbar.jsx";
import LoginPage from "../src/pages/LoginPage.jsx";
import RegisterPage from "../src/pages/RegisterPage.jsx";
import App from "../src/App.jsx";

const account = {
  id: "12345678-1234-4234-8234-123456789abc",
  displayName: "Alice",
  username: "alice",
  password: "demo-pass",
  role: "user",
  createdAt: "2026-03-04T12:00:00.000Z",
};
const identity = {
  userId: account.id,
  username: account.username,
  displayName: account.displayName,
  role: account.role,
};
const values = {
  displayName: "Alice",
  username: "alice",
  password: "demo-pass",
  confirmPassword: "demo-pass",
};
const post = {
  id: "22345678-1234-4234-8234-123456789abc",
  title: "A thought",
  content: "Plain text",
  createdAt: account.createdAt,
  authorId: account.id,
  authorName: "Alice",
};

beforeEach(() => localStorage.clear());

/** Expose router location as user-observable test output.
 * @returns {JSX.Element} Current route.
 */
function Location() {
  const location = useLocation();
  return <output aria-label="Current route">{location.pathname}</output>;
}

/** Render a component with routing but no fake persistence.
 * @param {React.ReactNode} content Component under test.
 * @param {string} route Initial route.
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

/** Fill registration as a visitor using accessible labels.
 * @param {object} user userEvent driver.
 * @param {object} data Field values.
 * @returns {Promise<void>} Completion of typing.
 */
async function fillRegistration(user, data = values) {
  await user.type(screen.getByLabelText("Display Name"), data.displayName);
  await user.type(screen.getByLabelText("Username"), data.username);
  await user.type(screen.getByLabelText("Password"), data.password);
  await user.type(
    screen.getByLabelText("Confirm Password"),
    data.confirmPassword,
  );
}

/** Fill login as a visitor.
 * @param {object} user userEvent driver.
 * @param {string} username Account name.
 * @param {string} password Demo credential.
 * @returns {Promise<void>} Completion of typing.
 */
async function fillLogin(user, username = "admin", password = "admin") {
  await user.type(screen.getByLabelText("Username"), username);
  await user.type(screen.getByLabelText("Password"), password);
}

describe("storage.js validated array persistence", () => {
  it("starts empty and round-trips valid user and post arrays through localStorage", () => {
    expect(getUsers()).toEqual([]);
    expect(getPosts()).toEqual([]);
    saveUsers([account]);
    savePosts([post]);
    expect(getUsers()).toEqual([account]);
    expect(getPosts()).toEqual([post]);
    expect(JSON.parse(localStorage.getItem("writespace_users"))).toEqual([
      account,
    ]);
    savePosts([{ ...post, authorId: "admin" }]);
    expect(getPosts()[0].authorId).toBe("admin");
    saveUsers([]);
    savePosts([]);
    expect(getUsers()).toEqual([]);
    expect(getPosts()).toEqual([]);
  });

  it.each(["{broken", "null", "{}", "42", "[null]", "[{}]"])(
    "falls back to [] for corrupted array %s",
    (raw) => {
      localStorage.setItem("writespace_users", raw);
      localStorage.setItem("writespace_posts", raw);
      expect(getUsers()).toEqual([]);
      expect(getPosts()).toEqual([]);
    },
  );

  it.each(["id", "displayName", "username", "password", "role", "createdAt"])(
    "rejects missing user field %s without overwriting saved data",
    (field) => {
      saveUsers([account]);
      const broken = { ...account };
      delete broken[field];
      expect(isUser(broken)).toBe(false);
      expect(() => saveUsers([broken])).toThrow("invalid records");
      expect(getUsers()).toEqual([account]);
      localStorage.setItem(
        "writespace_users",
        JSON.stringify([account, broken]),
      );
      expect(getUsers()).toEqual([]);
    },
  );

  it.each(["id", "title", "content", "createdAt", "authorId", "authorName"])(
    "rejects missing post field %s",
    (field) => {
      const broken = { ...post };
      delete broken[field];
      expect(() => savePosts([broken])).toThrow("invalid records");
      localStorage.setItem("writespace_posts", JSON.stringify([broken]));
      expect(getPosts()).toEqual([]);
    },
  );

  it.each([
    { role: "owner" },
    { id: "not-a-uuid" },
    { username: "admin" },
    { username: " alice " },
    { displayName: "   " },
    { password: 123 },
    { createdAt: "2026-03-04" },
    { createdAt: "not-a-date" },
  ])("rejects invalid account shape %j", (patch) => {
    expect(isUser({ ...account, ...patch })).toBe(false);
    expect(() => saveUsers([{ ...account, ...patch }])).toThrow(
      "invalid records",
    );
  });

  it("validates text and UUID types, and rejects non-array writes", () => {
    expect(isText(" words ")).toBe(true);
    expect(isText(" ")).toBe(false);
    expect(isText({})).toBe(false);
    expect(isId(account.id)).toBe(true);
    expect(isId(12)).toBe(false);
    expect(isId("admin")).toBe(false);
    expect(() => saveUsers(null)).toThrow("invalid records");
    expect(() => savePosts({})).toThrow("invalid records");
    expect(() => savePosts([{ ...post, authorId: "missing" }])).toThrow(
      "invalid records",
    );
  });

  it("catches blocked reads and makes quota writes actionable without successful mutation", () => {
    saveUsers([account]);
    const reads = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(getUsers()).toEqual([]);
    expect(getPosts()).toEqual([]);
    reads.mockRestore();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveUsers([])).toThrow("Enable local storage or free space");
    expect(() => savePosts([post])).toThrow(
      "Enable local storage or free space",
    );
    expect(getUsers()).toEqual([account]);
    expect(getPosts()).toEqual([]);
  });
});

describe("auth.js session integrity", () => {
  it("persists only public session fields and clears them on logout", () => {
    saveUsers([account]);
    expect(setSession({ ...identity, password: "never-in-session" })).toEqual(
      identity,
    );
    expect(getSession()).toEqual(identity);
    expect(JSON.parse(localStorage.getItem("writespace_session"))).toEqual(
      identity,
    );
    clearSession();
    expect(getSession()).toBeNull();
    expect(localStorage.getItem("writespace_session")).toBeNull();
    clearSession();
  });

  it.each(["{broken", "null", "{}", "[]", "42", '"admin"'])(
    "rejects corrupted session %s",
    (raw) => {
      localStorage.setItem("writespace_session", raw);
      expect(getSession()).toBeNull();
    },
  );

  it.each(["userId", "username", "displayName", "role"])(
    "rejects missing session field %s",
    (field) => {
      saveUsers([account]);
      const broken = { ...identity };
      delete broken[field];
      localStorage.setItem("writespace_session", JSON.stringify(broken));
      expect(getSession()).toBeNull();
      expect(() => setSession(broken)).toThrow("invalid session");
    },
  );

  it.each([
    { role: "admin" },
    { role: "owner" },
    { username: "other" },
    { displayName: "Other" },
    { userId: "missing" },
  ])("rejects forged identity %j", (patch) => {
    saveUsers([account]);
    localStorage.setItem(
      "writespace_session",
      JSON.stringify({ ...identity, ...patch }),
    );
    expect(getSession()).toBeNull();
    expect(() => setSession({ ...identity, ...patch })).toThrow(
      "invalid session",
    );
  });

  it("rejects removed accounts and corrupt account storage even with a previously valid session", () => {
    saveUsers([account]);
    setSession(identity);
    saveUsers([]);
    expect(getSession()).toBeNull();
    saveUsers([account]);
    setSession(identity);
    localStorage.setItem("writespace_users", "[null]");
    expect(getSession()).toBeNull();
  });

  it("accepts only the exact built-in admin identity independently of local accounts", () => {
    localStorage.setItem("writespace_users", "corrupted");
    expect(setSession(ADMIN_SESSION)).toEqual(ADMIN_SESSION);
    expect(getSession()).toEqual(ADMIN_SESSION);
    expect(() => setSession({ ...ADMIN_SESSION, role: "user" })).toThrow(
      "invalid session",
    );
    expect(() => setSession({ ...ADMIN_SESSION, displayName: "Fake" })).toThrow(
      "invalid session",
    );
  });

  it("fails safely on reads and explicitly on session writes and removal", () => {
    setSession(ADMIN_SESSION);
    const read = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(getSession()).toBeNull();
    read.mockRestore();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => setSession(ADMIN_SESSION)).toThrow(
      "Could not save your session",
    );
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => clearSession()).toThrow("Could not log out");
    expect(getSession()).toEqual(ADMIN_SESSION);
  });

  it("resolves each supported role and the guest destination", () => {
    expect(getRoleHome(ADMIN_SESSION)).toBe("/admin");
    expect(getRoleHome(identity)).toBe("/blogs");
    expect(getRoleHome(null)).toBe("/login");
    expect(getRoleHome({ role: "owner" })).toBe("/login");
  });
});

describe("auth.js login and self-registration", () => {
  it("logs in built-in admin first even if stored accounts are corrupted", () => {
    localStorage.setItem("writespace_users", "{broken");
    expect(login("admin", "admin")).toEqual(ADMIN_SESSION);
    expect(getSession()).toEqual(ADMIN_SESSION);
  });

  it("logs in a stored user and a locally created administrator with their true roles", () => {
    const admin = {
      ...account,
      id: post.id,
      username: "editor",
      role: "admin",
    };
    saveUsers([account, admin]);
    expect(login("alice", "demo-pass")).toEqual(identity);
    clearSession();
    expect(login("editor", "demo-pass").role).toBe("admin");
    expect(getSession().userId).toBe(admin.id);
  });

  it.each([
    ["admin", "wrong"],
    ["missing", "demo-pass"],
    ["alice", "wrong"],
    ["", "x"],
    [null, "x"],
    ["alice", 5],
    [" ", " "],
  ])(
    "rejects invalid credentials %j / %j without creating a session",
    (username, password) => {
      saveUsers([account]);
      expect(() => login(username, password)).toThrow(
        "Invalid username or password.",
      );
      expect(getSession()).toBeNull();
    },
  );

  it("does not report built-in login success when session writes are blocked", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => login("admin", "admin")).toThrow(
      "Could not save your session",
    );
    expect(getSession()).toBeNull();
  });

  it("registers with UUID, timestamp, trimmed names and plaintext demo password, then logs in again", () => {
    const result = register({
      ...values,
      displayName: " Alice ",
      username: " alice ",
    });
    const saved = getUsers()[0];
    expect(isId(saved.id)).toBe(true);
    expect(saved).toMatchObject({
      displayName: "Alice",
      username: "alice",
      password: "demo-pass",
      role: "user",
    });
    expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
    expect(result).toEqual(getSession());
    expect(result.userId).toBe(saved.id);
    clearSession();
    expect(login("alice", "demo-pass")).toEqual(result);
    expect(getUsers()).toHaveLength(1);
  });

  it.each(["displayName", "username", "password", "confirmPassword"])(
    "rejects absent or whitespace registration field %s",
    (field) => {
      for (const bad of [undefined, "", "   ", 42]) {
        expect(validateRegistration({ ...values, [field]: bad })[field]).toBe(
          "This field is required.",
        );
        expect(() => register({ ...values, [field]: bad })).toThrow();
        expect(getUsers()).toEqual([]);
        expect(getSession()).toBeNull();
      }
    },
  );

  it("rejects duplicate usernames case-insensitively, reserved admin and mismatched passwords", () => {
    saveUsers([account]);
    for (const username of ["alice", "ALICE", "admin", " Admin "]) {
      expect(validateRegistration({ ...values, username }).username).toBe(
        "That username is already taken.",
      );
      expect(() => register({ ...values, username })).toThrow("already taken");
    }
    expect(
      validateRegistration({
        ...values,
        username: "new",
        confirmPassword: "wrong",
      }).confirmPassword,
    ).toBe("Passwords must match.");
    expect(() =>
      register({ ...values, username: "new", confirmPassword: "wrong" }),
    ).toThrow("Passwords must match");
    expect(getUsers()).toEqual([account]);
    expect(getSession()).toBeNull();
  });

  it("forbids admin registration and accepts explicit user only", () => {
    expect(validateRegistration({ ...values, role: "admin" }).role).toContain(
      "only allows the user",
    );
    expect(() => register({ ...values, role: "admin" })).toThrow(
      "only allows the user",
    );
    expect(getUsers()).toEqual([]);
    expect(register({ ...values, role: "user" }).role).toBe("user");
  });

  it("returns required errors for omitted registration data", () => {
    expect(Object.keys(validateRegistration())).toHaveLength(4);
    expect(() => register()).toThrow("required");
    for (const invalid of [null, 42, "account", []]) {
      expect(Object.keys(validateRegistration(invalid))).toHaveLength(4);
      expect(() => register(invalid)).toThrow("required");
      expect(getUsers()).toEqual([]);
      expect(getSession()).toBeNull();
    }
  });

  it("does not create an account or session when account storage fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => register(values)).toThrow("Could not save browser data");
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
  });

  it("reports a saved account but no successful login when only session storage fails", () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      function (key, value) {
        if (key === "writespace_session") throw new Error("quota");
        return original.call(this, key, value);
      },
    );
    expect(() => register(values)).toThrow(
      "Your account was saved, but login failed",
    );
    expect(getUsers()[0].username).toBe("alice");
    expect(getSession()).toBeNull();
    vi.restoreAllMocks();
    expect(login("alice", "demo-pass").username).toBe("alice");
  });
});

describe("Avatar.jsx", () => {
  it("renders the crown and violet background for Admin", () => {
    render(<Avatar role="admin" />);
    expect(screen.getByRole("img", { name: "Admin avatar" })).toHaveTextContent(
      "👑",
    );
    expect(screen.getByRole("img")).toHaveClass("bg-violet-600");
  });

  it("renders a book and indigo background for default user and unknown helper roles", () => {
    render(<Avatar />);
    expect(screen.getByRole("img", { name: "User avatar" })).toHaveTextContent(
      "📚",
    );
    expect(screen.getByRole("img")).toHaveClass("bg-indigo-500");
    cleanup();
    render(getAvatar("unknown"));
    expect(screen.getByRole("img")).toHaveTextContent("📚");
  });
});

describe("ProtectedRoute.jsx", () => {
  /** Render a role guard with real redirect destinations.
   * @param {string} role Optional guard role.
   * @returns {object} Render result.
   */
  function guard(role) {
    return routed(
      <Routes>
        <Route
          path="/secret"
          element={
            <ProtectedRoute role={role}>
              <p>Protected content</p>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<p>Guest login</p>} />
        <Route path="/blogs" element={<p>User destination</p>} />
      </Routes>,
      "/secret",
    );
  }

  it("redirects missing and corrupted sessions to login", () => {
    guard("admin");
    expect(screen.getByText("Guest login")).toBeInTheDocument();
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/login");
    cleanup();
    localStorage.setItem("writespace_session", "{broken");
    guard();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    expect(screen.getByText("Guest login")).toBeInTheDocument();
  });

  it("allows a user through ordinary guards but redirects them from admin guards", () => {
    saveUsers([account]);
    setSession(identity);
    guard();
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    cleanup();
    guard("admin");
    expect(screen.getByText("User destination")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("allows the built-in Admin through the admin guard", () => {
    setSession(ADMIN_SESSION);
    guard("admin");
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});

describe("PublicNavbar.jsx", () => {
  it("offers brand, login and registration links for guests", async () => {
    const user = userEvent.setup();
    routed(<PublicNavbar />);
    expect(screen.getByRole("link", { name: "WriteSpace" })).toHaveAttribute(
      "href",
      "/",
    );
    await user.click(screen.getByRole("link", { name: "Get Started" }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/register",
    );
    await user.click(screen.getByRole("link", { name: "Login" }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/login");
  });

  it.each([
    [identity, "/blogs"],
    [ADMIN_SESSION, "/admin"],
  ])(
    "shows role identity and its available home %j",
    (session, destination) => {
      routed(<PublicNavbar session={session} />);
      expect(screen.getByText(session.displayName)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "My account" })).toHaveAttribute(
        "href",
        destination,
      );
      expect(
        screen.queryByRole("link", { name: "Login" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Get Started" }),
      ).not.toBeInTheDocument();
    },
  );
});

describe("Navbar.jsx", () => {
  it("toggles mobile navigation, highlights account route and logs out through dropdown", async () => {
    saveUsers([account]);
    setSession(identity);
    const user = userEvent.setup();
    const onSessionChange = vi.fn();
    routed(
      <Navbar session={identity} onSessionChange={onSessionChange} />,
      "/blogs",
    );
    expect(screen.getByRole("link", { name: "My account" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "My account" })).toHaveClass(
      "bg-indigo-600",
    );
    const toggle = screen.getByRole("button", { name: "Toggle navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      within(
        screen.getByRole("navigation", { name: "Mobile navigation" }),
      ).getByRole("link", { name: "My account" }),
    ).toHaveAttribute("href", "/blogs");
    await user.click(toggle);
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
    const options = screen.getByRole("button", {
      name: "Account options for Alice",
    });
    await user.click(options);
    expect(options).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(getSession()).toBeNull();
    expect(localStorage.getItem("writespace_session")).toBeNull();
    expect(screen.getByLabelText("Current route")).toHaveTextContent(/^\/$/);
    expect(onSessionChange).toHaveBeenCalledWith(null);
  });

  it("filters privileged links by role and closes disclosures on Escape and navigation", async () => {
    const user = userEvent.setup();
    const links = [
      { to: "/write", label: "Write" },
      { to: "/users", label: "Users", role: "admin" },
    ];
    routed(
      <Navbar session={identity} onSessionChange={vi.fn()} links={links} />,
    );
    expect(
      screen.queryByRole("link", { name: "Users" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Account options for Alice" }),
    );
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("button", { name: "Logout" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Toggle navigation" }));
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Mobile navigation" }),
      ).getByRole("link", { name: "Write" }),
    );
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/write");
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
    cleanup();
    routed(
      <Navbar
        session={ADMIN_SESSION}
        onSessionChange={vi.fn()}
        links={links}
      />,
    );
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute(
      "href",
      "/users",
    );
    expect(
      screen.getByRole("img", { name: "Admin avatar" }),
    ).toBeInTheDocument();
  });

  it("keeps the persisted session and reports failed logout instead of pretending success", async () => {
    setSession(ADMIN_SESSION);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const user = userEvent.setup();
    const notify = vi.fn();
    routed(
      <Navbar session={ADMIN_SESSION} onSessionChange={notify} />,
      "/admin",
    );
    await user.click(
      screen.getByRole("button", { name: "Account options for Admin" }),
    );
    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not log out");
    expect(getSession()).toEqual(ADMIN_SESSION);
    expect(notify).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/admin");
  });
});

describe("LoginPage.jsx", () => {
  it("shows visible demo warning, credential hint and required field errors", async () => {
    const user = userEvent.setup();
    routed(<LoginPage onSessionChange={vi.fn()} />);
    expect(
      screen.getByText(/Passwords are stored in plaintext/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Demo administrator:/)).toHaveTextContent(
      "username admin / password admin",
    );
    await user.click(screen.getByRole("button", { name: "Login" }));
    expect(screen.getByText("Username is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(getSession()).toBeNull();
    await user.click(screen.getByRole("link", { name: "Register" }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/register",
    );
  });

  it("reports invalid credentials without persistence", async () => {
    const user = userEvent.setup();
    routed(<LoginPage onSessionChange={vi.fn()} />);
    await fillLogin(user, "admin", "wrong");
    await user.click(screen.getByRole("button", { name: "Login" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid username or password.",
    );
    expect(getSession()).toBeNull();
  });

  it.each([
    [ADMIN_SESSION, "admin", "admin", "/admin"],
    [identity, "alice", "demo-pass", "/blogs"],
  ])(
    "persists valid login and routes by role %j",
    async (expected, username, password, path) => {
      saveUsers([account]);
      const notify = vi.fn();
      const user = userEvent.setup();
      routed(<LoginPage onSessionChange={notify} />);
      await fillLogin(user, username, password);
      await user.click(screen.getByRole("button", { name: "Login" }));
      expect(getSession()).toEqual(expected);
      expect(notify).toHaveBeenCalledWith(expected);
      expect(screen.getByLabelText("Current route")).toHaveTextContent(path);
    },
  );

  it("shows actionable write failure without navigating or notifying success", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const notify = vi.fn();
    const user = userEvent.setup();
    routed(<LoginPage onSessionChange={notify} />, "/login");
    await fillLogin(user);
    await user.click(screen.getByRole("button", { name: "Login" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not save your session",
    );
    expect(notify).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/login");
  });

  it("renders account data as text, never HTML, and does not render a login form when signed in", () => {
    routed(
      <LoginPage
        session={{ ...identity, displayName: "<script>alert(1)</script>" }}
        onSessionChange={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: "Welcome, <script>alert(1)</script>",
      }),
    ).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("You are signed in on this browser.")).toHaveAttribute("role", "status");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });
});

describe("RegisterPage.jsx", () => {
  it("requires every field with accessible error associations and offers Login", async () => {
    const user = userEvent.setup();
    routed(<RegisterPage onSessionChange={vi.fn()} />, "/register");
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getAllByRole("alert")).toHaveLength(4);
    for (const label of [
      "Display Name",
      "Username",
      "Password",
      "Confirm Password",
    ]) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(
        document.getElementById(input.getAttribute("aria-describedby")),
      ).toHaveTextContent("required");
    }
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(getUsers()).toEqual([]);
    await user.click(screen.getByRole("link", { name: "Login" }));
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/login");
  });

  it.each([
    [{ ...values, username: "admin" }, "That username is already taken."],
    [{ ...values, confirmPassword: "wrong" }, "Passwords must match."],
    [{ ...values, username: "ALICE" }, "That username is already taken."],
  ])(
    "shows registration errors for %j and never writes another account",
    async (data, message) => {
      saveUsers([account]);
      const user = userEvent.setup();
      routed(<RegisterPage onSessionChange={vi.fn()} />);
      await fillRegistration(user, data);
      await user.click(screen.getByRole("button", { name: "Register" }));
      expect(screen.getByText(message)).toHaveAttribute("role", "alert");
      expect(getUsers()).toEqual([account]);
      expect(getSession()).toBeNull();
    },
  );

  it("saves account and session and routes to the available user destination", async () => {
    const user = userEvent.setup();
    const notify = vi.fn();
    routed(<RegisterPage onSessionChange={notify} />, "/register");
    await fillRegistration(user);
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(getUsers()[0]).toMatchObject({
      username: "alice",
      role: "user",
      password: "demo-pass",
    });
    expect(getSession().userId).toBe(getUsers()[0].id);
    expect(notify).toHaveBeenCalledWith(getSession());
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/blogs");
  });

  it("reports account write failure without successful registration", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const user = userEvent.setup();
    const notify = vi.fn();
    routed(<RegisterPage onSessionChange={notify} />, "/register");
    await fillRegistration(user);
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enable local storage or free space",
    );
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
    expect(notify).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Current route")).toHaveTextContent(
      "/register",
    );
  });

  it("explains partial persistence when account save succeeds but session save fails", async () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      function (key, value) {
        if (key === "writespace_session") throw new Error("quota");
        return original.call(this, key, value);
      },
    );
    const user = userEvent.setup();
    const notify = vi.fn();
    routed(<RegisterPage onSessionChange={notify} />, "/register");
    await fillRegistration(user);
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your account was saved, but login failed",
    );
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toBeNull();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("App.jsx available identity routing", () => {
  it("lets a guest register via navigation, persists identity across remount, and logs out", async () => {
    const user = userEvent.setup();
    routed(<App />);
    await user.click(screen.getByRole("link", { name: "Get Started" }));
    await fillRegistration(user);
    await user.click(screen.getByRole("button", { name: "Register" }));
    expect(
      screen.getByRole("heading", { name: "Welcome, Alice" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/blogs");
    expect(
      screen.queryByRole("link", { name: "Write" }),
    ).not.toBeInTheDocument();
    cleanup();
    routed(<App />, "/blogs");
    expect(
      screen.getByRole("heading", { name: "Welcome, Alice" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Account options for Alice" }),
    );
    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(getSession()).toBeNull();
    expect(getUsers()).toHaveLength(1);
  });

  it.each(["/blogs", "/admin"])(
    "redirects unauthenticated access from %s to login",
    (path) => {
      routed(<App />, path);
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/login",
      );
      expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
    },
  );

  it.each(["/login", "/register"])(
    "redirects signed-in users from %s to their role home",
    (path) => {
      saveUsers([account]);
      setSession(identity);
      routed(<App />, path);
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/blogs",
      );
      expect(
        screen.getByRole("heading", { name: "Welcome, Alice" }),
      ).toBeInTheDocument();
      cleanup();
      setSession(ADMIN_SESSION);
      routed(<App />, path);
      expect(screen.getByLabelText("Current route")).toHaveTextContent(
        "/admin",
      );
      expect(
        screen.getByRole("heading", { name: "Welcome, Admin" }),
      ).toBeInTheDocument();
    },
  );

  it("redirects a user from admin and unknown destinations without showing future feature stubs", () => {
    saveUsers([account]);
    setSession(identity);
    routed(<App />, "/admin");
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/blogs");
    cleanup();
    routed(<App />, "/write");
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/blogs");
    expect(
      screen.queryByRole("link", { name: "Users" }),
    ).not.toBeInTheDocument();
  });

  it("synchronizes logout from another tab and safely renders corrupted reads", () => {
    setSession(ADMIN_SESSION);
    routed(<App />, "/admin");
    act(() => {
      localStorage.removeItem("writespace_session");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "writespace_session" }),
      );
    });
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current route")).toHaveTextContent("/login");
    cleanup();
    localStorage.setItem("writespace_session", "{broken");
    localStorage.setItem("writespace_users", "[null]");
    routed(<App />);
    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
  });
});

Location.propTypes = {};
