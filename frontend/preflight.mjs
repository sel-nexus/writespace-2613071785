/** Capture representative built-app states for source-guided human review. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.PREFLIGHT_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch();
await mkdir('preflight', { recursive: true });
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 393, height: 851 }]]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    /** Save text-based browser evidence and an image for the human reviewer. */
    async function capture(state) {
      const prefix = `preflight/${name}-${state}`;
      await page.screenshot({ path: `${prefix}.png`, fullPage: true });
      await writeFile(`${prefix}.html`, await page.content());
      await writeFile(`${prefix}.json`, JSON.stringify({ accessibility: await page.accessibility.snapshot(), styles: await page.evaluate(() => ({ font: getComputedStyle(document.body).fontFamily, heading: getComputedStyle(document.querySelector('h1')).fontFamily, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, mainDisplay: getComputedStyle(document.querySelector('main')).display })) }, null, 2));
    }
    await page.goto(base);
    await page.getByRole('heading', { name: 'WriteSpace', exact: true }).waitFor();
    await capture('landing-empty');
    await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await capture('login-error');
    await page.getByLabel('Username', { exact: true }).fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('admin');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.getByRole('heading', { name: 'Admin Dashboard', exact: true }).waitFor();
    await capture('dashboard-empty');
    await page.getByRole('link', { name: 'Write New Post', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('A page for your words');
    await page.getByLabel('Content', { exact: true }).fill('This is a real browser-local preflight post.\nPlain text keeps the focus on writing.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('heading', { name: 'A page for your words', exact: true }).waitFor();
    await capture('reader-populated');
    if (name === 'mobile') {
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
      await capture('navigation-open');
    }
    if (errors.length) throw new Error(JSON.stringify(errors));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log('Preflight captured desktop/mobile empty, error, populated and mobile menu states without browser errors.');
