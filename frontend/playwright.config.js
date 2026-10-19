/** Exercise the same identity journeys on desktop and mobile, one worker at a time. */
import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

const env = { ...loadEnv("test", process.cwd(), ""), ...process.env };
const host = env.TEST_HOST || "127.0.0.1";
const port = env.TEST_PORT || "5174";
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --mode test",
    env: { DEV_HOST: host, DEV_PORT: port },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
