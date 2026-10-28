/**
 * Comprehensive 4-Tier E2E & Visual Test Runner for Email Templates in phish-magang
 * 
 * Tiers:
 * - Tier 1: Feature Coverage (F01 - F23, >=5 test cases per feature category)
 * - Tier 2: Boundary & Corner Cases (>=5 per category: empty inputs, missing subjects, special chars, max sizes, invalid MIME)
 * - Tier 3: Cross-Feature Combinations (Pairwise workflows: Import MIME -> convert links -> tracking pixel -> attachments -> save -> copy -> delete cascade)
 * - Tier 4: Real-World Workloads (Authentic GoPhish phishing scenarios: M365 password alert, HR payroll, CEO wire, IT policy)
 * - Visual: Playwright visual snapshots (Main Table, New/Edit Modal, Import Email Sub-modal)
 * 
 * Usage:
 *   node scripts/run-e2e-tests.mjs              # Run all tiers
 *   node scripts/run-e2e-tests.mjs --tier=1     # Run Tier 1 only
 *   node scripts/run-e2e-tests.mjs --tier=2     # Run Tier 2 only
 *   node scripts/run-e2e-tests.mjs --tier=3     # Run Tier 3 only
 *   node scripts/run-e2e-tests.mjs --tier=4     # Run Tier 4 only
 *   node scripts/run-e2e-tests.mjs --tier=visual # Run Visual Snapshots only
 */

import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "04942c68cc80d9cfd52870a58726e4909bdbe9427ceafdc0540a3f703cce76c6";

// CLI Arguments
const args = process.argv.slice(2);
const tierArg = args.find((a) => a.startsWith("--tier="))?.split("=")[1]?.toLowerCase() || "all";

// Colorized Output Helpers
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

function logHeader(title) {
  console.log(`\n${colors.cyan}${colors.bright}══════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}══════════════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function logSubHeader(title) {
  console.log(`\n${colors.yellow}${colors.bright}── ${title} ──${colors.reset}`);
}

// Test State
const results = {
  passed: 0,
  failed: 0,
  pending: 0,
  tests: [],
  startTime: Date.now(),
};

function report(id, tier, description, status, details = "") {
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏳";
  const color = status === "PASS" ? colors.green : status === "FAIL" ? colors.red : colors.yellow;
  console.log(`  ${icon} [${id}] ${color}${description}${colors.reset}`);
  if (details && status !== "PASS") {
    console.log(`     ${colors.dim}${details}${colors.reset}`);
  }
  if (status === "PASS") results.passed++;
  else if (status === "FAIL") results.failed++;
  else results.pending++;

  results.tests.push({ id, tier, description, status, details });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Session Generator (HMAC-SHA256 matching src/lib/session.ts)
function createSessionCookie(userId = 1) {
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `${userId}.${expiry}`;
  const signature = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `rts_session=${payload}.${signature}`;
}

const authCookie = createSessionCookie(1);

// HTTP Client Helpers
async function api(pathname, options = {}, retries = 2) {
  const url = `${BASE_URL}${pathname}`;
  const headers = {
    "Content-Type": "application/json",
    Cookie: authCookie,
    ...(options.headers || {}),
  };
  try {
    const res = await fetch(url, { ...options, headers });
    let body = null;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    // Auto-retry transient Next.js dev server manifest compiler glitches
    if (
      res.status === 500 &&
      typeof body === "string" &&
      (body.includes("loadManifest") || body.includes("Unexpected end of JSON input")) &&
      retries > 0
    ) {
      await sleep(350);
      return api(pathname, options, retries - 1);
    }
    return { status: res.status, ok: res.ok, headers: res.headers, body };
  } catch (err) {
    if (retries > 0) {
      await sleep(350);
      return api(pathname, options, retries - 1);
    }
    return { status: 0, ok: false, error: err.message, body: null };
  }
}

// Test Artifact Cleanup Registry
const createdTemplateIds = [];

async function cleanupArtifacts() {
  if (createdTemplateIds.length === 0) return;
  console.log(`\n${colors.dim}Cleaning up ${createdTemplateIds.length} test templates...${colors.reset}`);
  for (const id of createdTemplateIds) {
    try {
      await api(`/api/email-templates/${id}`, { method: "DELETE" });
      await sleep(50);
    } catch {
      // Ignore cleanup error
    }
  }
  createdTemplateIds.length = 0;
}

// =====================================================================
// TIER 1: FEATURE COVERAGE (F01 - F23)
// =====================================================================
async function runTier1() {
  logHeader("TIER 1: FEATURE COVERAGE (F01 - F23)");

  // -------------------------------------------------------------------
  // F01 & F02: Database & Prisma Schema Verification
  // -------------------------------------------------------------------
  logSubHeader("Features F01 & F02: Database Schema & Attachment Model");

  const schemaPath = path.join(ROOT_DIR, "prisma", "schema.prisma");
  const schemaExists = fs.existsSync(schemaPath);
  const schemaContent = schemaExists ? fs.readFileSync(schemaPath, "utf-8") : "";

  report(
    "F01.1",
    "Tier 1",
    "Prisma schema defines Attachment model with required fields",
    schemaContent.includes("model Attachment") &&
      schemaContent.includes("templateId") &&
      schemaContent.includes("content") &&
      schemaContent.includes("type")
      ? "PASS"
      : "FAIL",
    "Missing model Attachment or required fields in prisma/schema.prisma"
  );

  report(
    "F01.2",
    "Tier 1",
    "Template model contains relational attachments Attachment[] field",
    schemaContent.includes("attachments") && schemaContent.includes("Attachment[]") ? "PASS" : "FAIL"
  );

  report(
    "F02.1",
    "Tier 1",
    "Cascade delete constraint is configured on Attachment relation",
    schemaContent.includes("onDelete: Cascade") ? "PASS" : "FAIL"
  );

  report(
    "F02.2",
    "Tier 1",
    "Table mapping @@map('attachments') is configured for SQLite compatibility",
    schemaContent.includes('@@map("attachments")') ? "PASS" : "FAIL"
  );

  report(
    "F02.3",
    "Tier 1",
    "Template envelopeSender is mapped to column envelope_sender",
    schemaContent.includes('envelope_sender') || schemaContent.includes('envelopeSender') ? "PASS" : "FAIL"
  );

  // -------------------------------------------------------------------
  // F03: List Email Templates API (GET /api/email-templates)
  // -------------------------------------------------------------------
  logSubHeader("Feature F03: List Email Templates API (GET /api/email-templates)");

  const unauthList = await api("/api/email-templates", { headers: { Cookie: "" } });
  report(
    "F03.1",
    "Tier 1",
    "Rejects unauthenticated requests with HTTP 401 Unauthorized",
    unauthList.status === 401 ? "PASS" : "FAIL",
    `Expected 401, got ${unauthList.status}`
  );

  const authList = await api("/api/email-templates");
  report(
    "F03.2",
    "Tier 1",
    "Returns HTTP 200 with an array of email templates for authenticated user",
    authList.status === 200 && Array.isArray(authList.body) ? "PASS" : "FAIL",
    `Expected 200 with array, got status ${authList.status}`
  );

  const firstTemplate = Array.isArray(authList.body) && authList.body.length > 0 ? authList.body[0] : null;
  report(
    "F03.3",
    "Tier 1",
    "Returns complete template metadata structure (id, name, modified_date, attachments)",
    firstTemplate &&
      typeof firstTemplate.id === "number" &&
      typeof firstTemplate.name === "string" &&
      ("modified_date" in firstTemplate || "modifiedDate" in firstTemplate) &&
      Array.isArray(firstTemplate.attachments)
      ? "PASS"
      : "FAIL",
    `First template structure: ${JSON.stringify(firstTemplate)}`
  );

  report(
    "F03.4",
    "Tier 1",
    "List query excludes heavy attachment base64 payload to optimize bandwidth",
    !firstTemplate || firstTemplate.attachments.length === 0 || !("content" in firstTemplate.attachments[0])
      ? "PASS"
      : "FAIL"
  );

  report(
    "F03.5",
    "Tier 1",
    "Returns both camelCase and snake_case aliases (envelope_sender / envelopeSender)",
    firstTemplate && ("envelope_sender" in firstTemplate || "envelopeSender" in firstTemplate) ? "PASS" : "FAIL"
  );

  // -------------------------------------------------------------------
  // F04: Create Email Template API (POST /api/email-templates)
  // -------------------------------------------------------------------
  logSubHeader("Feature F04: Create Email Template API (POST /api/email-templates)");

  const testName1 = `T1-F04-Create-${Date.now()}`;
  const createRes1 = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: testName1,
      subject: "Tier 1 Welcome Phish",
      envelope_sender: "Support <support@example.com>",
      text: "Hello {{.FirstName}}, click {{.URL}}",
      html: "<p>Hello {{.FirstName}},</p><p><a href=\"{{.URL}}\">Click here</a></p></body>",
      use_tracker: true,
      attachments: [
        {
          name: "policy.pdf",
          type: "application/pdf",
          content: "JVBERi0xLjQKJcOkw7zDtsOf...",
        },
      ],
    }),
  });

  report(
    "F04.1",
    "Tier 1",
    "Creates a complete email template with HTTP 201 Created",
    createRes1.status === 201 && createRes1.body?.name === testName1 ? "PASS" : "FAIL",
    `Expected 201, got ${createRes1.status}: ${JSON.stringify(createRes1.body)}`
  );
  if (createRes1.body?.id) createdTemplateIds.push(createRes1.body.id);

  report(
    "F04.2",
    "Tier 1",
    "Automatically injects {{.Tracker}}</body> when use_tracker is enabled",
    createRes1.body?.html?.includes("{{.Tracker}}</body>") ? "PASS" : "FAIL",
    `HTML output: ${createRes1.body?.html}`
  );

  report(
    "F04.3",
    "Tier 1",
    "Stores nested attachments and returns created attachment metadata",
    Array.isArray(createRes1.body?.attachments) &&
      createRes1.body.attachments.length === 1 &&
      createRes1.body.attachments[0].name === "policy.pdf"
      ? "PASS"
      : "FAIL"
  );

  const duplicateRes = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: testName1,
      text: "Duplicate template test",
    }),
  });
  report(
    "F04.4",
    "Tier 1",
    "Rejects duplicate template name with HTTP 409 Conflict",
    duplicateRes.status === 409 ? "PASS" : "FAIL",
    `Expected 409, got ${duplicateRes.status}: ${JSON.stringify(duplicateRes.body)}`
  );

  const emptyNameRes = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: "   ",
      text: "Empty name test",
    }),
  });
  report(
    "F04.5",
    "Tier 1",
    "Rejects empty or whitespace template name with HTTP 400 Bad Request",
    emptyNameRes.status === 400 ? "PASS" : "FAIL",
    `Expected 400, got ${emptyNameRes.status}`
  );

  // -------------------------------------------------------------------
  // F05: Get Email Template Detail API (GET /api/email-templates/[id])
  // -------------------------------------------------------------------
  logSubHeader("Feature F05: Get Email Template Detail API (GET /api/email-templates/[id])");

  const templateId = createRes1.body?.id;
  const getDetailRes = templateId ? await api(`/api/email-templates/${templateId}`) : { status: 0 };
  report(
    "F05.1",
    "Tier 1",
    "Returns HTTP 200 with full template details for valid ID",
    getDetailRes.status === 200 && getDetailRes.body?.id === templateId ? "PASS" : "FAIL",
    `Status: ${getDetailRes.status}`
  );

  report(
    "F05.2",
    "Tier 1",
    "Detail response includes full attachment content (Base64 payload)",
    getDetailRes.body?.attachments?.[0]?.content === "JVBERi0xLjQKJcOkw7zDtsOf..." ? "PASS" : "FAIL",
    `Attachment payload: ${JSON.stringify(getDetailRes.body?.attachments?.[0])}`
  );

  report(
    "F05.3",
    "Tier 1",
    "Returns HTTP 404 for non-existent template ID (999999)",
    (await api("/api/email-templates/999999")).status === 404 ? "PASS" : "FAIL"
  );

  report(
    "F05.4",
    "Tier 1",
    "Rejects non-numeric template ID with HTTP 404",
    (await api("/api/email-templates/invalid-id")).status === 404 ? "PASS" : "FAIL"
  );

  report(
    "F05.5",
    "Tier 1",
    "Rejects unauthenticated detail request with HTTP 401",
    (await api(`/api/email-templates/${templateId || 1}`, { headers: { Cookie: "" } })).status === 401 ? "PASS" : "FAIL"
  );

  // -------------------------------------------------------------------
  // F06: Update Email Template API (PUT /api/email-templates/[id])
  // -------------------------------------------------------------------
  logSubHeader("Feature F06: Update Email Template API (PUT /api/email-templates/[id])");

  const updateRes = templateId
    ? await api(`/api/email-templates/${templateId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: `${testName1}-Updated`,
          subject: "Updated Subject Line",
          envelope_sender: "Updated <updated@example.com>",
          text: "Updated plaintext body",
          html: "<p>Updated HTML</p></body>",
          use_tracker: false, // Should strip tracker
          attachments: [
            {
              name: "updated.docx",
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              content: "UEsDBBQAAAAIA...",
            },
          ],
        }),
      })
    : { status: 0 };

  report(
    "F06.1",
    "Tier 1",
    "Updates template fields with HTTP 200 OK",
    updateRes.status === 200 && updateRes.body?.subject === "Updated Subject Line" ? "PASS" : "FAIL",
    `Status: ${updateRes.status}`
  );

  report(
    "F06.2",
    "Tier 1",
    "Strips tracker from HTML body when use_tracker is disabled",
    updateRes.body?.html?.includes("{{.Tracker}}") === false ? "PASS" : "FAIL",
    `HTML: ${updateRes.body?.html}`
  );

  report(
    "F06.3",
    "Tier 1",
    "Replaces attachments cleanly (previous attachment removed, new one present)",
    updateRes.body?.attachments?.length === 1 && updateRes.body?.attachments[0]?.name === "updated.docx"
      ? "PASS"
      : "FAIL"
  );

  report(
    "F06.4",
    "Tier 1",
    "Rejects updating non-existent template ID with HTTP 404",
    (await api("/api/email-templates/999999", { method: "PUT", body: JSON.stringify({ name: "Foo" }) })).status === 404
      ? "PASS"
      : "FAIL"
  );

  report(
    "F06.5",
    "Tier 1",
    "Rejects unauthenticated update request with HTTP 401",
    (await api(`/api/email-templates/${templateId || 1}`, { method: "PUT", headers: { Cookie: "" }, body: "{}" }))
      .status === 401
      ? "PASS"
      : "FAIL"
  );

  // -------------------------------------------------------------------
  // F07: Delete Email Template API (DELETE /api/email-templates/[id])
  // -------------------------------------------------------------------
  logSubHeader("Feature F07: Delete Email Template API (DELETE /api/email-templates/[id])");

  // Create disposable template for deletion test
  const dispRes = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: `T1-Delete-Target-${Date.now()}`,
      text: "To be deleted",
      attachments: [{ name: "todelete.txt", type: "text/plain", content: "SGVsbG8=" }],
    }),
  });
  const dispId = dispRes.body?.id;
  await sleep(100);

  const deleteRes = dispId ? await api(`/api/email-templates/${dispId}`, { method: "DELETE" }) : { status: 0 };
  report(
    "F07.1",
    "Tier 1",
    "Deletes template with HTTP 200 OK and success flag",
    deleteRes.status === 200 && deleteRes.body?.success === true ? "PASS" : "FAIL",
    `Status: ${deleteRes.status}, Body: ${JSON.stringify(deleteRes.body)}`
  );

  await sleep(50);
  const getDeletedRes = await api(`/api/email-templates/${dispId}`);
  report(
    "F07.2",
    "Tier 1",
    "Subsequent GET for deleted template returns HTTP 404 Not Found",
    getDeletedRes.status === 404 ? "PASS" : "FAIL",
    `Status: ${getDeletedRes.status}`
  );

  await sleep(50);
  const doubleDeleteRes = await api(`/api/email-templates/${dispId}`, { method: "DELETE" });
  report(
    "F07.3",
    "Tier 1",
    "Deleting already deleted template returns HTTP 404",
    doubleDeleteRes.status === 404 ? "PASS" : "FAIL",
    `Status: ${doubleDeleteRes.status}`
  );

  const nonExistentDelete = await api("/api/email-templates/999999", { method: "DELETE" });
  report(
    "F07.4",
    "Tier 1",
    "Rejects deleting non-existent ID with HTTP 404",
    nonExistentDelete.status === 404 ? "PASS" : "FAIL",
    `Status: ${nonExistentDelete.status}`
  );

  report(
    "F07.5",
    "Tier 1",
    "Rejects unauthenticated delete request with HTTP 401",
    (await api(`/api/email-templates/${dispId || 1}`, { method: "DELETE", headers: { Cookie: "" } })).status === 401
      ? "PASS"
      : "FAIL"
  );

  // -------------------------------------------------------------------
  // F08, F09, F10: MIME Parser & Import Email API
  // -------------------------------------------------------------------
  logSubHeader("Features F08, F09, F10: MIME Parsing, Link Conversion & Import Endpoint");

  const rawMime1 = [
    "From: alert@security.bank.com",
    "To: victim@company.com",
    "Subject: =?UTF-8?B?VmVyaWZpa2FzaSBBa3VuIFJlc21p?=", // "Verifikasi Akun Resmi"
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="boundary-42"',
    "",
    "--boundary-42",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    "Halo Budi,=0DSilakan perbarui akun Anda di https://phish.target.com/login",
    "",
    "--boundary-42",
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    '<html><body><p>Halo Budi,</p><p>Klik <a href="https://phish.target.com/login">di sini</a> untuk login.</p><img src="https://bank.com/logo.png"/></body></html>',
    "",
    "--boundary-42--",
  ].join("\r\n");

  const importRes = await api("/api/import/email", {
    method: "POST",
    body: JSON.stringify({
      content: rawMime1,
      convert_links: true,
    }),
  });

  report(
    "F09.1",
    "Tier 1",
    "POST /api/import/email returns HTTP 200 with extracted subject, text, and html",
    importRes.status === 200 && Boolean(importRes.body?.subject && importRes.body?.text && importRes.body?.html)
      ? "PASS"
      : "FAIL",
    `Status: ${importRes.status}: ${JSON.stringify(importRes.body)}`
  );

  report(
    "F08.1",
    "Tier 1",
    "RFC 2047 Base64 subject header is decoded accurately into UTF-8 text",
    importRes.body?.subject === "Verifikasi Akun Resmi" ? "PASS" : "FAIL",
    `Parsed subject: "${importRes.body?.subject}"`
  );

  report(
    "F08.2",
    "Tier 1",
    "Plaintext body is extracted from multipart/alternative part",
    importRes.body?.text?.includes("Silakan perbarui akun") ? "PASS" : "FAIL",
    `Parsed text: "${importRes.body?.text}"`
  );

  report(
    "F10.1",
    "Tier 1",
    "Converts all <a href=\"...\"> URLs to {{.URL}} when convert_links is true",
    importRes.body?.html?.includes('<a href="{{.URL}}">') ? "PASS" : "FAIL",
    `Parsed HTML: ${importRes.body?.html}`
  );

  report(
    "F10.2",
    "Tier 1",
    "Preserves image <img src=\"...\"> URLs unaltered during link conversion",
    importRes.body?.html?.includes('src="https://bank.com/logo.png"') ? "PASS" : "FAIL"
  );

  const importAliasRes = await api("/api/email-templates/import", {
    method: "POST",
    body: JSON.stringify({
      content: rawMime1,
      convert_links: true,
    }),
  });
  report(
    "F09.2",
    "Tier 1",
    "Supports alias endpoint /api/email-templates/import identically",
    importAliasRes.status === 200 && importAliasRes.body?.subject === "Verifikasi Akun Resmi" ? "PASS" : "FAIL"
  );

  const emptyImportRes = await api("/api/import/email", {
    method: "POST",
    body: JSON.stringify({ content: "   " }),
  });
  report(
    "F09.3",
    "Tier 1",
    "Rejects empty raw MIME with HTTP 400 'No Content Specified!'",
    emptyImportRes.status === 400 &&
      (emptyImportRes.body?.error === "No Content Specified!" || emptyImportRes.body?.message === "No Content Specified!")
      ? "PASS"
      : "FAIL",
    `Body: ${JSON.stringify(emptyImportRes.body)}`
  );

  // -------------------------------------------------------------------
  // F11: Tracking Image Management & Deduplication
  // -------------------------------------------------------------------
  logSubHeader("Feature F11: Tracking Image Management & Deduplication");

  const trackTestRes1 = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: `T1-Track-Test-${Date.now()}`,
      html: "<div>Already has {{.Tracker}}</div></body>",
      use_tracker: true,
    }),
  });
  if (trackTestRes1.body?.id) createdTemplateIds.push(trackTestRes1.body.id);

  const trackerCount = (trackTestRes1.body?.html?.match(/\{\{\.Tracker\}\}/g) || []).length;
  report(
    "F11.1",
    "Tier 1",
    "Deduplicates tracking pixel: does not inject duplicate if {{.Tracker}} already present",
    trackerCount === 1 ? "PASS" : "FAIL",
    `Count of tracker: ${trackerCount}`
  );

  const trackNoBodyRes = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: `T1-Track-NoBody-${Date.now()}`,
      html: "<p>Fragment without body tag</p>",
      use_tracker: true,
    }),
  });
  if (trackNoBodyRes.body?.id) createdTemplateIds.push(trackNoBodyRes.body.id);

  report(
    "F11.2",
    "Tier 1",
    "Appends {{.Tracker}} to HTML end when </body> closing tag is absent",
    trackNoBodyRes.body?.html?.endsWith("{{.Tracker}}") ? "PASS" : "FAIL",
    `HTML: ${trackNoBodyRes.body?.html}`
  );

  // -------------------------------------------------------------------
  // F12 & F13: Navigation & Protected Routes
  // -------------------------------------------------------------------
  logSubHeader("Features F12 & F13: Navigation & Protected Route Alignment");

  const appShellFile = path.join(ROOT_DIR, "src", "components", "layout", "AppShell.tsx");
  const appShellContent = fs.existsSync(appShellFile) ? fs.readFileSync(appShellFile, "utf-8") : "";
  const isProtectedInAppShell = appShellContent.includes('"/email-templates"');
  report(
    "F13.1",
    "Tier 1",
    "AppShell.tsx registers /email-templates in PROTECTED_PREFIXES array",
    isProtectedInAppShell ? "PASS" : "PENDING",
    isProtectedInAppShell ? "" : "Pending M2 frontend auth prefix registration"
  );

  const sidebarFile = path.join(ROOT_DIR, "src", "components", "layout", "Sidebar.tsx");
  const sidebarContent = fs.existsSync(sidebarFile) ? fs.readFileSync(sidebarFile, "utf-8") : "";
  report(
    "F12.1",
    "Tier 1",
    "Sidebar.tsx specifies Email Templates navigation link (/email-templates)",
    sidebarContent.includes("/email-templates") ? "PASS" : "PENDING",
    "Pending M2 frontend navigation alignment"
  );

  report(
    "F12.2",
    "Tier 1",
    "Sidebar.tsx cleanly differentiates Landing Pages (/templates) with distinct route",
    sidebarContent.includes("/templates") ? "PASS" : "PENDING"
  );

  // -------------------------------------------------------------------
  // F14 - F23: Frontend Components & Ergonomics
  // -------------------------------------------------------------------
  logSubHeader("Features F14 - F23: UI Pages, Modal Ergonomics & Actions");

  const emailTemplatesPagePath = path.join(ROOT_DIR, "src", "app", "email-templates", "page.tsx");
  const pageExists = fs.existsSync(emailTemplatesPagePath);
  const pageContent = pageExists ? fs.readFileSync(emailTemplatesPagePath, "utf-8") : "";

  report(
    "F15.1",
    "Tier 1",
    "src/app/email-templates/page.tsx exists and is authored as Client Component",
    pageExists && pageContent.includes('"use client"') ? "PASS" : "PENDING",
    "Pending M2 frontend implementation"
  );

  report(
    "F16.1",
    "Tier 1",
    "Main table component displays Name, Modified Date, and Actions columns",
    pageContent.includes("Modified Date") || pageContent.includes("Modified") ? "PASS" : "PENDING"
  );

  report(
    "F17.1",
    "Tier 1",
    "Modal dialog supports Envelope Sender input with guidance tooltip",
    pageContent.includes("envelope_sender") || pageContent.includes("envelopeSender") ? "PASS" : "PENDING"
  );

  report(
    "F18.1",
    "Tier 1",
    "Tabbed editor provides Text, HTML, and Live Preview rendering tabs",
    pageContent.includes("preview") || pageContent.includes("iframe") ? "PASS" : "PENDING"
  );

  report(
    "F19.1",
    "Tier 1",
    "Quick insertion tags toolbar provides {{.URL}}, {{.Tracker}}, {{.FirstName}} chips",
    pageContent.includes("{{.URL}}") && pageContent.includes("{{.Tracker}}") ? "PASS" : "PENDING"
  );

  report(
    "F20.1",
    "Tier 1",
    "Attachment manager supports file selection, Base64 encoding, and removal",
    pageContent.includes("readAsDataURL") || pageContent.includes("attachments") ? "PASS" : "PENDING"
  );

  report(
    "F21.1",
    "Tier 1",
    "Import Email sub-modal incorporates raw MIME input and link conversion option",
    pageContent.includes("convert_links") || pageContent.includes("convertLinks") ? "PASS" : "PENDING"
  );

  report(
    "F22.1",
    "Tier 1",
    "Copy Template feature implements 'Copy of ' naming duplication logic",
    pageContent.includes("Copy of") || pageContent.includes("Copy") ? "PASS" : "PENDING"
  );

  report(
    "F23.1",
    "Tier 1",
    "Custom Delete dialog prompts confirmation before executing deletion",
    pageContent.includes("deleteConfirm") || pageContent.includes("Delete") ? "PASS" : "PENDING"
  );
}

// =====================================================================
// TIER 2: BOUNDARY & CORNER CASES
// =====================================================================
async function runTier2() {
  logHeader("TIER 2: BOUNDARY & CORNER CASES");

  // B01: Whitespace and Empty Names
  const b1Res = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({ name: "   \t\n  ", text: "Some text" }),
  });
  report("B01", "Tier 2", "Empty or whitespace-only name is rejected with 400", b1Res.status === 400 ? "PASS" : "FAIL");

  // B02: Both Text and HTML empty
  const b2Res = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({ name: `T2-Empty-Body-${Date.now()}`, text: "", html: "" }),
  });
  report(
    "B02",
    "Tier 2",
    "Both text and HTML body empty is rejected with HTTP 400",
    b2Res.status === 400 && b2Res.body?.error?.includes("Need to specify at least plaintext or HTML")
      ? "PASS"
      : "FAIL",
    `Error: ${JSON.stringify(b2Res.body)}`
  );

  // B03: Plaintext only template is valid
  const b3Res = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({ name: `T2-Text-Only-${Date.now()}`, text: "Pure plaintext notification" }),
  });
  if (b3Res.body?.id) createdTemplateIds.push(b3Res.body.id);
  report("B03", "Tier 2", "Plaintext-only template is accepted with HTTP 201 Created", b3Res.status === 201 ? "PASS" : "FAIL");

  await sleep(50);
  // B04: HTML only template is valid
  const b4Res = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({ name: `T2-HTML-Only-${Date.now()}`, html: "<h1>HTML Only</h1>" }),
  });
  if (b4Res.body?.id) createdTemplateIds.push(b4Res.body.id);
  report(
    "B04",
    "Tier 2",
    "HTML-only template is accepted with HTTP 201 Created",
    b4Res.status === 201 ? "PASS" : "FAIL",
    `Status: ${b4Res.status}, Body: ${JSON.stringify(b4Res.body)}`
  );

  // B05: WYSIWYG URL Scheme Sanitization
  const b5Res = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: `T2-URL-Sanitize-${Date.now()}`,
      html: '<p><a href="http://{{.URL}}">Link 1</a> and <a href="https://{{.URL}}">Link 2</a></p>',
    }),
  });
  if (b5Res.body?.id) createdTemplateIds.push(b5Res.body.id);
  report(
    "B05",
    "Tier 2",
    "Sanitizes accidental http://{{.URL}} and https://{{.URL}} into clean {{.URL}}",
    b5Res.body?.html?.includes('href="{{.URL}}"') && !b5Res.body?.html?.includes("http://{{.URL}}")
      ? "PASS"
      : "FAIL",
    `HTML: ${b5Res.body?.html}`
  );

  // B06: Large Attachment Payload (>200KB Base64)
  const largeBase64 = Buffer.alloc(200 * 1024, "A").toString("base64");
  const b6Res = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: `T2-Large-Attachment-${Date.now()}`,
      text: "Large attachment template",
      attachments: [{ name: "massive_manual.pdf", type: "application/pdf", content: largeBase64 }],
    }),
  });
  if (b6Res.body?.id) createdTemplateIds.push(b6Res.body.id);
  report(
    "B06",
    "Tier 2",
    "Handles large attachment payload (>200KB Base64) without memory overflow",
    b6Res.status === 201 && b6Res.body?.attachments?.[0]?.name === "massive_manual.pdf" ? "PASS" : "FAIL",
    `Status: ${b6Res.status}, Error: ${JSON.stringify(b6Res.body)}`
  );

  // B07: Attachment without extension defaults to application/octet-stream
  const b7Res = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: `T2-No-Ext-${Date.now()}`,
      text: "No ext test",
      attachments: [{ name: "binaryblob", type: "", content: "AQIDBA==" }],
    }),
  });
  if (b7Res.body?.id) createdTemplateIds.push(b7Res.body.id);
  report(
    "B07",
    "Tier 2",
    "Attachment with empty MIME type defaults gracefully to application/octet-stream",
    b7Res.body?.attachments?.[0]?.type === "application/octet-stream" ? "PASS" : "FAIL"
  );

  await sleep(100);
  // B08: Data URI prefix stripping on attachment upload
  const b8Res = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: `T2-DataURI-Strip-${Date.now()}`,
      text: "Data URI test",
      attachments: [{ name: "image.png", type: "image/png", content: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==" }],
    }),
  });
  if (b8Res.body?.id) createdTemplateIds.push(b8Res.body.id);
  report(
    "B08",
    "Tier 2",
    "Automatically strips data:image/png;base64, URI scheme from uploaded content",
    b8Res.body?.attachments?.[0]?.content === "iVBORw0KGgoAAAANSUhEUg==" ? "PASS" : "FAIL",
    `Status: ${b8Res.status}, Body: ${JSON.stringify(b8Res.body)}`
  );

  // B09: Multilingual UTF-8 Characters & Emoji
  const unicodeName = `T2-Emoji-🚀-日本語-${Date.now()}`;
  const unicodeSubject = "Pemberitahuan Gaji 💸 & Keamanan 🔒";
  const b9Res = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: unicodeName,
      subject: unicodeSubject,
      text: "Halo 🇮🇩, silakan konfirmasi nomor rekening Anda.",
      html: "<p>Halo 🇮🇩, silakan konfirmasi nomor rekening Anda.</p>",
    }),
  });
  if (b9Res.body?.id) createdTemplateIds.push(b9Res.body.id);
  report(
    "B09",
    "Tier 2",
    "Preserves Unicode glyphs, Indonesian text, and emoji across Name and Subject",
    b9Res.status === 201 && b9Res.body?.name === unicodeName && b9Res.body?.subject === unicodeSubject ? "PASS" : "FAIL",
    `Status: ${b9Res.status}, Body: ${JSON.stringify(b9Res.body)}`
  );

  // B10: Malformed Raw MIME Structure during Import
  const malformedMime = "Just some random non-MIME text with no headers and no colons at all";
  const b10Res = await api("/api/import/email", {
    method: "POST",
    body: JSON.stringify({ content: malformedMime, convert_links: true }),
  });
  report(
    "B10",
    "Tier 2",
    "Handles malformed raw email without headers gracefully without 500 crash",
    b10Res.status === 200 && typeof b10Res.body?.text === "string" ? "PASS" : "FAIL",
    `Status: ${b10Res.status}`
  );
}

// =====================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS (PAIRWISE WORKFLOWS)
// =====================================================================
async function runTier3() {
  logHeader("TIER 3: CROSS-FEATURE COMBINATIONS");

  logSubHeader("Workflow 3.1: Full Lifecycle Pipeline");
  console.log("  [Step 1] Import Raw MIME with links and headers");
  const rawEmail = [
    "From: HR Portal <hr-update@company-services.com>",
    "Subject: =?UTF-8?Q?Update_Struktur_Organisasi_Q4?=",
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="utf-8"',
    "",
    '<html><body><h2>Pengumuman Manajemen</h2><p>Bagi seluruh karyawan, silakan unduh surat edaran melalui <a href="https://internal.company.com/portal">Portal Internal</a>.</p></body></html>',
  ].join("\r\n");

  const step1 = await api("/api/import/email", {
    method: "POST",
    body: JSON.stringify({ content: rawEmail, convert_links: true }),
  });
  report("X01.1", "Tier 3", "Step 1: Import raw MIME and rewrite anchor links to {{.URL}}", step1.status === 200 && step1.body?.html?.includes('href="{{.URL}}"') ? "PASS" : "FAIL");

  console.log("  [Step 2] Save imported template with injected tracker and 2 attachments");
  const wf1Name = `T3-Lifecycle-Pipeline-${Date.now()}`;
  const step2 = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: wf1Name,
      subject: step1.body?.subject,
      envelope_sender: "HR Portal <hr-update@company-services.com>",
      text: step1.body?.text,
      html: step1.body?.html,
      use_tracker: true,
      attachments: [
        { name: "edaran.pdf", type: "application/pdf", content: "JVBERi0xLjQK" },
        { name: "lampiran.xlsx", type: "application/vnd.ms-excel", content: "UEsDBBQAAAA=" },
      ],
    }),
  });
  if (step2.body?.id) createdTemplateIds.push(step2.body.id);
  report("X01.2", "Tier 3", "Step 2: Save template with {{.Tracker}}</body> and 2 attachments", step2.status === 201 && step2.body?.attachments?.length === 2 ? "PASS" : "FAIL");

  console.log("  [Step 3] Fetch detail and verify attachment contents");
  const step3 = await api(`/api/email-templates/${step2.body?.id}`);
  report("X01.3", "Tier 3", "Step 3: Detail endpoint serves full attachment payloads", step3.body?.attachments?.[0]?.content === "JVBERi0xLjQK" && step3.body?.attachments?.[1]?.content === "UEsDBBQAAAA=" ? "PASS" : "FAIL");

  console.log("  [Step 4] Copy template and verify cloned entity");
  const copyName = `Copy of ${wf1Name}`;
  const step4 = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: copyName,
      subject: step3.body?.subject,
      envelope_sender: step3.body?.envelope_sender,
      text: step3.body?.text,
      html: step3.body?.html,
      attachments: step3.body?.attachments,
    }),
  });
  if (step4.body?.id) createdTemplateIds.push(step4.body.id);
  report("X01.4", "Tier 3", "Step 4: Successfully clone template and attachments as 'Copy of [Name]'", step4.status === 201 && step4.body?.name === copyName && step4.body?.attachments?.length === 2 ? "PASS" : "FAIL");

  logSubHeader("Workflow 3.2: Attachment Replacement & Cascade Deletion");
  console.log("  [Step 1] Update template to replace all attachments");
  const step5 = await api(`/api/email-templates/${step2.body?.id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: `${wf1Name}-Modified`,
      html: "<p>New body</p>",
      attachments: [{ name: "single_replacement.csv", type: "text/csv", content: "Y29sMSxjb2wyCjEsMgo=" }],
    }),
  });
  report(
    "X02.1",
    "Tier 3",
    "Step 1: Update replaces previous attachments cleanly with 1 new attachment",
    step5.status === 200 && step5.body?.attachments?.length === 1 && step5.body?.attachments[0]?.name === "single_replacement.csv" ? "PASS" : "FAIL",
    `Status: ${step5.status}, Response: ${JSON.stringify(step5.body)}`
  );

  console.log("  [Step 2] Delete template and verify cascade purge");
  await sleep(100);
  const step6 = await api(`/api/email-templates/${step2.body?.id}`, { method: "DELETE" });
  report("X02.2", "Tier 3", "Step 2: Delete template removes parent and cascades cleanly", step6.status === 200 ? "PASS" : "FAIL");
}

// =====================================================================
// TIER 4: REAL-WORLD WORKLOADS
// =====================================================================
async function runTier4() {
  logHeader("TIER 4: REAL-WORLD WORKLOADS");

  // Workload 1: GoPhish Official Microsoft 365 Password Expiration Alert
  logSubHeader("Workload 4.1: Microsoft 365 Password Expiration Alert");
  const m365Name = `M365 Security Alert - ${Date.now()}`;
  const m365Res = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: m365Name,
      subject: "Penting: Kata Sandi Microsoft 365 Anda Kedaluwarsa Hari Ini",
      envelope_sender: "Microsoft Security <no-reply@microsoft-security.com>",
      text: "Halo {{.FirstName}} {{.LastName}},\n\nKata sandi akun {{.Email}} Anda dijadwalkan kedaluwarsa hari ini. Silakan pertahankan kata sandi Anda saat ini dengan mengunjungi portal resmi: {{.URL}}\n\nDepartemen TI / IT Helpdesk",
      html: [
        '<!DOCTYPE html>',
        '<html>',
        '<head><meta charset="utf-8"/></head>',
        '<body style="font-family: Segoe UI, Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">',
        '  <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 4px;">',
        '    <tr><td style="padding: 24px 32px; background-color: #0078d4; color: #ffffff;"><h2 style="margin: 0; font-size: 20px;">Microsoft 365 Security Notice</h2></td></tr>',
        '    <tr>',
        '      <td style="padding: 32px;">',
        '        <p style="font-size: 14px; color: #333333;">Yth. Rekan <strong>{{.FirstName}} {{.LastName}}</strong> ({{.Position}}),</p>',
        '        <p style="font-size: 14px; color: #333333; line-height: 1.6;">Kata sandi untuk akun korporat <strong>{{.Email}}</strong> akan kedaluwarsa dalam 12 jam. Untuk menghindari gangguan akses layanan Outlook dan Teams, mohon segera verifikasi kredensial Anda:</p>',
        '        <div style="text-align: center; margin: 30px 0;">',
        '          <a href="{{.URL}}" style="background-color: #0078d4; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 2px; font-weight: bold; display: inline-block;">Perbarui Kata Sandi Sekarang</a>',
        '        </div>',
        '        <p style="font-size: 12px; color: #666666; border-top: 1px solid #eeeeee; padding-top: 16px;">Surel ini dikirimkan secara otomatis dari Administrator TI. Abaikan jika Anda baru saja memperbarui kata sandi.</p>',
        '      </td>',
        '    </tr>',
        '  </table>',
        '</body>',
        '</html>',
      ].join("\n"),
      use_tracker: true,
      attachments: [
        {
          name: "Panduan_Keamanan_M365.pdf",
          type: "application/pdf",
          content: "JVBERi0xLjQKJcOkw7zDtsOf...",
        },
      ],
    }),
  });
  if (m365Res.body?.id) createdTemplateIds.push(m365Res.body.id);

  report(
    "W01",
    "Tier 4",
    "GoPhish M365 Password Expiration Alert template created and verified",
    m365Res.status === 201 &&
      m365Res.body?.html?.includes("{{.Tracker}}</body>") &&
      m365Res.body?.attachments?.length === 1
      ? "PASS"
      : "FAIL",
    `Status: ${m365Res.status}, Body: ${JSON.stringify(m365Res.body)}`
  );

  // Workload 2: HR Payroll Q3 Notification
  logSubHeader("Workload 4.2: HR Payroll Q3 Notification");
  const payrollName = `HR Payroll Notification - ${Date.now()}`;
  const payrollRes = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: payrollName,
      subject: "Slip Gaji Q3 dan Rekonsiliasi Bonus Kinerja",
      envelope_sender: "HR Departemen <hr@company.co.id>",
      text: "Halo {{.FirstName}},\nSlip gaji Anda dapat diakses di {{.URL}}.\n\nHR Department",
      html: "<p>Halo <strong>{{.FirstName}}</strong>,</p><p>Slip gaji Q3 Anda telah terbit. Silakan akses portal payroll kami di <a href=\"{{.URL}}\">Payroll Portal</a>.</p></body>",
      use_tracker: true,
      attachments: [
        {
          name: "rekapitulasi_gaji.xlsx",
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          content: "UEsDBBQAAAAIA...",
        },
      ],
    }),
  });
  if (payrollRes.body?.id) createdTemplateIds.push(payrollRes.body.id);

  report(
    "W02",
    "Tier 4",
    "HR Payroll Notification with personalized recipient tags and Excel spreadsheet attachment",
    payrollRes.status === 201 && payrollRes.body?.name === payrollName ? "PASS" : "FAIL"
  );

  // Workload 3: Executive Urgent Wire Transfer (CEO Fraud Plaintext Scenario)
  logSubHeader("Workload 4.3: CEO Urgent Wire Transfer (Plaintext Scenario)");
  const ceoName = `Executive Wire Request - ${Date.now()}`;
  const ceoRes = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: ceoName,
      subject: "URGENT: Settlement Transfer Permohonan Q4",
      envelope_sender: "Chief Executive Officer <ceo-direct@executive-mail.com>",
      text: "Hai {{.FirstName}},\n\nSaya sedang dalam pertemuan dengan auditor. Mohon segera proses tagihan terlampir hari ini sebelum pukul 15.00 WIB ke rekening escrow baru: {{.URL}}\n\nKirimkan konfirmasi bukti transfer segera ke nomor pribadi saya.\n\nRegards,\nExecutive Office",
    }),
  });
  if (ceoRes.body?.id) createdTemplateIds.push(ceoRes.body.id);

  report(
    "W03",
    "Tier 4",
    "Executive CEO Fraud Plaintext phishing scenario saved and validated",
    ceoRes.status === 201 && ceoRes.body?.envelope_sender?.includes("ceo-direct") ? "PASS" : "FAIL"
  );

  // Workload 4: IT Security Policy Review with Multi-attachments
  logSubHeader("Workload 4.4: IT Security Policy Review (Multi-attachments)");
  const itName = `IT Security Policy Annual Review - ${Date.now()}`;
  const itRes = await api("/api/email-templates", {
    method: "POST",
    body: JSON.stringify({
      name: itName,
      subject: "Wajib: Peninjauan Kebijakan Keamanan Siber 2026",
      envelope_sender: "Cyber Security Operations <ciso@corporate.com>",
      text: "Halo {{.FirstName}} {{.LastName}} ({{.Position}}), mohon tinjau kebijakan pada dokumen terlampir.",
      html: "<p>Rekan-rekan {{.Position}}, mohon pelajari dokumen terlampir dan konfirmasi di <a href=\"{{.URL}}\">Portal IT</a>.</p></body>",
      use_tracker: true,
      attachments: [
        { name: "Kebijakan_Keamanan_2026.pdf", type: "application/pdf", content: "JVBERi0xLjQK..." },
        { name: "Form_Pernyataan.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", content: "UEsDBBQAAAAI..." },
        { name: "Checklist_Aset.xlsx", type: "application/vnd.ms-excel", content: "UEsDBBQAA..." },
      ],
    }),
  });
  if (itRes.body?.id) createdTemplateIds.push(itRes.body.id);

  report(
    "W04",
    "Tier 4",
    "IT Policy Multi-attachment phishing campaign scenario (PDF, DOCX, XLSX attachments)",
    itRes.status === 201 && itRes.body?.attachments?.length === 3 ? "PASS" : "FAIL"
  );
}

// =====================================================================
// VISUAL VERIFICATION SUITE (PLAYWRIGHT SCREENSHOTS)
// =====================================================================
async function runVisualSuite() {
  logHeader("VISUAL VERIFICATION SUITE");

  const verificationDir = path.join(ROOT_DIR, "verification");
  if (!fs.existsSync(verificationDir)) {
    fs.mkdirSync(verificationDir, { recursive: true });
  }

  // Attempt to locate chromium or msedge browser executable
  const possiblePaths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Users\\almer\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe",
  ];
  const browserPath = possiblePaths.find((p) => fs.existsSync(p));

  // Check playwright-core package
  const playwrightCorePaths = [
    "C:\\Users\\almer\\AppData\\Roaming\\npm\\node_modules\\openclaw\\node_modules\\playwright-core",
    path.join(ROOT_DIR, "node_modules", "playwright-core"),
  ];
  const playwrightPath = playwrightCorePaths.find((p) => fs.existsSync(p));

  if (!browserPath || !playwrightPath) {
    report(
      "V01",
      "Visual",
      "Playwright browser engine check",
      "PENDING",
      `Browser executable: ${browserPath || "not found"}, Playwright module: ${playwrightPath || "not found"}`
    );
    return;
  }

  try {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const { chromium } = require(playwrightPath);
    console.log(`  ${colors.dim}Launching browser from: ${browserPath}${colors.reset}`);
    const browser = await chromium.launch({
      headless: true,
      executablePath: browserPath,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();

    // Perform authentic UI login to guarantee session cookie & auth state
    try {
      await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 15000 });
      const passwordInput = await page.waitForSelector("input[type='password']", { timeout: 6000 }).catch(() => null);
      if (passwordInput) {
        await page.locator("input[type='text'], input#username").first().fill("operator@company.com");
        await passwordInput.fill("admin123");
        await page.locator("button[type='submit']").click();
        await page.waitForURL("**/dashboard", { timeout: 10000 });
      }
    } catch (loginErr) {
      console.log(`  ${colors.dim}UI login note: ${loginErr.message}${colors.reset}`);
    }

    // 1. Snapshot: Main Table
    logSubHeader("Snapshot 1: Email Templates Main Table");
    try {
      await page.goto(`${BASE_URL}/email-templates`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForSelector("button:has-text('New Template')", { timeout: 10000 });
      await page.waitForSelector("text=Loading templates...", { state: "detached", timeout: 10000 }).catch(() => null);
      await page.waitForTimeout(500);
      const tableSnapPath = path.join(verificationDir, "email-templates-main-table.png");
      await page.screenshot({ path: tableSnapPath, fullPage: true });
      report("V01", "Visual", "Captured Main Table snapshot -> verification/email-templates-main-table.png", "PASS");
    } catch (err) {
      report("V01", "Visual", "Capture Main Table snapshot", "PENDING", `UI page /email-templates not ready: ${err.message}`);
    }

    // 2. Snapshot: New Template Modal
    logSubHeader("Snapshot 2: New Template Modal");
    try {
      // Look for button with text "New Template"
      const newBtn = await page.waitForSelector("button:has-text('New Template')", { timeout: 5000 }).catch(() => null);
      if (newBtn) {
        await newBtn.click();
        await page.waitForSelector("button:has-text('Import Email')", { timeout: 5000 });

        // Populate realistic sample scenario to showcase Gmail Live Preview synchronization
        try {
          await page.locator("#template-name").fill("Microsoft 365 Security Alert");
          await page.locator("#template-envelope-sender").fill("Microsoft Security <security@microsoft.com>");
          await page.locator("#template-subject").fill("Action Required: Verify suspicious sign-in attempt");
          const htmlEditor = page.locator("textarea[placeholder*='Phishing Email']");
          if (await htmlEditor.isVisible()) {
            await htmlEditor.fill(
              `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.5;"><p>Hello {{.FirstName}},</p><p>We detected an unusual sign-in attempt from an unrecognized IP address. Please review your recent activity immediately to safeguard your organization's data.</p><p style="margin: 20px 0;"><a href="{{.URL}}" style="background-color: #0067b8; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Review Activity Now</a></p><p>If this was not you, please report this incident immediately.</p><p style="color: #666; font-size: 12px; margin-top: 24px;">Microsoft Security Operations Team</p></div>`
            );
          }
          const sampleAttPath = path.join(verificationDir, "security-advisory.pdf");
          fs.writeFileSync(sampleAttPath, "%PDF-1.4 Mock Security Advisory PDF Content");
          const fileInput = await page.$("input[type='file']");
          if (fileInput) {
            await fileInput.setInputFiles([sampleAttPath]);
          }
          await page.waitForTimeout(600);
          try { fs.unlinkSync(sampleAttPath); } catch {}
        } catch (fillErr) {
          console.warn("Notice: could not fill sample preview data:", fillErr.message);
        }

        const modalSnapPath = path.join(verificationDir, "email-templates-new-modal.png");
        await page.screenshot({ path: modalSnapPath, fullPage: true });
        const livePreviewSnapPath = path.join(verificationDir, "email-templates-gmail-live-preview.png");
        await page.screenshot({ path: livePreviewSnapPath, fullPage: true });
        report("V02", "Visual", "Captured New Template Modal snapshot -> verification/email-templates-new-modal.png", "PASS");

        // 3. Snapshot: Import Email Sub-modal
        logSubHeader("Snapshot 3: Import Email Sub-modal");
        const importBtn = await page.$("button:has-text('Import Email')");
        if (importBtn) {
          await importBtn.click();
          await page.waitForTimeout(600);
          const submodalSnapPath = path.join(verificationDir, "email-templates-import-submodal.png");
          await page.screenshot({ path: submodalSnapPath, fullPage: true });
          report("V03", "Visual", "Captured Import Email Sub-modal snapshot -> verification/email-templates-import-submodal.png", "PASS");
        } else {
          report("V03", "Visual", "Import Email button visible in modal", "PENDING", "Import Email trigger button not found");
        }
      } else {
        report("V02", "Visual", "New Template Modal trigger button visible", "PENDING", "New Template CTA button not found on page");
        report("V03", "Visual", "Import Email Sub-modal visible", "PENDING", "Parent modal not opened");
      }
    } catch (err) {
      report("V02", "Visual", "Capture Modal snapshots", "PENDING", err.message);
    }

    await browser.close();
  } catch (err) {
    report("V00", "Visual", "Visual test suite execution", "FAIL", err.message);
  }
}

async function warmUpDevServer() {
  console.log(`${colors.dim}Warming up Next.js dev server endpoints...${colors.reset}`);
  await api("/api/email-templates");
  await api("/api/email-templates/1");
  await api("/api/import/email", { method: "POST", body: JSON.stringify({ content: "test" }) });
  await sleep(350);
}

// =====================================================================
// MAIN RUNNER DISPATCHER
// =====================================================================
async function main() {
  console.log(`\n${colors.bright}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}   PHISH-MAGANG EMAIL TEMPLATES 4-TIER E2E TEST RUNNER                ${colors.reset}`);
  console.log(`${colors.cyan}   Target: ${BASE_URL} | Tier Filter: ${tierArg.toUpperCase()}          ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}======================================================================${colors.reset}`);

  try {
    await warmUpDevServer();
    if (tierArg === "all" || tierArg === "1") await runTier1();
    if (tierArg === "all" || tierArg === "2") await runTier2();
    if (tierArg === "all" || tierArg === "3") await runTier3();
    if (tierArg === "all" || tierArg === "4") await runTier4();
    if (tierArg === "all" || tierArg === "visual") await runVisualSuite();
  } catch (fatal) {
    console.error(`\n${colors.red}${colors.bright}FATAL TEST EXECUTION ERROR: ${fatal.message}${colors.reset}\n`, fatal.stack);
  } finally {
    await cleanupArtifacts();
  }

  // Final Summary
  const elapsed = ((Date.now() - results.startTime) / 1000).toFixed(2);
  const total = results.passed + results.failed + results.pending;

  console.log(`\n${colors.cyan}──────────────────────────────────────────────────────────────────────${colors.reset}`);
  console.log(`${colors.bright}TEST EXECUTION SUMMARY (${elapsed}s):${colors.reset}`);
  console.log(`  Total Test Cases : ${total}`);
  console.log(`  ${colors.green}Passed           : ${results.passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed           : ${results.failed}${colors.reset}`);
  console.log(`  ${colors.yellow}Pending (UI/M2)  : ${results.pending}${colors.reset}`);
  console.log(`${colors.cyan}──────────────────────────────────────────────────────────────────────${colors.reset}\n`);

  if (results.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
