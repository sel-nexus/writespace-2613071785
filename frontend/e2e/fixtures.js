/** Capture runtime failures before any navigation and fail every journey on errors. */
import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    const consoleHandler = (message) => {
      if (message.type() === "error") errors.push(message.text());
    };
    const errorHandler = (error) => errors.push(error.message);
    page.on("console", consoleHandler);
    page.on("pageerror", errorHandler);
    try {
      await use(page);
    } finally {
      page.off("console", consoleHandler);
      page.off("pageerror", errorHandler);
      expect(errors, "Browser console and uncaught errors").toEqual([]);
    }
  },
});

export { expect };
