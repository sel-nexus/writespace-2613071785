/** Exercise public discovery through real browser storage and UI on both configured viewports. */
import { test, expect } from "./fixtures.js";

const account = {
  id: "12345678-1234-4234-8234-123456789abc",
  displayName: "Mira Writer",
  username: "mira",
  password: "demo-only",
  role: "user",
  createdAt: "2026-01-01T12:00:00.000Z",
};
const posts = [
  {
    id: "22345678-1234-4234-8234-123456789abc",
    title: "The oldest local note",
    content: "This oldest entry must not be in the latest three.",
    createdAt: "2026-01-01T12:00:00.000Z",
    authorId: account.id,
    authorName: account.displayName,
  },
  {
    id: "32345678-1234-4234-8234-123456789abc",
    title: "A new thought from this browser",
    content: "The newest paragraph is stored locally. ".repeat(5),
    createdAt: "2026-04-01T12:00:00.000Z",
    authorId: account.id,
    authorName: account.displayName,
  },
  {
    id: "42345678-1234-4234-8234-123456789abc",
    title: "Third in the reading pile",
    content: "A third local note, without a cloud service.",
    createdAt: "2026-02-01T12:00:00.000Z",
    authorId: "admin",
    authorName: "Admin",
  },
  {
    id: "52345678-1234-4234-8234-123456789abc",
    title: "Second in the reading pile",
    content:
      "<script>window.discoveryInjected=true</script> remains plain text.",
    createdAt: "2026-03-04T12:00:00.000Z",
    authorId: account.id,
    authorName: account.displayName,
  },
];

/** Seed valid local demo data before initial entry, without mocking application behavior.
 * @param {object} page Playwright page with shared console capture.
 * @returns {Promise<void>} Installed one-time storage initializer.
 */
async function seedPosts(page) {
  await page.addInitScript(
    ({ records, user }) => {
      if (!sessionStorage.getItem("discovery-seeded")) {
        localStorage.setItem("writespace_posts", JSON.stringify(records));
        localStorage.setItem("writespace_users", JSON.stringify([user]));
        sessionStorage.setItem("discovery-seeded", "true");
      }
    },
    { records: posts, user: account },
  );
}

/** Submit the existing local identity form using real fields.
 * @param {object} page Playwright page.
 * @param {string} username Demo username.
 * @param {string} password Non-sensitive demo password.
 * @returns {Promise<void>} Submitted login.
 */
async function login(page, username, password) {
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}

test("empty public home exposes exact copy and both guest hero actions", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "WriteSpace" }),
  ).toBeVisible();
  await expect(
    page.getByText("Your thoughts. Your space. Beautifully simple."),
  ).toBeVisible();
  await expect(page.getByText("No posts yet — check back soon!")).toBeVisible();
  await expect(
    page.getByText(/Passwords are stored in plaintext/),
  ).toBeVisible();
  for (const name of ["Write Freely", "Private & Local", "Instant & Fast"]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  const footer = page.getByRole("contentinfo");
  await expect(footer).toContainText(
    `© ${new Date().getFullYear()} WriteSpace`,
  );
  await page.screenshot({
    path: testInfo.outputPath("discovery-empty.png"),
    fullPage: true,
  });
  await testInfo.attach("discovery-accessibility", {
    body: JSON.stringify(await page.accessibility.snapshot()),
    contentType: "application/json",
  });
  await testInfo.attach("discovery-html", {
    body: await page.content(),
    contentType: "text/html",
  });
  await testInfo.attach("discovery-styles", {
    body: JSON.stringify(
      await page.locator("main").evaluate((main) => ({
        display: getComputedStyle(main).display,
        heroBackground: getComputedStyle(main.firstElementChild)
          .backgroundImage,
        viewport: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      })),
    ),
    contentType: "application/json",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Start Reading", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
  await page
    .getByRole("link", { name: "Get Started Free", exact: true })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  expect(
    await page.evaluate(() => localStorage.getItem("writespace_posts")),
  ).toBeNull();
});

/** E-17 limitation: configured Chromium contexts expose no standard Playwright
 * permission for denying first-party localStorage. No managed browser policy is
 * configured, and browser-policy probing is not run in this scoped edit-only task.
 * Native denial remains unverified; existing unit storage spies cover the error
 * boundary only, not browser denial. Do not substitute app or Storage mocks here.
 */
test("E-17 malformed native posts storage stays empty through public discovery and admin reading", async ({
  page,
}) => {
  const raw = '{"posts":';
  await page.addInitScript((malformed) => {
    localStorage.setItem("writespace_posts", malformed);
  }, raw);
  await page.goto("/");
  const latest = page.getByRole("region", { name: "Latest from the Blog" });
  await expect(
    latest.getByText("No posts yet — check back soon!", { exact: true }),
  ).toBeVisible();
  await expect(latest.getByRole("article")).toHaveCount(0);
  await expect(
    page
      .getByRole("complementary", { name: "Inside your writing space" })
      .getByRole("article"),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("writespace_posts")),
  ).toBe(raw);

  await page.getByRole("link", { name: "Start Reading", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await login(page, "admin", "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard", exact: true }),
  ).toBeVisible();
  const toggle = page.getByRole("button", { name: "Toggle navigation" });
  const mobile = await toggle.isVisible();
  if (mobile) await toggle.click();
  const navigation = page.getByRole("navigation", {
    name: mobile ? "Mobile navigation" : "Account navigation",
    exact: true,
  });
  await navigation
    .getByRole("link", { name: "All Blogs", exact: true })
    .click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByRole("heading", { name: "All Blogs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No blogs yet. Be the first to write one!", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "All posts" })).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("writespace_posts")),
  ).toBe(raw);
});

test("latest three use real data, persist and redirect a guest preview to login", async ({
  page,
}, testInfo) => {
  await seedPosts(page);
  await page.goto("/");
  const latest = page.getByRole("region", { name: "Latest from the Blog" });
  await expect(latest.getByRole("heading", { level: 3 })).toHaveText([
    posts[1].title,
    posts[3].title,
    posts[2].title,
  ]);
  await expect(latest.getByText("Mar 04, 2026")).toBeVisible();
  await expect(latest.getByText("Apr 01, 2026")).toBeVisible();
  await expect(
    latest.getByText(posts[1].content.slice(0, 120), { exact: true }),
  ).toBeVisible();
  await expect(
    latest.getByText(posts[3].content, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(posts[0].title, { exact: true })).toHaveCount(0);
  await expect(latest.getByRole("link", { name: /^Edit / })).toHaveCount(0);
  await expect(latest.getByRole("img", { name: "Admin avatar" })).toBeVisible();
  expect(await page.evaluate(() => window.discoveryInjected)).toBeUndefined();
  await page.reload();
  await expect(latest.getByRole("heading", { level: 3 })).toHaveText([
    posts[1].title,
    posts[3].title,
    posts[2].title,
  ]);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("writespace_posts")),
    ),
  ).toEqual(posts);
  await page.screenshot({
    path: testInfo.outputPath("discovery-populated.png"),
    fullPage: true,
  });
  await latest.getByRole("link", { name: posts[1].title, exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await login(page, "mira", "incorrect");
  await expect(page.getByRole("alert")).toHaveText(
    "Invalid username or password.",
  );
  await login(page, "mira", "demo-only");
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(
    page.getByRole("heading", { name: "All Blogs", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("navigation", { name: "Public navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Start Reading", exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
});

test("public navbar and footer guest links navigate to their real destinations", async ({
  page,
}) => {
  await page.goto("/");
  const publicNav = page.getByRole("navigation", { name: "Public navigation" });
  await publicNav.getByRole("link", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
  await publicNav
    .getByRole("link", { name: "Get Started", exact: true })
    .click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  await footer.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await footer.getByRole("link", { name: "All Blogs", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
  await footer.getByRole("link", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
  await footer.getByRole("link", { name: "Register", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
});

for (const role of ["user", "admin"]) {
  test(`signed ${role} public home uses role-aware account action and authenticated reading`, async ({
    page,
  }) => {
    await seedPosts(page);
    await page.goto("/login");
    await login(
      page,
      role === "admin" ? "admin" : "mira",
      role === "admin" ? "admin" : "demo-only",
    );
    const roleHome = role === "admin" ? /\/admin$/ : /\/blogs$/;
    await expect(page).toHaveURL(roleHome);
    await expect(
      page.getByRole("heading", {
        name: role === "admin" ? "Admin Dashboard" : "All Blogs",
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    const publicNav = page.getByRole("navigation", {
      name: "Public navigation",
    });
    await expect(
      publicNav.getByRole("img", {
        name: role === "admin" ? "Admin avatar" : "User avatar",
      }),
    ).toBeVisible();
    await expect(
      publicNav.getByRole("link", { name: "Login", exact: true }),
    ).toHaveCount(0);
    const latest = page.getByRole("region", { name: "Latest from the Blog" });
    await expect(latest.getByRole("link", { name: /^Edit / })).toHaveCount(
      role === "admin" ? 3 : 2,
    );
    await latest
      .getByRole("link", { name: posts[1].title, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/blog/${posts[1].id}$`));
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: posts[1].title,
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.locator("main article > p.whitespace-pre-wrap").textContent(),
    ).toBe(posts[1].content);
    await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
    await publicNav
      .getByRole("link", { name: "Go to Dashboard", exact: true })
      .click();
    await expect(page).toHaveURL(roleHome);
    await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
    await page
      .getByRole("link", { name: "Start Reading", exact: true })
      .click();
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(
      page.getByRole("heading", { name: "All Blogs", exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "WriteSpace", exact: true }).click();
    await page
      .getByRole("link", { name: "Get Started Free", exact: true })
      .click();
    await expect(page).toHaveURL(roleHome);
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("writespace_session")).role,
      ),
    ).toBe(role);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("writespace_posts")),
      ),
    ).toEqual(posts);
  });
}
