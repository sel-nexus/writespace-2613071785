/** Exercise available identity routes through real UI on desktop and mobile; run by the parent. */
import { test, expect } from "./fixtures.js";

/** Open the account disclosure and persist logout through its UI action.
 * @param {object} page Playwright page.
 * @param {string} name Signed-in display name.
 * @returns {Promise<void>} Completed logout.
 */
async function logout(page, name) {
  await page
    .getByRole("button", { name: `Account options for ${name}` })
    .click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "WriteSpace" }),
  ).toBeVisible();
}

/** Type and submit a local login using labeled fields.
 * @param {object} page Playwright page.
 * @param {string} username Demo username.
 * @param {string} password Demo password.
 * @returns {Promise<void>} Submitted login.
 */
async function login(page, username, password) {
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}

test("register, persist, navigate available account route, logout and login again", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByText(/Passwords are stored in plaintext/),
  ).toBeVisible();
  await page.getByRole("link", { name: "Get Started", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByLabel("Display Name", { exact: true }).fill("Mira Writer");
  await page.getByLabel("Username", { exact: true }).fill("mira");
  await page.getByLabel("Password", { exact: true }).fill("made-up-demo");
  await page
    .getByLabel("Confirm Password", { exact: true })
    .fill("made-up-demo");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByRole("heading", { name: "All Blogs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "User avatar" }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("No blogs yet. Be the first to write one!"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "All Blogs", exact: true }),
  ).toBeVisible();
  // Exercise the real Write -> All Blogs links and mobile menu closure.
  await page
    .locator("main")
    .getByRole("link", { name: "Write", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Write a Blog" }),
  ).toBeVisible();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link", { name: "All Blogs" })
      .click();
  } else {
    await page
      .getByRole("navigation", { name: "Account navigation", exact: true })
      .getByRole("link", { name: "All Blogs" })
      .click();
  }
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByRole("button", { name: "Toggle navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  await logout(page, "Mira Writer");
  await page.getByRole("link", { name: "Login", exact: true }).first().click();
  await login(page, "mira", "made-up-demo");
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByRole("heading", { name: "All Blogs", exact: true }),
  ).toBeVisible();
  const persisted = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem("writespace_users")),
    session: JSON.parse(localStorage.getItem("writespace_session")),
  }));
  expect(persisted.users).toHaveLength(1);
  expect(persisted.users[0]).toMatchObject({
    username: "mira",
    password: "made-up-demo",
    role: "user",
  });
  expect(persisted.session.userId).toBe(persisted.users[0].id);
  await page.screenshot({
    path: testInfo.outputPath("identity-account.png"),
    fullPage: true,
  });
  await testInfo.attach("identity-accessibility", {
    body: JSON.stringify(await page.accessibility.snapshot()),
    contentType: "application/json",
  });
  await testInfo.attach("identity-html", {
    body: await page.content(),
    contentType: "text/html",
  });
  await testInfo.attach("identity-style", {
    body: JSON.stringify(
      await page.locator("main").evaluate((main) => ({
        display: getComputedStyle(main).display,
        color: getComputedStyle(main).color,
        background: getComputedStyle(
          document.body.firstElementChild.firstElementChild,
        ).backgroundColor,
      })),
    ),
    contentType: "application/json",
  });
});

test("built-in admin enters guarded role route, persists and logs out", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/Demo administrator:/)).toHaveText(
    /username admin \/ password admin/,
  );
  await login(page, "admin", "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Welcome, Admin" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Admin avatar" }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome, Admin" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toHaveCount(0);
  await logout(page, "Admin");
  expect(
    await page.evaluate(() => localStorage.getItem("writespace_session")),
  ).toBeNull();
});

test("required login fields and invalid credentials show errors before a valid login", async ({
  page,
}) => {
  await page.goto("/blogs");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByText("Username is required.")).toBeVisible();
  await expect(page.getByText("Password is required.")).toBeVisible();
  await login(page, "admin", "incorrect");
  await expect(page.getByRole("alert")).toHaveText(
    "Invalid username or password.",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("writespace_session")),
  ).toBeNull();
  await login(page, "admin", "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await logout(page, "Admin");
});

test("registration requires fields, reserves admin, matches passwords and rejects duplicates", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(4);
  await page.getByLabel("Display Name", { exact: true }).fill("Local Writer");
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("demo-only");
  await page.getByLabel("Confirm Password", { exact: true }).fill("mismatch");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByText("That username is already taken.")).toBeVisible();
  await expect(page.getByText("Passwords must match.")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("writespace_users")),
  ).toBeNull();
  await page.getByLabel("Username", { exact: true }).fill("local-writer");
  await page.getByLabel("Confirm Password", { exact: true }).fill("demo-only");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await logout(page, "Local Writer");
  await page.getByRole("link", { name: "Get Started", exact: true }).click();
  await page.getByLabel("Display Name", { exact: true }).fill("Duplicate");
  await page.getByLabel("Username", { exact: true }).fill("LOCAL-WRITER");
  await page.getByLabel("Password", { exact: true }).fill("demo-only");
  await page.getByLabel("Confirm Password", { exact: true }).fill("demo-only");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "That username is already taken.",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("writespace_users")).length,
    ),
  ).toBe(1);
  await page.getByRole("link", { name: "Login", exact: true }).last().click();
  await expect(page).toHaveURL(/\/login$/);
});
