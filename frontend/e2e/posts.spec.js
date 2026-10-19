/** Real UI journeys; shared fixtures capture browser errors before initial navigation. Parent executes. */
import { test, expect } from "./fixtures.js";

const originalContent =
  '  First line\n\n  <img src=x onerror="window.postsInjected=true">\nLast line\t  ';

/** Register through visible controls, never injecting a session.
 * @param {object} page Browser page with shared error fixture.
 * @param {string} name Display name.
 * @param {string} username Local demo username.
 * @returns {Promise<void>} Registered and signed in.
 */
async function register(page, name, username) {
  await page.getByRole("link", { name: "Get Started", exact: true }).click();
  await page.getByLabel("Display Name", { exact: true }).fill(name);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill("posts-demo");
  await page.getByLabel("Confirm Password", { exact: true }).fill("posts-demo");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All Blogs", exact: true }),
  ).toBeVisible();
}

/** Navigate the responsive authenticated menu on both configured projects.
 * @param {object} page Playwright page.
 * @param {object} testInfo Project information.
 * @param {string} label Link name.
 * @returns {Promise<void>} UI navigation complete.
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

/** Log out through account disclosure and return to the public page.
 * @param {object} page Playwright page.
 * @param {string} name Current display name.
 * @returns {Promise<void>} Logout completed.
 */
async function logout(page, name) {
  await page
    .getByRole("button", { name: `Account options for ${name}` })
    .click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "WriteSpace" }),
  ).toBeVisible();
}

/** Read persisted post state without replacing app behavior.
 * @param {object} page Playwright page.
 * @returns {Promise<Array>} Actual persisted records.
 */
async function storedPosts(page) {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("writespace_posts") || "[]"),
  );
}

/** Verify that the reader has not normalized the writer's whitespace or interpreted HTML.
 * @param {object} page Playwright page.
 * @param {string} content Expected full content.
 * @returns {Promise<void>} Exact text assertion.
 */
async function fullText(page, content) {
  const body = page.locator("main article > p.whitespace-pre-wrap");
  await expect(body).toBeVisible();
  expect(await body.textContent()).toBe(content);
  await expect(page.locator("main img, main script")).toHaveCount(0);
  expect(await page.evaluate(() => window.postsInjected)).toBeUndefined();
}

test("register, validate, create, read, reload, cancel edits, save edits and confirm deletion", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await register(page, "First Writer", "first");
  await expect(
    page.getByText("No blogs yet. Be the first to write one!"),
  ).toBeVisible();
  await page
    .locator("main")
    .getByRole("link", { name: "Write", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("0 characters");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Title is required.")).toBeVisible();
  await expect(page.getByText("Content is required.")).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("A local story");
  await page.getByLabel("Content", { exact: true }).fill(" \n ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Content is required.")).toBeVisible();
  expect(await storedPosts(page)).toEqual([]);
  await page.getByLabel("Content", { exact: true }).fill(originalContent);
  await expect(page.getByRole("status")).toHaveText(
    `${originalContent.length} characters`,
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "A local story", exact: true }),
  ).toBeVisible();
  await fullText(page, originalContent);
  const [created] = await storedPosts(page);
  expect(created.id).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
  const session = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("writespace_session")),
  );
  expect(created).toMatchObject({
    title: "A local story",
    content: originalContent,
    authorId: session.userId,
    authorName: "First Writer",
  });
  await page.reload();
  await fullText(page, originalContent);
  expect(await storedPosts(page)).toEqual([created]);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    created.title,
  );
  await expect(page.getByLabel("Content", { exact: true })).toHaveValue(
    originalContent,
  );
  await page.getByLabel("Title", { exact: true }).fill("Unsaved title");
  await page.getByLabel("Content", { exact: true }).fill("Unsaved words");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: created.title, exact: true }),
  ).toBeVisible();
  expect(await storedPosts(page)).toEqual([created]);
  await page
    .getByRole("link", { name: "Back to All Posts", exact: true })
    .click();
  await page
    .getByRole("link", { name: `Edit ${created.title}`, exact: true })
    .click();
  const revisedContent = `${originalContent}\n  Revision preserved  `;
  await page.getByLabel("Title", { exact: true }).fill("A revised story");
  await page.getByLabel("Content", { exact: true }).fill(revisedContent);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A revised story", exact: true }),
  ).toBeVisible();
  await fullText(page, revisedContent);
  const revised = {
    ...created,
    title: "A revised story",
    content: revisedContent,
  };
  expect(await storedPosts(page)).toEqual([revised]);
  await page.reload();
  await fullText(page, revisedContent);
  await nav(page, testInfo, "Write");
  await page.getByLabel("Title", { exact: true }).fill("Never saved");
  await page.getByLabel("Content", { exact: true }).fill("Cancelled creation");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  expect(await storedPosts(page)).toEqual([revised]);
  const grid = page.getByRole("region", { name: "All posts", exact: true });
  const columns = await grid.evaluate(
    (element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").length,
  );
  expect(columns).toBe(testInfo.project.name === "mobile" ? 1 : 3);
  await page.getByRole("link", { name: revised.title, exact: true }).click();
  await page.screenshot({
    path: testInfo.outputPath("posts-reader.png"),
    fullPage: true,
  });
  await testInfo.attach("posts-reader-html", {
    body: await page.content(),
    contentType: "text/html",
  });
  await testInfo.attach("posts-reader-accessibility", {
    body: JSON.stringify(await page.accessibility.snapshot()),
    contentType: "application/json",
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: revised.title, exact: true }),
  ).toBeVisible();
  expect(await storedPosts(page)).toEqual([revised]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All Blogs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No blogs yet. Be the first to write one!"),
  ).toBeVisible();
  expect(await storedPosts(page)).toEqual([]);
  await page.reload();
  await expect(
    page.getByText("No blogs yet. Be the first to write one!"),
  ).toBeVisible();
});

test("second user can read but cannot edit/delete another writer; admin can maintain and delete it", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await register(page, "Owner", "owner");
  await nav(page, testInfo, "Write");
  await page.getByLabel("Title", { exact: true }).fill("Owner's note");
  await page.getByLabel("Content", { exact: true }).fill(originalContent);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Owner's note", exact: true }),
  ).toBeVisible();
  const [created] = await storedPosts(page);
  await logout(page, "Owner");
  await register(page, "Other Reader", "other");
  await expect(
    page.getByRole("link", { name: `Edit ${created.title}`, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: created.title, exact: true }).click();
  await fullText(page, originalContent);
  await expect(
    page.locator("main").getByRole("link", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("main").getByRole("link")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Back to All Posts", exact: true })
    .click();
  expect(await storedPosts(page)).toEqual([created]);
  await logout(page, "Other Reader");
  await page.getByRole("link", { name: "Login", exact: true }).first().click();
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  // The final dashboard is the administrator's role home.
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" }),
  ).toBeVisible();
  await nav(page, testInfo, "All Blogs");
  await page
    .getByRole("link", { name: `Edit ${created.title}`, exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Admin revision");
  await page
    .getByLabel("Content", { exact: true })
    .fill("  Administrator revised\n\n  preserved  ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Admin revision", exact: true }),
  ).toBeVisible();
  expect(await storedPosts(page)).toEqual([
    {
      ...created,
      title: "Admin revision",
      content: "  Administrator revised\n\n  preserved  ",
    },
  ]);
  await expect(
    page.locator("main").getByText("Owner", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Admin revision", exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "All Blogs", exact: true }),
  ).toBeVisible();
  expect(await storedPosts(page)).toEqual([]);
});

for (const route of [
  "/write",
  "/edit/22345678-1234-4234-8234-123456789abc",
  "/blog/missing",
]) {
  test(`guest direct entry ${route} requires login`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByLabel("Content", { exact: true })).toHaveCount(0);
    expect(await storedPosts(page)).toEqual([]);
  });
}
