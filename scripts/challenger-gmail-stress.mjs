/**
 * EMPIRICAL CHALLENGER: GMAIL LIVE PREVIEW ADVERSARIAL STRESS TEST
 * 
 * Verifies:
 * 1. Empty subject defaulting to "(no subject)" and dynamic subject synchronization
 * 2. Plaintext-only (HTML empty) -> pre-wrap formatted email body in sandboxed iframe & HTML escaping
 * 3. Envelope sender formats parsing and rendering across diverse patterns
 * 4. Dynamic attachment chips presence, format badges, and removal reactivity
 * 5. Modal lifecycle and zero console errors / uncaught exceptions
 */

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

if (!browserPath || !playwrightPath) {
  console.error("Browser or Playwright-core not found!");
  process.exit(1);
}

const { chromium } = require(playwrightPath);

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

function assert(cond, testName, details = "") {
  if (cond) {
    console.log(`  [PASS] ${testName}`);
    totalPassed++;
  } else {
    console.error(`  [FAIL] ${testName} ${details ? `(${details})` : ""}`);
    failures.push({ testName, details });
    totalFailed++;
  }
}

async function waitForCondition(predicate, timeout = 2500, interval = 50) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await predicate()) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

async function runAdversarialStressSuite() {
  console.log("======================================================================");
  console.log("  ADVERSARIAL CHALLENGER: GMAIL LIVE PREVIEW EMPIRICAL HARNESS");
  console.log("======================================================================\n");

  const consoleErrors = [];
  const uncaughtExceptions = [];

  const browser = await chromium.launch({
    headless: true,
    executablePath: browserPath,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 950 },
  });

  // Inject session cookie
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `1.${expiry}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const token = `${payload}.${sig}`;

  await context.addCookies([
    { name: "rts_session", value: token, domain: "127.0.0.1", path: "/" },
    { name: "rts_session", value: token, domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();

  // Listen to all console messages and uncaught exceptions
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon.ico")) {
        consoleErrors.push(text);
      }
    }
  });

  page.on("pageerror", (err) => {
    uncaughtExceptions.push(err.message || String(err));
  });

  console.log("Step 1: Navigating to /email-templates...");
  await page.goto(`${BASE_URL}/email-templates`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForSelector("button:has-text('New Template')", { timeout: 10000 });

  // ------------------------------------------------------------------
  // TEST GROUP 1: Dual-Panel Split Modal Layout
  // ------------------------------------------------------------------
  console.log("\n--- TEST GROUP 1: Dual-Panel Split Modal Layout ---");
  await page.locator("button:has-text('New Template')").click();
  await page.waitForSelector("h2:has-text('New Template')", { timeout: 5000 });

  // Modal container styling
  const modalContainer = page.locator("div.fixed.inset-0 > div.bg-card");
  const modalClass = await modalContainer.getAttribute("class");
  assert(
    modalClass?.includes("max-w-[1500px]") && modalClass?.includes("w-[96vw]"),
    "Dual-Panel Modal has wide responsive container classes (w-[96vw] max-w-[1500px])"
  );

  // Split grid layout
  const splitGrid = page.locator("div.flex-1.overflow-hidden.grid");
  const gridClass = await splitGrid.getAttribute("class");
  assert(
    gridClass?.includes("lg:grid-cols-2"),
    "Modal layout uses 50/50 dual-panel split grid on desktop (lg:grid-cols-2)"
  );

  // Right pane Gmail preview container
  const gmailPreviewHeader = page.locator("span:has-text('Gmail Live Preview')");
  assert(await gmailPreviewHeader.isVisible(), "Gmail Live Preview badge is visible in right pane");

  // ------------------------------------------------------------------
  // TEST GROUP 2: Empty Subject Default & Dynamic Sync
  // ------------------------------------------------------------------
  console.log("\n--- TEST GROUP 2: Subject Line Header & (no subject) Default ---");
  const subjectInput = page.locator("#template-subject");
  const previewSubjectHeader = page.locator("h3.text-xl.font-semibold");

  // 2.A: Default empty subject
  await page.waitForTimeout(100);
  const initialSubject = (await previewSubjectHeader.textContent())?.trim();
  assert(initialSubject === "(no subject)", "Empty subject defaults to '(no subject)' in Gmail preview header", `got: "${initialSubject}"`);

  // 2.B: Populated subject
  await subjectInput.fill("Phishing Simulation: Urgent Tax Audit Notification");
  const subjectSynced = await waitForCondition(async () => {
    const txt = (await previewSubjectHeader.textContent())?.trim();
    return txt === "Phishing Simulation: Urgent Tax Audit Notification";
  });
  const populatedSubject = (await previewSubjectHeader.textContent())?.trim();
  assert(
    subjectSynced,
    "Populated subject dynamically synchronizes to Gmail preview header",
    `got: "${populatedSubject}"`
  );

  // 2.C: Whitespace-only subject
  await subjectInput.fill("     ");
  const whitespaceSynced = await waitForCondition(async () => {
    const txt = (await previewSubjectHeader.textContent())?.trim();
    return txt === "(no subject)";
  });
  const whitespaceSubject = (await previewSubjectHeader.textContent())?.trim();
  assert(whitespaceSynced, "Whitespace-only subject safely defaults to '(no subject)'", `got: "${whitespaceSubject}"`);

  // 2.D: Clear back to empty
  await subjectInput.fill("");
  const clearedSynced = await waitForCondition(async () => {
    const txt = (await previewSubjectHeader.textContent())?.trim();
    return txt === "(no subject)";
  });
  const clearedSubject = (await previewSubjectHeader.textContent())?.trim();
  assert(clearedSynced, "Clearing subject returns to '(no subject)'", `got: "${clearedSubject}"`);

  // ------------------------------------------------------------------
  // TEST GROUP 3: Plaintext vs HTML Live Body Rendering in Sandbox
  // ------------------------------------------------------------------
  console.log("\n--- TEST GROUP 3: Sandboxed Email Canvas Dual-Mode Rendering ---");
  const iframeLocator = page.frameLocator("iframe[title='Gmail Live Preview Canvas']");

  // 3.A: Both HTML and Text empty -> shows (No content in message body)
  await page.locator("button:has-text('HTML')").click();
  const htmlEditor = page.locator("textarea[placeholder*='Phishing Email']");
  await htmlEditor.fill("");
  await page.locator("button:has-text('TEXT')").click();
  const textEditor = page.locator("textarea[placeholder*='Plaintext']");
  await textEditor.fill("");

  await waitForCondition(async () => {
    const txt = await iframeLocator.locator("body").textContent();
    return txt?.includes("(No content in message body)");
  });

  const emptyBodyText = await iframeLocator.locator("body").textContent();
  assert(
    emptyBodyText?.includes("(No content in message body)"),
    "Both HTML & Text empty displays placeholder '(No content in message body)'",
    `got: "${emptyBodyText}"`
  );

  // 3.B: Plaintext only (HTML empty) -> pre-wrap formatted body & safe escaping
  const testPlaintext = [
    "Dear Employee,",
    "",
    "Your credentials will expire in 2 hours.",
    "Please visit: https://internal-portal.domain/verify?id=123&code=456",
    "Dangerous markup: <script>alert('xss')</script> & <b>not bold</b>",
    "Signature: Operations <ops@corp.local>",
  ].join("\n");

  await textEditor.fill(testPlaintext);

  const plaintextRendered = await waitForCondition(async () => {
    const body = await iframeLocator.locator("body").innerText();
    return body.includes("Dear Employee,");
  });

  // Check iframe style and contents
  const iframeBody = iframeLocator.locator("body");
  const iframeBodyHtml = await iframeBody.innerHTML();
  const iframeBodyText = await iframeBody.innerText();

  const iframeBodyWhiteSpaces = await iframeBody.evaluate((el) => {
    return window.getComputedStyle(el).whiteSpace;
  });

  assert(
    iframeBodyWhiteSpaces === "pre-wrap",
    "Plaintext body uses CSS 'white-space: pre-wrap' for authentic formatting",
    `whiteSpace style: "${iframeBodyWhiteSpaces}"`
  );

  assert(
    !iframeBodyHtml.includes("<script>"),
    "Plaintext body safely escapes HTML special characters (no unescaped <script>)",
    `html: "${iframeBodyHtml}"`
  );

  assert(
    iframeBodyHtml.includes("&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;") ||
    iframeBodyHtml.includes("&lt;script&gt;"),
    "Plaintext body contains correctly escaped HTML entities (&lt;script&gt;)",
    `html: "${iframeBodyHtml}"`
  );

  assert(
    plaintextRendered &&
    iframeBodyText.includes("Dear Employee,") &&
    iframeBodyText.includes("Your credentials will expire in 2 hours.") &&
    iframeBodyText.includes("Please visit: https://internal-portal.domain/verify?id=123&code=456"),
    "Plaintext email body renders multi-line text cleanly",
    `body innerText: "${iframeBodyText}"`
  );

  // 3.C: Populated HTML takes precedence over Text
  await page.locator("button:has-text('HTML')").click();
  const testHtml = `<div class="security-banner"><h3>CRITICAL NOTICE</h3><p>Click <a href="{{.URL}}">here</a> to verify.</p></div>`;
  await htmlEditor.fill(testHtml);

  const htmlRendered = await waitForCondition(async () => {
    const h3 = await iframeLocator.locator("h3").textContent();
    return h3 === "CRITICAL NOTICE";
  });

  const htmlRenderedH3 = await iframeLocator.locator("h3").textContent();
  assert(
    htmlRendered && htmlRenderedH3 === "CRITICAL NOTICE",
    "When HTML is populated, it takes precedence and renders rich HTML tags in iframe",
    `h3: "${htmlRenderedH3}"`
  );

  // 3.D: Clearing HTML falls back immediately to Plaintext
  await htmlEditor.fill("");
  const fallbackRendered = await waitForCondition(async () => {
    const body = await iframeLocator.locator("body").innerText();
    return body.includes("Dear Employee,");
  });

  const fallbackBodyText = await iframeLocator.locator("body").innerText();
  assert(
    fallbackRendered && fallbackBodyText.includes("Dear Employee,"),
    "Clearing HTML falls back immediately to formatted Plaintext body",
    `fallback text: "${fallbackBodyText}"`
  );

  // ------------------------------------------------------------------
  // TEST GROUP 4: Envelope Sender Parsing & Avatar Rendering
  // ------------------------------------------------------------------
  console.log("\n--- TEST GROUP 4: Envelope Sender Variations & Avatar ---");
  const senderInput = page.locator("#template-envelope-sender");
  const senderDisplayName = page.locator("div.flex.items-baseline span.font-bold");
  const senderEmailSpan = page.locator("div.flex.items-baseline span.text-xs");
  const avatarDiv = page.locator("div.w-10.h-10.rounded-full");

  const senderTestCases = [
    {
      raw: "John Doe <john.doe@enterprise.com>",
      expectedName: "John Doe",
      expectedEmail: "<john.doe@enterprise.com>",
      expectedInitial: "J",
    },
    {
      raw: "IT Support<support@itdesk.local>",
      expectedName: "IT Support",
      expectedEmail: "<support@itdesk.local>",
      expectedInitial: "I",
    },
    {
      raw: "<alert@automated.org>",
      expectedName: "alert",
      expectedEmail: "<alert@automated.org>",
      expectedInitial: "A",
    },
    {
      raw: "service-desk@cloudservice.net",
      expectedName: "service-desk",
      expectedEmail: "<service-desk@cloudservice.net>",
      expectedInitial: "S",
    },
    {
      raw: "Human Resources Department",
      expectedName: "Human Resources Department",
      expectedEmail: "<security@company.com>",
      expectedInitial: "H",
    },
    {
      raw: "",
      expectedName: "Security Operations",
      expectedEmail: "<security@company.com>",
      expectedInitial: "S",
    },
    {
      raw: "     ",
      expectedName: "Security Operations",
      expectedEmail: "<security@company.com>",
      expectedInitial: "S",
    },
  ];

  for (const tc of senderTestCases) {
    await senderInput.fill(tc.raw);

    const senderMatched = await waitForCondition(async () => {
      const actualName = (await senderDisplayName.textContent())?.trim();
      const actualEmail = (await senderEmailSpan.textContent())?.trim();
      const actualInitial = (await avatarDiv.textContent())?.trim();
      return (
        actualName === tc.expectedName &&
        actualEmail === tc.expectedEmail &&
        actualInitial === tc.expectedInitial
      );
    });

    const actualName = (await senderDisplayName.textContent())?.trim();
    const actualEmail = (await senderEmailSpan.textContent())?.trim();
    const actualInitial = (await avatarDiv.textContent())?.trim();
    const avatarBg = await avatarDiv.evaluate((el) => el.style.backgroundColor);

    assert(
      senderMatched && avatarBg.length > 0,
      `Sender "${tc.raw}" -> Name: "${actualName}", Email: "${actualEmail}", Initial: "${actualInitial}", Color: "${avatarBg}"`
    );
  }

  // ------------------------------------------------------------------
  // TEST GROUP 5: Dynamic Gmail Attachment Chips
  // ------------------------------------------------------------------
  console.log("\n--- TEST GROUP 5: Dynamic Attachment Chips Presence & Removal ---");

  // Initial check: 0 attachments -> no attachment preview section
  const attachmentPreviewSection = page.locator("div.mt-6.pt-5.border-t");
  assert(
    (await attachmentPreviewSection.count()) === 0,
    "No attachment preview section rendered when form has 0 attachments"
  );

  // Create temporary mock attachments
  const pdfFile = path.join(ROOT_DIR, "challenger-test-doc.pdf");
  const xlsxFile = path.join(ROOT_DIR, "challenger-financials.xlsx");
  const zipFile = path.join(ROOT_DIR, "challenger-archive.zip");

  fs.writeFileSync(pdfFile, "%PDF-1.4 Mock PDF Stream Content for Challenger Verification");
  fs.writeFileSync(xlsxFile, "PK\x03\x04Mock XLSX Spreadsheet Data Content");
  fs.writeFileSync(zipFile, "PK\x03\x04Mock ZIP Archive Binary Stream");

  const fileInput = page.locator("input[type='file']");
  await fileInput.setInputFiles([pdfFile, xlsxFile, zipFile]);
  await page.waitForTimeout(600);

  // 5.A: Verify attachment section appears with count
  assert(
    (await attachmentPreviewSection.count()) > 0,
    "Attachment preview section rendered when files are uploaded"
  );

  const countBadge = page.locator("span:has-text('3 Attachments')");
  assert(await countBadge.isVisible(), "Attachment header shows correct count '3 Attachments'");

  // 5.B: Verify chips and format badges
  const pdfChip = page.locator("div.group", { has: page.locator("p:has-text('challenger-test-doc.pdf')") });
  const xlsxChip = page.locator("div.group", { has: page.locator("p:has-text('challenger-financials.xlsx')") });
  const zipChip = page.locator("div.group", { has: page.locator("p:has-text('challenger-archive.zip')") });

  assert(await pdfChip.isVisible(), "PDF attachment chip is visible in Gmail preview");
  assert(await xlsxChip.isVisible(), "XLSX attachment chip is visible in Gmail preview");
  assert(await zipChip.isVisible(), "ZIP attachment chip is visible in Gmail preview");

  const pdfBadge = await pdfChip.locator("span.font-mono").textContent();
  const xlsxBadge = await xlsxChip.locator("span.font-mono").textContent();
  const zipBadge = await zipChip.locator("span.font-mono").textContent();

  assert(pdfBadge === "PDF", `PDF chip displays badge 'PDF' (got: "${pdfBadge}")`);
  assert(xlsxBadge === "XLSX", `XLSX chip displays badge 'XLSX' (got: "${xlsxBadge}")`);
  assert(zipBadge === "ZIP", `ZIP chip displays badge 'ZIP' (got: "${zipBadge}")`);

  // 5.C: Remove one attachment from editor (challenger-test-doc.pdf)
  const removePdfBtn = page
    .locator("div.flex.items-center.justify-between", {
      has: page.locator("span:has-text('challenger-test-doc.pdf')"),
    })
    .locator("button[title='Remove Attachment'], button[aria-label='Remove Attachment']");

  await removePdfBtn.click();
  await page.waitForTimeout(400);

  // Re-check preview
  const countBadgeAfterRemove = page.locator("span:has-text('2 Attachments')");
  assert(await countBadgeAfterRemove.isVisible(), "Attachment header updates reactively to '2 Attachments'");
  assert((await pdfChip.count()) === 0, "Removed PDF chip is no longer present in Gmail preview");
  assert(await xlsxChip.isVisible(), "Remaining XLSX chip is still present");
  assert(await zipChip.isVisible(), "Remaining ZIP chip is still present");

  // 5.D: Remove remaining attachments
  const removeXlsxBtn = page
    .locator("div.flex.items-center.justify-between", {
      has: page.locator("span:has-text('challenger-financials.xlsx')"),
    })
    .locator("button[title='Remove Attachment'], button[aria-label='Remove Attachment']");
  await removeXlsxBtn.click();
  await page.waitForTimeout(200);

  const removeZipBtn = page
    .locator("div.flex.items-center.justify-between", {
      has: page.locator("span:has-text('challenger-archive.zip')"),
    })
    .locator("button[title='Remove Attachment'], button[aria-label='Remove Attachment']");
  await removeZipBtn.click();
  await page.waitForTimeout(400);

  assert(
    (await attachmentPreviewSection.count()) === 0,
    "Attachment preview section completely unmounts when all attachments are removed"
  );

  // Clean up mock files
  try { fs.unlinkSync(pdfFile); } catch {}
  try { fs.unlinkSync(xlsxFile); } catch {}
  try { fs.unlinkSync(zipFile); } catch {}

  // ------------------------------------------------------------------
  // TEST GROUP 6: Modal Lifecycle & Zero Console Errors
  // ------------------------------------------------------------------
  console.log("\n--- TEST GROUP 6: Modal Lifecycle & Console Health ---");

  // 6.A: Cancel and close modal
  await page.locator("button:has-text('Cancel')").first().click();
  await page.waitForTimeout(300);
  assert(
    (await page.locator("h2:has-text('New Template')").count()) === 0,
    "Modal closed cleanly via Cancel button"
  );

  // 6.B: Re-open modal
  await page.locator("button:has-text('New Template')").click();
  await page.waitForSelector("h2:has-text('New Template')", { timeout: 5000 });
  assert(
    await page.locator("h2:has-text('New Template')").isVisible(),
    "Modal re-opened successfully on second invocation"
  );

  // 6.C: Close via X icon
  await page.locator("button[aria-label='Close modal']").click();
  await page.waitForTimeout(300);
  assert(
    (await page.locator("h2:has-text('New Template')").count()) === 0,
    "Modal closed cleanly via 'Close modal' (X) button"
  );

  // 6.D: Open Import Email sub-modal, then close it
  await page.locator("button:has-text('New Template')").click();
  await page.waitForSelector("button:has-text('Import Email')", { timeout: 5000 });
  await page.locator("button:has-text('Import Email')").first().click();
  await page.waitForSelector("h3:has-text('Import Email')", { timeout: 5000 });
  assert(
    await page.locator("h3:has-text('Import Email')").isVisible(),
    "Import Email sub-modal opened over split-screen modal"
  );

  // Close submodal with Cancel
  const importSubmodal = page.locator("div.fixed.z-\\[60\\]");
  await importSubmodal.locator("button:has-text('Cancel')").click();
  await page.waitForTimeout(300);
  assert(
    (await page.locator("h3:has-text('Import Email')").count()) === 0,
    "Import Email sub-modal dismissed cleanly without closing parent modal"
  );
  assert(
    await page.locator("h2:has-text('New Template')").isVisible(),
    "Parent dual-panel modal remains active and stable"
  );

  // Close parent modal
  await page.locator("button:has-text('Cancel')").first().click();
  await page.waitForTimeout(300);

  // 6.E: Check for console errors and uncaught exceptions
  console.log(`\nConsole errors recorded: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e) => console.error("  [Console Error]:", e));
  }
  console.log(`Uncaught exceptions recorded: ${uncaughtExceptions.length}`);
  if (uncaughtExceptions.length > 0) {
    uncaughtExceptions.forEach((e) => console.error("  [Uncaught Exception]:", e));
  }

  assert(
    consoleErrors.length === 0,
    "Zero console errors recorded during entire dual-panel modal interaction lifecycle",
    `Count: ${consoleErrors.length}`
  );

  assert(
    uncaughtExceptions.length === 0,
    "Zero uncaught exceptions recorded during entire modal lifecycle",
    `Count: ${uncaughtExceptions.length}`
  );

  await browser.close();

  console.log("\n======================================================================");
  console.log(`  STRESS TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("======================================================================\n");

  if (totalFailed > 0) {
    console.error("FAILURES DETECTED:");
    failures.forEach((f) => console.error(` - ${f.testName} (${f.details})`));
    process.exit(1);
  } else {
    console.log("ALL ADVERSARIAL STRESS TESTS PASSED EMPIRICALLY WITH 0 FAILURES.");
    process.exit(0);
  }
}

runAdversarialStressSuite().catch((err) => {
  console.error("Fatal error during stress suite:", err);
  process.exit(1);
});
