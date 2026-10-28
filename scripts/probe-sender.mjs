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

const possibleBrowserPaths = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Users\\almer\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe",
];
const browserPath = possibleBrowserPaths.find((p) => fs.existsSync(p));
const playwrightCorePaths = [
  "C:\\Users\\almer\\AppData\\Roaming\\npm\\node_modules\\openclaw\\node_modules\\playwright-core",
  path.join(ROOT_DIR, "node_modules", "playwright-core"),
];
const playwrightPath = playwrightCorePaths.find((p) => fs.existsSync(p));
const { chromium } = require(playwrightPath);

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `1.${expiry}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const token = `${payload}.${sig}`;
  await context.addCookies([
    { name: "rts_session", value: token, domain: "127.0.0.1", path: "/" },
    { name: "rts_session", value: token, domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/email-templates`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForSelector("button:has-text('New Template')", { timeout: 10000 });
  await page.locator("button:has-text('New Template')").click();
  await page.waitForSelector("h2:has-text('New Template')", { timeout: 5000 });

  await page.locator("#template-envelope-sender").fill("Google Security Team <no-reply@google.com>");
  await page.waitForTimeout(300);

  const modal = page.locator(".max-w-\\[1500px\\]");
  const senderSpans = await modal.locator("div.pt-1 span").allTextContents();
  console.log("Modal Sender Row Spans:", senderSpans);

  await browser.close();
}

main().catch(console.error);
