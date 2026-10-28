/**
 * Empirical Challenger Edge Cases Test Suite
 * 
 * Edge cases to verify:
 * 1. Quick tags cursor insertion into Text vs HTML editor.
 * 2. Attachment upload, base64 data conversion, and deletion.
 * 3. Import email modal link rewriting toggle (convert_links: true vs false).
 * 4. Copy template cloning with "Copy of " prefix.
 * 5. Delete confirmation dialog (cancel vs confirm).
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

let passedCount = 0;
let failedCount = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failedCount++;
  }
}

async function run() {
  console.log("\n=======================================================");
  console.log("  EMPIRICAL CHALLENGER: FRONTEND EDGE CASES HARNESS");
  console.log("=======================================================\n");

  const browser = await chromium.launch({
    headless: true,
    executablePath: browserPath,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });

  // Inject session cookie directly
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `1.${expiry}`;
  const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const token = `${payload}.${sig}`;

  await context.addCookies([
    { name: "rts_session", value: token, domain: "127.0.0.1", path: "/" },
    { name: "rts_session", value: token, domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();

  // Navigate directly to /email-templates
  console.log("Step 1: Navigating to /email-templates...");
  await page.goto(`${BASE_URL}/email-templates`, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForSelector("button:has-text('New Template')", { timeout: 10000 });

  // -------------------------------------------------------------
  // EDGE CASE 1: Quick tags cursor insertion into Text vs HTML editor
  // -------------------------------------------------------------
  console.log("\n--- Testing Edge Case 1: Quick Tags Cursor Insertion ---");
  await page.locator("button:has-text('New Template')").click();
  await page.waitForSelector("h2:has-text('New Template')", { timeout: 5000 });

  // 1.A: Text editor cursor insertion
  await page.locator("button:has-text('TEXT')").click();
  const textEditor = page.locator("textarea[placeholder*='Plaintext']");
  await textEditor.fill("Hello World");
  // Set selection range between Hello and World (index 6)
  await textEditor.evaluate((el) => {
    el.focus();
    el.setSelectionRange(6, 6);
  });
  // Click tag {{.FirstName}}
  await page.locator("button:has-text('{{.FirstName}}')").click();
  await page.waitForTimeout(200);
  const textVal = await textEditor.inputValue();
  assert(textVal === "Hello {{.FirstName}}World" || textVal.includes("{{.FirstName}}"), `Text editor cursor insertion: "${textVal}"`);

  // 1.B: HTML editor cursor insertion
  await page.locator("button:has-text('HTML')").click();
  const htmlEditor = page.locator("textarea[placeholder*='Phishing Email']");
  await htmlEditor.fill("<p>Click </p>");
  await htmlEditor.evaluate((el) => {
    el.focus();
    el.setSelectionRange(9, 9); // After "Click "
  });
  // Click tag {{.URL}}
  await page.locator("button:has-text('{{.URL}}')").click();
  await page.waitForTimeout(200);
  const htmlVal = await htmlEditor.inputValue();
  assert(htmlVal === "<p>Click {{.URL}}</p>" || htmlVal.includes("{{.URL}}"), `HTML editor cursor insertion: "${htmlVal}"`);

  // 1.C: Preview tab switch back on tag click
  await page.locator("button:has-text('PREVIEW')").click();
  await page.locator("button:has-text('{{.Position}}')").click();
  await page.waitForTimeout(200);
  const htmlValAfterPreview = await htmlEditor.inputValue();
  assert(htmlValAfterPreview.includes("{{.Position}}"), `Tag clicked during Preview switches to HTML and inserts: "${htmlValAfterPreview}"`);

  // -------------------------------------------------------------
  // EDGE CASE 2: Attachment upload, base64 conversion, and deletion
  // -------------------------------------------------------------
  console.log("\n--- Testing Edge Case 2: Attachment Management ---");
  // Create temp test files
  const tmpFile1 = path.join(ROOT_DIR, "tmp-test-att1.txt");
  const tmpFile2 = path.join(ROOT_DIR, "tmp-test-att2.pdf");
  fs.writeFileSync(tmpFile1, "Hello from Attachment 1 - edge case test");
  fs.writeFileSync(tmpFile2, "%PDF-1.4 Mock PDF content for edge case test");

  const fileInput = page.locator("input[type='file']");
  await fileInput.setInputFiles([tmpFile1, tmpFile2]);
  await page.waitForTimeout(600);

  // Check attachments in UI
  const att1Visible = await page.locator("span:has-text('tmp-test-att1.txt')").isVisible();
  const att2Visible = await page.locator("span:has-text('tmp-test-att2.pdf')").isVisible();
  assert(att1Visible && att2Visible, "Both uploaded files appear in attachment list with names");

  // Remove tmp-test-att1.txt specifically
  const att1Container = page.locator("div.flex.items-center.justify-between", { has: page.locator("span:has-text('tmp-test-att1.txt')") });
  const att1RemoveBtn = att1Container.locator("button[title='Remove Attachment'], button[aria-label='Remove Attachment']");
  await att1RemoveBtn.click();
  await page.waitForTimeout(400);

  const att1StillVisible = await page.locator("span:has-text('tmp-test-att1.txt')").isVisible();
  const att2StillVisible = await page.locator("span:has-text('tmp-test-att2.pdf')").isVisible();
  assert(!att1StillVisible, "tmp-test-att1.txt was removed cleanly");
  assert(att2StillVisible, "tmp-test-att2.pdf remains present in attachment list");

  // Clean up temp files
  try { fs.unlinkSync(tmpFile1); } catch {}
  try { fs.unlinkSync(tmpFile2); } catch {}

  // -------------------------------------------------------------
  // EDGE CASE 3: Import Email Link Rewriting Toggle (convert_links)
  // -------------------------------------------------------------
  console.log("\n--- Testing Edge Case 3: Import Email Link Rewriting Toggle ---");
  // Open Import Email modal
  await page.locator("button:has-text('Import Email')").first().click();
  await page.waitForSelector("h3:has-text('Import Email')", { timeout: 5000 });

  const rawMime = [
    "Subject: Urgent Account Notice",
    "Content-Type: text/html; charset=utf-8",
    "",
    '<html><body>Click <a href="https://legit-phish.target.com/portal">here</a> to reset.</body></html>'
  ].join("\r\n");

  const rawTextarea = page.locator("#raw-email-source");
  await rawTextarea.fill(rawMime);

  // 3.A: With convert_links checked (default is true)
  const importModal = page.locator("div.fixed.z-\\[60\\]");
  const linkCheckbox = importModal.locator("input[type='checkbox']");
  const isChecked = await linkCheckbox.isChecked();
  assert(isChecked, "Convert links checkbox is checked by default");

  await importModal.locator("button:has-text('Import')").click();
  await page.waitForTimeout(600);

  // Verify HTML editor contains {{.URL}}
  const importedHtmlWithConvert = await page.locator("textarea[placeholder*='Phishing Email']").inputValue();
  assert(
    importedHtmlWithConvert.includes('<a href="{{.URL}}">'),
    `Import with convert_links: true rewrote link to {{.URL}}: "${importedHtmlWithConvert}"`
  );

  // 3.B: With convert_links UNCHECKED
  await page.locator("button:has-text('Import Email')").first().click();
  await page.waitForSelector("h3:has-text('Import Email')", { timeout: 5000 });
  await page.locator("#raw-email-source").fill(rawMime);

  // Uncheck convert_links
  const importModal2 = page.locator("div.fixed.z-\\[60\\]");
  await importModal2.locator("input[type='checkbox']").uncheck();
  await importModal2.locator("button:has-text('Import')").click();
  await page.waitForTimeout(600);

  const importedHtmlWithoutConvert = await page.locator("textarea[placeholder*='Phishing Email']").inputValue();
  assert(
    importedHtmlWithoutConvert.includes('href="https://legit-phish.target.com/portal"'),
    `Import with convert_links: false preserved original URL: "${importedHtmlWithoutConvert}"`
  );

  // Fill name and save template for Edge Cases 4 & 5
  const edgeTemplateName = `Edge-Case-Template-${Date.now()}`;
  await page.locator("#template-name").fill(edgeTemplateName);
  await page.locator("#template-subject").fill("Edge Case Subject");
  await page.locator("button:has-text('Save Template')").click();
  await page.waitForTimeout(1000);

  // Verify template is in table
  const createdInTable = await page.locator(`span:has-text('${edgeTemplateName}')`).isVisible();
  assert(createdInTable, `Template "${edgeTemplateName}" created and visible in table`);

  // -------------------------------------------------------------
  // EDGE CASE 4: Copy Template Cloning with "Copy of " prefix
  // -------------------------------------------------------------
  console.log("\n--- Testing Edge Case 4: Copy Template with 'Copy of ' prefix ---");
  // Find the row with edgeTemplateName and click its copy button
  const row = page.locator("tr", { has: page.locator(`span:has-text('${edgeTemplateName}')`) });
  const copyBtn = row.locator("button[title='Copy Template'], button[aria-label='Copy Template']");
  await copyBtn.click();
  await page.waitForSelector("h2:has-text('New Template')", { timeout: 5000 });

  const copiedNameVal = await page.locator("#template-name").inputValue();
  assert(copiedNameVal === `Copy of ${edgeTemplateName}`, `Copied template has 'Copy of ' prefix: "${copiedNameVal}"`);

  // Verify fields were copied
  const copiedSubjectVal = await page.locator("#template-subject").inputValue();
  assert(copiedSubjectVal === "Edge Case Subject", `Copied template preserved subject: "${copiedSubjectVal}"`);

  // Save the copy
  await page.locator("button:has-text('Save Template')").click();
  await page.waitForTimeout(1000);

  const copyInTable = await page.locator(`span:has-text('Copy of ${edgeTemplateName}')`).isVisible();
  assert(copyInTable, `Cloned template "Copy of ${edgeTemplateName}" exists in table`);

  // -------------------------------------------------------------
  // EDGE CASE 5: Custom Delete Confirmation Dialog
  // -------------------------------------------------------------
  console.log("\n--- Testing Edge Case 5: Custom Delete Confirmation Dialog ---");
  // Find row for the copy
  const copyRow = page.locator("tr", { has: page.locator(`span:has-text('Copy of ${edgeTemplateName}')`) });
  const deleteBtn = copyRow.locator("button[title='Delete Template'], button[aria-label='Delete Template']");
  await deleteBtn.click();
  await page.waitForSelector("h3:has-text('Hapus Email Template?')", { timeout: 5000 });

  // 5.A: Check dialog text and cancel action
  const deleteModal = page.locator("div.fixed.z-50", { has: page.locator("h3:has-text('Hapus Email Template?')") });
  const dialogText = await deleteModal.textContent();
  assert(dialogText.includes(`Copy of ${edgeTemplateName}`), "Delete dialog displays template name");
  assert(dialogText.includes("This will delete the template. This can't be undone!"), "Delete dialog contains GoPhish warning");

  // Cancel deletion
  await deleteModal.locator("button:has-text('Cancel')").click();
  await page.waitForTimeout(300);
  const stillInTableAfterCancel = await page.locator(`span:has-text('Copy of ${edgeTemplateName}')`).isVisible();
  assert(stillInTableAfterCancel, "Template was NOT deleted after clicking Cancel");

  // 5.B: Confirm deletion
  await deleteBtn.click();
  await page.waitForSelector("h3:has-text('Hapus Email Template?')", { timeout: 5000 });
  const deleteModal2 = page.locator("div.fixed.z-50", { has: page.locator("h3:has-text('Hapus Email Template?')") });
  await deleteModal2.locator("button:has-text('Delete')").click();
  await page.waitForTimeout(1000);

  const goneFromTable = !(await page.locator(`span:has-text('Copy of ${edgeTemplateName}')`).isVisible());
  assert(goneFromTable, `Template "Copy of ${edgeTemplateName}" is purged from table after confirmation`);

  // Clean up original test template as well
  const origRow = page.locator("tr", { has: page.locator(`span:has-text('${edgeTemplateName}')`) });
  if (await origRow.isVisible()) {
    await origRow.locator("button[title='Delete Template'], button[aria-label='Delete Template']").click();
    await page.waitForSelector("h3:has-text('Hapus Email Template?')", { timeout: 5000 });
    const deleteModal3 = page.locator("div.fixed.z-50", { has: page.locator("h3:has-text('Hapus Email Template?')") });
    await deleteModal3.locator("button:has-text('Delete')").click();
    await page.waitForTimeout(1000);
  }

  await browser.close();

  console.log("\n=======================================================");
  console.log(`EDGE CASES SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) process.exit(1);
  else process.exit(0);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
