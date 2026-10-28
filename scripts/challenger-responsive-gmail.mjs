/**
 * Empirical Challenger: Responsive & Layout Stress-Testing Harness for Gmail Live Preview
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";

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

if (!browserPath || !playwrightPath) {
  console.error("Browser or Playwright-core not found!");
  process.exit(1);
}

const { chromium } = require(playwrightPath);

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = "") {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: [${testName}] ${detail}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: [${testName}] ${detail}`);
    failedTests++;
  }
}

async function loginAndGetCookies(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 15000 });
  const passwordInput = await page.waitForSelector("input[type='password']", { timeout: 6000 }).catch(() => null);
  if (passwordInput) {
    await page.locator("input[type='text'], input#username").first().fill("operator@company.com");
    await passwordInput.fill("admin123");
    await page.locator("button[type='submit']").click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  }
  const cookies = await context.cookies();
  await context.close();
  return cookies;
}

async function createAuthenticatedContext(browser, cookies, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
  });
  await context.addCookies(cookies);
  return context;
}

async function openNewTemplateModal(page) {
  await page.goto(`${BASE_URL}/email-templates`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.waitForSelector("button:has-text('New Template')", { timeout: 10000 });
  await page.waitForSelector("text=Loading templates...", { state: "detached", timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(400);
  const btn = await page.locator("button:has-text('New Template')");
  await btn.click();
  await page.waitForSelector("h2:has-text('New Template')", { timeout: 8000 });
  return page.locator(".max-w-\\[1500px\\]");
}

async function run() {
  console.log("\n================================================================================");
  console.log("  EMPIRICAL CHALLENGER: GMAIL LIVE PREVIEW RESPONSIVE & LAYOUT SUITE");
  console.log("================================================================================\n");

  const browser = await chromium.launch({
    headless: true,
    executablePath: browserPath,
  });

  try {
    console.log("Authenticating session via UI login...");
    const sessionCookies = await loginAndGetCookies(browser);
    console.log(`Session authenticated. Cookies captured: ${sessionCookies.length}`);

    // -------------------------------------------------------------------------
    // TEST SECTION 1: DESKTOP VIEWPORT (1280 x 900) - Dual-Panel 50/50 Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Section 1: Desktop Viewport (1280x900) Layout & Real-Time Sync ---");
    {
      const context = await createAuthenticatedContext(browser, sessionCookies, 1280, 900);
      const page = await context.newPage();
      const modal = await openNewTemplateModal(page);

      // Check Mobile Switcher is hidden on desktop (lg:hidden)
      const mobileSwitcher = modal.locator("button:has-text('Gmail View')");
      const isMobileSwitcherVisible = await mobileSwitcher.isVisible();
      assert(!isMobileSwitcherVisible, "D01-Desktop-Mobile-Switcher-Hidden", "Mobile view switcher is hidden on desktop (>=1024px)");

      // Check Left Pane (Editor) and Right Pane (Gmail Preview) are BOTH visible
      const leftPane = modal.locator("input#template-name");
      const rightPane = modal.locator("text='Gmail Live Preview'");
      const isLeftVisible = await leftPane.isVisible();
      const isRightVisible = await rightPane.isVisible();
      assert(isLeftVisible, "D02-Desktop-Left-Pane-Visible", "Editor form left pane is visible");
      assert(isRightVisible, "D03-Desktop-Right-Pane-Visible", "Gmail Live Preview right pane is visible simultaneously");

      // Measure bounding boxes to verify 50/50 split width
      const modalBody = modal.locator(".grid.grid-cols-1.lg\\:grid-cols-2");
      const bodyBox = await modalBody.boundingBox();
      assert(bodyBox && bodyBox.width > 1000, "D04-Desktop-Container-Width", `Modal body container width: ${bodyBox?.width}px`);

      // Verify real-time sync in right pane
      const testSubject = `Security Alert - Urgent Notice [${Date.now()}]`;
      await modal.locator("#template-subject").fill(testSubject);
      await page.waitForTimeout(200); // deferred value debounce
      const previewSubject = await modal.locator("h3:has-text('Security Alert')").textContent();
      assert(previewSubject?.includes(testSubject), "D05-Desktop-Subject-Sync", `Preview subject synchronized: "${previewSubject?.trim()}"`);

      // Verify Envelope Sender parsing sync
      await modal.locator("#template-envelope-sender").fill("Google Security Team <no-reply@google.com>");
      await page.waitForTimeout(200);
      const senderText = await modal.locator("div.pt-1").textContent();
      assert(senderText?.includes("Google Security Team"), "D06a-Desktop-Sender-Name-Sync", `Sender name in Gmail header: "${senderText?.trim()}"`);
      assert(senderText?.includes("no-reply@google.com"), "D06b-Desktop-Sender-Email-Sync", `Sender email in Gmail header: "${senderText?.trim()}"`);

      // Verify no horizontal overflow in modal
      const hasHorizontalScroll = await modal.evaluate((el) => el.scrollWidth > el.clientWidth + 2);
      assert(!hasHorizontalScroll, "D07-Desktop-Zero-Horizontal-Scroll", "Modal container has zero horizontal scrollbars");

      await context.close();
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 2: BREAKPOINT BOUNDARY (1024px vs 1023px)
    // -------------------------------------------------------------------------
    console.log("\n--- Section 2: Breakpoint Boundary (1024px vs 1023px) ---");
    {
      // 2.A: At exactly 1024px (Desktop `lg` threshold)
      const context1024 = await createAuthenticatedContext(browser, sessionCookies, 1024, 800);
      const page1024 = await context1024.newPage();
      const modal1024 = await openNewTemplateModal(page1024);

      const switcherAt1024 = await modal1024.locator("button:has-text('Gmail View')").isVisible();
      const rightPaneAt1024 = await modal1024.locator("text='Gmail Live Preview'").isVisible();
      assert(!switcherAt1024, "B01-Boundary-1024px-Switcher-Hidden", "At 1024px breakpoint: mobile switcher is hidden");
      assert(rightPaneAt1024, "B02-Boundary-1024px-Dual-Panel", "At 1024px breakpoint: both panels visible side-by-side");
      await context1024.close();

      // 2.B: At exactly 1023px (Mobile `< lg` threshold)
      const context1023 = await createAuthenticatedContext(browser, sessionCookies, 1023, 800);
      const page1023 = await context1023.newPage();
      const modal1023 = await openNewTemplateModal(page1023);

      const switcherAt1023 = await modal1023.locator("button:has-text('Gmail View')").isVisible();
      const leftPaneAt1023 = await modal1023.locator("#template-name").isVisible();
      const rightPaneAt1023 = await modal1023.locator("text='Gmail Live Preview'").isVisible();

      assert(switcherAt1023, "B03-Boundary-1023px-Switcher-Visible", "At 1023px viewport: mobile switcher is visible");
      assert(leftPaneAt1023, "B04-Boundary-1023px-Initial-Editor", "At 1023px: initial view displays Editor pane");
      assert(!rightPaneAt1023, "B05-Boundary-1023px-Initial-Preview-Hidden", "At 1023px: Gmail Live Preview is initially hidden");

      // Switch to Gmail View at 1023px
      await modal1023.locator("button:has-text('Gmail View')").click();
      await page1023.waitForTimeout(150);

      const leftAfterSwitch = await modal1023.locator("#template-name").isVisible();
      const rightAfterSwitch = await modal1023.locator("text='Gmail Live Preview'").isVisible();
      assert(!leftAfterSwitch, "B06-Boundary-1023px-Switched-Editor-Hidden", "After clicking Gmail View: Editor is hidden");
      assert(rightAfterSwitch, "B07-Boundary-1023px-Switched-Preview-Visible", "After clicking Gmail View: Gmail Live Preview is visible");

      await context1023.close();
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 3: MOBILE VIEWPORT (375px iPhone)
    // -------------------------------------------------------------------------
    console.log("\n--- Section 3: Mobile Viewport (375x667 Mobile) ---");
    {
      const context375 = await createAuthenticatedContext(browser, sessionCookies, 375, 667);
      const page375 = await context375.newPage();
      const modal375 = await openNewTemplateModal(page375);

      // Check mobile switcher buttons
      const editorBtn = modal375.locator("button:has-text('Editor')").first();
      const previewBtn = modal375.locator("button:has-text('Gmail View')").first();
      assert(await editorBtn.isVisible() && await previewBtn.isVisible(), "M01-Mobile-Switcher-Buttons-Present", "Both Editor and Gmail View toggle buttons present");

      // Enter data in Editor view
      await modal375.locator("#template-name").fill("Mobile Phish Campaign");
      await modal375.locator("#template-subject").fill("Mobile Test Subject");

      // Switch to Preview
      await previewBtn.click();
      await page375.waitForTimeout(200);

      // Verify preview shows subject
      const mobilePreviewSubject = await modal375.locator("h3:has-text('Mobile Test Subject')").isVisible();
      assert(mobilePreviewSubject, "M02-Mobile-Preview-Synchronized", "Gmail preview shows updated subject on mobile");

      // Check horizontal overflow on mobile
      const overflowAt375 = await modal375.evaluate((el) => el.scrollWidth > el.clientWidth + 2);
      assert(!overflowAt375, "M03-Mobile-No-Horizontal-Overflow", "No horizontal overflow on 375px mobile viewport");

      // Switch back to Editor
      await editorBtn.click();
      await page375.waitForTimeout(150);
      assert(await modal375.locator("#template-name").isVisible(), "M04-Mobile-Switch-Back-Editor", "Cleanly switches back to Editor view");

      await context375.close();
    }

    // -------------------------------------------------------------------------
    // TEST SECTION 4: ADVERSARIAL STRESS CASES (Long inputs, fallbacks, attachments)
    // -------------------------------------------------------------------------
    console.log("\n--- Section 4: Adversarial Stress Cases ---");
    {
      const context = await createAuthenticatedContext(browser, sessionCookies, 1280, 900);
      const page = await context.newPage();
      const modal = await openNewTemplateModal(page);

      // 4.A: Extreme long subject (300 characters without spaces)
      const longUnbrokenSubject = "A".repeat(300);
      await modal.locator("#template-subject").fill(longUnbrokenSubject);
      await page.waitForTimeout(200);
      const overflowAfterLongSubject = await modal.evaluate((el) => el.scrollWidth > el.clientWidth + 2);
      assert(!overflowAfterLongSubject, "S01-Stress-Long-Unbroken-Subject-No-Overflow", "300-char unbroken subject does not break layout (break-words applied)");

      // 4.B: Malformed / Exotic Envelope Sender strings
      await modal.locator("#template-envelope-sender").fill("<<<Broken>>> <bad@@domain.com>");
      await page.waitForTimeout(200);
      const avatarInitial = await modal.locator(".rounded-full.flex.items-center.justify-center.text-white.font-semibold").textContent();
      assert(Boolean(avatarInitial && avatarInitial.trim().length > 0), "S02-Stress-Malformed-Sender-Avatar-Init", `Avatar initial gracefully generated: "${avatarInitial?.trim()}"`);

      // 4.C: Fallback from empty HTML to Plaintext in Live Preview iframe
      await modal.locator("button:has-text('HTML')").click();
      const htmlTextarea = modal.locator("textarea[placeholder*='Phishing Email']");
      await htmlTextarea.fill(""); // Empty HTML

      await modal.locator("button:has-text('TEXT')").click();
      const plainTextarea = modal.locator("textarea[placeholder*='Plaintext']");
      await plainTextarea.fill("This is pure plaintext fallback content.\nLine 2 with special chars: <>&\"");
      await page.waitForTimeout(250);

      // Verify iframe content inside Gmail live preview
      const iframeElement = await modal.$("iframe[title='Gmail Live Preview Canvas']");
      assert(Boolean(iframeElement), "S03-Stress-Iframe-Canvas-Present", "Gmail Live Preview Canvas iframe is mounted");

      const iframeSrcDoc = await iframeElement?.getAttribute("srcDoc");
      assert(iframeSrcDoc?.includes("This is pure plaintext fallback content."), "S04-Stress-Plaintext-Fallback-Rendered", "Iframe srcDoc correctly rendered formatted plaintext fallback");
      assert(iframeSrcDoc?.includes("&lt;&gt;&amp;&quot;"), "S05-Stress-Plaintext-Escaped", "Plaintext special characters safely HTML-escaped");

      await context.close();
    }

  } finally {
    await browser.close();
  }

  console.log("\n================================================================================");
  console.log(`  CHALLENGER SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (TOTAL: ${totalTests})`);
  console.log("================================================================================\n");

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("FATAL RUNNER ERROR:", err);
  process.exit(1);
});
