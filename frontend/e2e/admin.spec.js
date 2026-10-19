/** Final admin journeys, run by the parent on the shared desktop/mobile projects. */
import { test, expect } from "./fixtures.js";

/** Submit real local credentials; navigation to the form remains the journey's responsibility.
 * @param {object} page Browser page.
 * @param {string} username Demo username.
 * @param {string} password Demo password.
 * @returns {Promise<void>} Submitted login.
 */
async function login(page, username = "admin", password = "admin") {
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}

/** Click a responsive authenticated navigation link.
 * @param {object} page Browser page.
 * @param {object} testInfo Shared project metadata.
 * @param {string} label Navigation label.
 * @returns {Promise<void>} Navigation completed.
 */
async function nav(page, testInfo, label) {
  const mobile = testInfo.project.name === "mobile";
  if (mobile)
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("navigation", {
      name: mobile ? "Mobile navigation" : "Account navigation",
      exact: true,
    })
    .getByRole("link", { name: label, exact: true })
    .click();
}

/** Log out through the account menu then enter login through public navigation.
 * @param {object} page Browser page.
 * @param {string} displayName Active display name.
 * @returns {Promise<void>} Login page ready.
 */
async function switchAccount(page, displayName) {
  await page
    .getByRole("button", { name: `Account options for ${displayName}` })
    .click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Public navigation" })
    .getByRole("link", { name: "Login", exact: true })
    .click();
}

/** Create a role account through required fields.
 * @param {object} page Browser page.
 * @param {string} username Local username.
 * @param {string} displayName Account display name.
 * @param {string} role Admin or user storage role.
 * @returns {Promise<void>} Created account visible.
 */
async function createAccount(page, username, displayName, role) {
  await page.getByLabel("Display Name", { exact: true }).fill(displayName);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("admin-demo-only");
  await page.getByLabel("Role", { exact: true }).selectOption(role);
  await page.getByRole("button", { name: "Create User", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Account created.");
}

/** Select the currently visible desktop table or mobile cards.
 * @param {object} page Browser page.
 * @param {object} testInfo Shared project metadata.
 * @returns {object} Responsive account-list locator.
 */
function accountList(page, testInfo) {
  return testInfo.project.name === "mobile"
    ? page.getByLabel("Account cards", { exact: true })
    : page.getByRole("table", { name: "Accounts", exact: true });
}

/** Read the actual browser data without substituting application behavior.
 * @param {object} page Browser page.
 * @returns {Promise<object>} Persisted accounts, posts and current identity.
 */
async function stored(page) {
  return page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem("writespace_users") || "[]"),
    posts: JSON.parse(localStorage.getItem("writespace_posts") || "[]"),
    session: JSON.parse(localStorage.getItem("writespace_session") || "null"),
  }));
}

test("admin login, empty counts, quick write, recent edit and cancel/confirm deletion persist", async ({
  page,
}, testInfo) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await login(page);
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard", exact: true }),
  ).toBeVisible();
  for (const [label, value] of [
    ["Total Posts", "0"],
    ["Total Users", "1"],
    ["Total Admins", "1"],
    ["Total users", "1"],
  ]) {
    await expect(
      page.getByRole("region", { name: label, exact: true }),
    ).toContainText(value);
  }
  await expect(page.getByText(/Product clarification/)).toContainText(
    "duplicate product labels",
  );
  await expect(page.getByText(/No posts yet. Write a new post/)).toBeVisible();
  await page.getByRole("link", { name: "Write New Post", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Administrator's note");
  await page
    .getByLabel("Content", { exact: true })
    .fill("A real local admin post.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Administrator's note", exact: true }),
  ).toBeVisible();
  const created = (await stored(page)).posts[0];
  expect(created.authorId).toBe("admin");
  await nav(page, testInfo, "Dashboard");
  const recent = page.getByRole("region", {
    name: "Recent Posts",
    exact: true,
  });
  await recent
    .getByRole("link", { name: "Edit Administrator's note", exact: true })
    .click();
  await expect(page.getByLabel("Content", { exact: true })).toHaveValue(
    created.content,
  );
  await page
    .getByLabel("Title", { exact: true })
    .fill("Revised administrator note");
  await page
    .getByLabel("Content", { exact: true })
    .fill("Revised locally, not in a cloud.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await nav(page, testInfo, "Dashboard");
  await expect(
    recent.getByRole("link", {
      name: "Revised administrator note",
      exact: true,
    }),
  ).toBeVisible();
  const updated = (await stored(page)).posts[0];
  expect(updated).toEqual({
    ...created,
    title: "Revised administrator note",
    content: "Revised locally, not in a cloud.",
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await recent
    .getByRole("button", {
      name: "Delete Revised administrator note",
      exact: true,
    })
    .click();
  expect((await stored(page)).posts).toEqual([updated]);
  await expect(page.getByRole("status")).toHaveText("Post deletion cancelled.");
  page.once("dialog", (dialog) => dialog.accept());
  await recent
    .getByRole("button", {
      name: "Delete Revised administrator note",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("region", { name: "Total Posts", exact: true }),
  ).toContainText("0");
  expect((await stored(page)).posts).toEqual([]);
  await page.reload();
  await expect(page.getByText(/No posts yet. Write a new post/)).toBeVisible();
});

test("manage both roles, login created accounts, own posts and protect default/current while retaining deleted authors' posts", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await login(page);
  await page.getByRole("link", { name: "Manage Users", exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  const list = accountList(page, testInfo);
  const defaultDelete = list.getByRole("button", {
    name: "Delete admin",
    exact: true,
  });
  await expect(defaultDelete).toBeDisabled();
  await expect(defaultDelete).toHaveAttribute(
    "title",
    "Default admin cannot be deleted",
  );
  await page.getByRole("button", { name: "Create User", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(4);
  await createAccount(page, "created-writer", "Created Writer", "user");
  await createAccount(page, "created-editor", "Created Editor", "admin");
  await expect(list.getByText("Created Writer", { exact: true })).toBeVisible();
  await expect(list.getByText("Created Editor", { exact: true })).toBeVisible();
  const createdAccounts = (await stored(page)).users;
  expect(createdAccounts.map((user) => user.role)).toEqual(["user", "admin"]);
  for (const account of createdAccounts) {
    expect(account.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  }
  await page
    .getByLabel("Display Name", { exact: true })
    .fill("Duplicate Writer");
  await page.getByLabel("Username", { exact: true }).fill("CREATED-WRITER");
  await page.getByLabel("Password", { exact: true }).fill("demo-only");
  await page.getByLabel("Role", { exact: true }).selectOption("user");
  await page.getByRole("button", { name: "Create User", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "That username is already taken.",
  );
  expect((await stored(page)).users).toEqual(createdAccounts);
  await page.reload();
  await expect(list.getByText("Created Writer", { exact: true })).toBeVisible();
  await switchAccount(page, "Admin");
  await login(page, "created-writer", "admin-demo-only");
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Dashboard", exact: true }),
  ).toHaveCount(0);
  await nav(page, testInfo, "Write");
  await page
    .getByLabel("Title", { exact: true })
    .fill("Created writer owns this");
  await page
    .getByLabel("Content", { exact: true })
    .fill("Keep this when my account is deleted.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Edit", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toBeVisible();
  const authored = (await stored(page)).posts[0];
  expect(authored.authorId).toBe(createdAccounts[0].id);
  expect(authored.authorName).toBe("Created Writer");
  await switchAccount(page, "Created Writer");
  await login(page, "created-editor", "admin-demo-only");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Manage Users", exact: true }).click();
  await expect(
    list.getByRole("button", { name: "Delete created-editor", exact: true }),
  ).toBeDisabled();
  await expect(defaultDelete).toBeDisabled();
  page.once("dialog", (dialog) => dialog.dismiss());
  await list
    .getByRole("button", { name: "Delete created-writer", exact: true })
    .click();
  expect((await stored(page)).users).toEqual(createdAccounts);
  await expect(list.getByText("Created Writer", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await list
    .getByRole("button", { name: "Delete created-writer", exact: true })
    .click();
  await expect(list.getByText("Created Writer", { exact: true })).toHaveCount(
    0,
  );
  expect((await stored(page)).users).toEqual([createdAccounts[1]]);
  expect((await stored(page)).posts).toEqual([authored]);
  await nav(page, testInfo, "All Blogs");
  await page.getByRole("link", { name: authored.title, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: authored.title, exact: true }),
  ).toBeVisible();
  await expect(page.locator("main article")).toContainText(authored.content);
  await expect(page.locator("main article")).toContainText("Created Writer");
  await nav(page, testInfo, "Dashboard");
  await expect(
    page.getByRole("region", { name: "Total Users", exact: true }),
  ).toContainText("2");
  await expect(
    page.getByRole("region", { name: "Total users", exact: true }),
  ).toContainText("2");
  await page.reload();
  expect((await stored(page)).posts).toEqual([authored]);
  await page.getByRole("link", { name: "Write New Post", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Created editor owns this");
  await page
    .getByLabel("Content", { exact: true })
    .fill("Written by the created administrator.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Created editor owns this",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await stored(page)).posts.find(
      (post) => post.title === "Created editor owns this",
    ),
  ).toMatchObject({
    authorId: createdAccounts[1].id,
    authorName: "Created Editor",
  });
});

test("dashboard selects latest five from shuffled persisted posts with inline management links", async ({
  page,
}) => {
  const records = Array.from({ length: 7 }, (_, index) => ({
    id: `${index + 1}2345678-1234-4234-8234-123456789abc`,
    title: `Local note ${index + 1}`,
    content: "Actual stored words.",
    authorId: "admin",
    authorName: "Admin",
    createdAt: `2026-03-0${index + 1}T12:00:00.000Z`,
  }));
  const shuffled = [
    records[2],
    records[6],
    records[0],
    records[4],
    records[1],
    records[5],
    records[3],
  ];
  await page.addInitScript((posts) => {
    if (!sessionStorage.getItem("admin-posts-seeded")) {
      localStorage.setItem("writespace_posts", JSON.stringify(posts));
      sessionStorage.setItem("admin-posts-seeded", "true");
    }
  }, shuffled);
  await page.goto("/login");
  await login(page);
  const recent = page.getByRole("region", {
    name: "Recent Posts",
    exact: true,
  });
  await expect(recent.getByRole("link", { name: /^Local note / })).toHaveText([
    "Local note 7",
    "Local note 6",
    "Local note 5",
    "Local note 4",
    "Local note 3",
  ]);
  await expect(recent.getByRole("link", { name: /^Edit / })).toHaveCount(5);
  await expect(recent.getByRole("button", { name: /^Delete / })).toHaveCount(5);
  expect((await stored(page)).posts).toEqual(shuffled);
  await page.reload();
  await expect(recent.getByRole("link", { name: /^Local note / })).toHaveText([
    "Local note 7",
    "Local note 6",
    "Local note 5",
    "Local note 4",
    "Local note 3",
  ]);
});

for (const route of ["/admin", "/users"]) {
  test(`guest entry ${route} requires login`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Welcome back", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Manage Users", exact: true }),
    ).toHaveCount(0);
    expect((await stored(page)).users).toEqual([]);
  });
}
