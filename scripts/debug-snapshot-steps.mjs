import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "04942c68cc80d9cfd52870a58726e4909bdbe9427ceafdc0540a3f703cce76c6";

const browserPath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const playwrightPath = "C:\\Users\\almer\\AppData\\Roaming\\npm\\node_modules\\openclaw\\node_modules\\playwright-core";

const { chromium } = require(playwrightPath);

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: browserPath,
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const page = await context.newPage();

  // Step 0: UI login exactly like run-e2e-tests.mjs
  console.log("Navigating to /login...");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 15000 });
  const passwordInput = await page.waitForSelector("input[type='password']", { timeout: 6000 }).catch(() => null);
  if (passwordInput) {
    await page.locator("input[type='text'], input#username").first().fill("operator@company.com");
    await passwordInput.fill("admin123");
    await page.locator("button[type='submit']").click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    console.log("Logged in and redirected to dashboard");
  }

  // Step 1: goto /email-templates
  console.log("Navigating to /email-templates...");
  await page.goto(`${BASE_URL}/email-templates`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForSelector("button:has-text('New Template')", { timeout: 10000 });
  console.log("Step 1 passed: New Template button found");

  // Step 2: Look for button with text "New Template"
  console.log("Step 2: Checking newBtn...");
  const newBtn = await page.waitForSelector("button:has-text('New Template')", { timeout: 5000 }).catch((e) => {
    console.error("waitForSelector error:", e.message);
    return null;
  });
  console.log("newBtn result:", !!newBtn);
  if (newBtn) {
    console.log("Clicking newBtn...");
    await newBtn.click();
    const importBtn = await page.waitForSelector("button:has-text('Import Email')", { timeout: 5000 }).catch((e) => {
      console.error("Import Email error:", e.message);
      return null;
    });
    console.log("Import Email button result:", !!importBtn);
  }

  await browser.close();
}

main().catch(console.error);
