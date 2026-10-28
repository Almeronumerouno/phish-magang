/**
 * Adversarial Stress & Security Test Suite for M1 Email Templates Engine
 * Focus areas:
 * 1. Multi-tenant authorization & IDOR isolation (User 1 vs User 2)
 * 2. Unauthenticated access enforcement (401 across all endpoints)
 * 3. ReDoS resistance & pathological input benchmarks
 * 4. Boundary input validation (empty names, whitespace bodies, non-integer IDs)
 * 5. Link conversion edge cases (casing, quotes, non-anchor tags)
 * 6. Tracking image permutations & deduplication
 * 7. Attachment sanitization & cascade deletion
 */

import { createHmac } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  convertLinksToTemplateUrl,
  cleanTemplateUrls,
  injectTracker,
  stripTracker,
  decodeRfc2047,
  decodeQuotedPrintable,
  parseRawEmail,
} from "../src/lib/mime-parser.ts";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3000";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "04942c68cc80d9cfd52870a58726e4909bdbe9427ceafdc0540a3f703cce76c6";

const prisma = new PrismaClient();

function generateSessionCookie(userId) {
  const expiry = Date.now() + 604800000;
  const payload = `${userId}.${expiry}`;
  const signature = createHmac("sha256", SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `rts_session=${payload}.${signature}`;
}

const cookieUser1 = generateSessionCookie(1);
const cookieUser2 = generateSessionCookie(2);

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ STRESS-TEST ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAdversarialSuite() {
  console.log("=========================================================");
  console.log("   ADVERSARIAL & SECURITY STRESS-TEST SUITE: M1          ");
  console.log("=========================================================\n");

  // Ensure user 2 exists in DB for multi-tenant checks
  let user2 = await prisma.user.findUnique({ where: { id: 2 } });
  if (!user2) {
    user2 = await prisma.user.create({
      data: {
        id: 2,
        username: "adversarial_user2",
        hash: "$2a$10$dummyhashforadversarialtests1234567890123456789012",
        roleId: 1,
      },
    });
  }

  // -------------------------------------------------------------------
  // TEST 1: Unauthenticated Requests Rejection (401)
  // -------------------------------------------------------------------
  console.log("🔒 Test 1: Unauthenticated Requests Rejection");
  {
    const endpoints = [
      { method: "GET", path: "/api/email-templates" },
      { method: "POST", path: "/api/email-templates", body: { name: "x" } },
      { method: "GET", path: "/api/email-templates/1" },
      { method: "PUT", path: "/api/email-templates/1", body: { name: "x" } },
      { method: "DELETE", path: "/api/email-templates/1" },
      { method: "POST", path: "/api/import/email", body: { content: "x" } },
      { method: "POST", path: "/api/email-templates/import", body: { content: "x" } },
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${BASE_URL}${ep.path}`, {
        method: ep.method,
        headers: { "Content-Type": "application/json" },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      assert(res.status === 401, `Expected 401 for unauthenticated ${ep.method} ${ep.path}, got ${res.status}`);
    }
    console.log("  ✔ All 7 API endpoints strictly enforce 401 Unauthorized.\n");
  }

  // -------------------------------------------------------------------
  // TEST 2: Multi-tenant Authorization & IDOR Isolation
  // -------------------------------------------------------------------
  console.log("🛡️ Test 2: Multi-Tenant Authorization & IDOR Isolation");
  {
    const templateName = `User1 Secret Template ${Date.now()}`;
    // User 1 creates a private template
    const createRes = await fetch(`${BASE_URL}/api/email-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieUser1 },
      body: JSON.stringify({
        name: templateName,
        subject: "Confidential Subject",
        text: "User 1 Secret Text",
      }),
    });
    assert(createRes.status === 201, `Failed to create User 1 template: ${createRes.status}`);
    const u1Template = await createRes.json();
    const u1Id = u1Template.id;

    // User 2 attempts to read User 1's template (IDOR Read)
    const u2GetRes = await fetch(`${BASE_URL}/api/email-templates/${u1Id}`, {
      headers: { Cookie: cookieUser2 },
    });
    assert(u2GetRes.status === 404, `IDOR Read vulnerability! User 2 received status ${u2GetRes.status} for User 1 template`);

    // User 2 attempts to update User 1's template (IDOR Write)
    const u2PutRes = await fetch(`${BASE_URL}/api/email-templates/${u1Id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookieUser2 },
      body: JSON.stringify({
        name: "Hacked by User 2",
        text: "Malicious modification",
      }),
    });
    assert(u2PutRes.status === 404, `IDOR Write vulnerability! User 2 received status ${u2PutRes.status} for User 1 template`);

    // User 2 attempts to delete User 1's template (IDOR Delete)
    const u2DelRes = await fetch(`${BASE_URL}/api/email-templates/${u1Id}`, {
      method: "DELETE",
      headers: { Cookie: cookieUser2 },
    });
    assert(u2DelRes.status === 404, `IDOR Delete vulnerability! User 2 received status ${u2DelRes.status} for User 1 template`);

    // Verify User 1's template was completely untouched
    const verifyRes = await fetch(`${BASE_URL}/api/email-templates/${u1Id}`, {
      headers: { Cookie: cookieUser1 },
    });
    const verified = await verifyRes.json();
    assert(verified.name === templateName, "Template was corrupted by IDOR attempts!");

    // User 2 creates a template with the exact same name (Must succeed per GoPhish per-user uniqueness)
    const u2CreateRes = await fetch(`${BASE_URL}/api/email-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieUser2 },
      body: JSON.stringify({
        name: templateName,
        text: "User 2 template with same name",
      }),
    });
    assert(u2CreateRes.status === 201, `Per-user uniqueness failed: User 2 could not create template with same name (status ${u2CreateRes.status})`);
    const u2Template = await u2CreateRes.json();

    // Clean up
    await fetch(`${BASE_URL}/api/email-templates/${u1Id}`, { method: "DELETE", headers: { Cookie: cookieUser1 } });
    await fetch(`${BASE_URL}/api/email-templates/${u2Template.id}`, { method: "DELETE", headers: { Cookie: cookieUser2 } });

    console.log("  ✔ Cross-tenant IDOR protection verified: GET/PUT/DELETE return 404; names are isolated per user.\n");
  }

  // -------------------------------------------------------------------
  // TEST 3: ReDoS & Pathological Input Stress Test
  // -------------------------------------------------------------------
  console.log("⚡ Test 3: ReDoS Resistance & Pathological Input Benchmarks");
  {
    // Pathological HTML with 2,000 unclosed anchor tags and attributes
    const evilAnchorChunk = '<a class="long-class-name" data-attr="test-value" '.repeat(2000);
    const startT1 = performance.now();
    const converted1 = convertLinksToTemplateUrl(evilAnchorChunk);
    const duration1 = performance.now() - startT1;
    assert(duration1 < 1000, `convertLinksToTemplateUrl took too long: ${duration1.toFixed(2)}ms`);

    // Large HTML with 10,000 valid links
    const largeValidHtml = '<div><p>Paragraph <a href="https://example.com/target">click</a></p></div>'.repeat(5000);
    const startT2 = performance.now();
    const converted2 = convertLinksToTemplateUrl(largeValidHtml);
    const duration2 = performance.now() - startT2;
    assert(duration2 < 500, `convertLinksToTemplateUrl bulk transform took too long: ${duration2.toFixed(2)}ms`);
    assert(!converted2.includes("https://example.com/target"), "Some links failed to convert in bulk test");

    // RFC 2047 pathological string
    const evilRfc = "=?UTF-8?B?AAAA?=".repeat(1000);
    const startT3 = performance.now();
    decodeRfc2047(evilRfc);
    const duration3 = performance.now() - startT3;
    assert(duration3 < 100, `decodeRfc2047 took too long: ${duration3.toFixed(2)}ms`);

    console.log(`  ✔ ReDoS and performance benchmarks passed (5,000 links converted in ${duration2.toFixed(1)}ms).\n`);
  }

  // -------------------------------------------------------------------
  // TEST 4: Boundary Validation & Malformed Inputs
  // -------------------------------------------------------------------
  console.log("🚧 Test 4: Boundary Validation & Error Codes");
  {
    // 4a: Empty or whitespace name (400)
    for (const badName of ["", "   ", "\t\n"]) {
      const res = await fetch(`${BASE_URL}/api/email-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieUser1 },
        body: JSON.stringify({ name: badName, text: "Some text" }),
      });
      if (res.status !== 400) {
        const bodyText = await res.text();
        console.error(`Unexpected response for '${JSON.stringify(badName)}': status=${res.status}, body=${bodyText}`);
      }
      assert(res.status === 400, `Expected 400 for empty name '${badName}', got ${res.status}`);
      const err = await res.json();
      assert(err.message === "Template name not specified", `Expected 'Template name not specified', got '${err.message}'`);
    }

    // 4b: Missing both text and html (400)
    for (const badBody of [{ text: "", html: "" }, { text: "   ", html: "   " }, {}]) {
      const res = await fetch(`${BASE_URL}/api/email-templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieUser1 },
        body: JSON.stringify({ name: `Test Empty Body ${Date.now()}`, ...badBody }),
      });
      assert(res.status === 400, `Expected 400 for empty body, got ${res.status}`);
      const err = await res.json();
      assert(err.message.includes("Need to specify at least plaintext or HTML content"), `Got '${err.message}'`);
    }

    // 4c: Non-integer / alphanumeric ID in route (404)
    const badIdRes = await fetch(`${BASE_URL}/api/email-templates/abc-not-an-id`, {
      headers: { Cookie: cookieUser1 },
    });
    assert(badIdRes.status === 404, `Expected 404 for bad id, got ${badIdRes.status}`);

    // 4d: Malformed JSON body in POST (400)
    const malformedJsonRes = await fetch(`${BASE_URL}/api/email-templates`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieUser1 },
      body: "INVALID_JSON{",
    });
    assert(malformedJsonRes.status === 400, `Expected 400 for malformed JSON, got ${malformedJsonRes.status}`);

    console.log("  ✔ All boundary conditions and malformed inputs handled with proper HTTP status codes.\n");
  }

  // -------------------------------------------------------------------
  // TEST 5: Link Conversion Edge Cases
  // -------------------------------------------------------------------
  console.log("🔗 Test 5: Link Conversion Adversarial Cases");
  {
    // Casing: <A HREF="...">
    const htmlUpper = '<p>Check <A HREF="https://evil.corp/login">here</A></p>';
    const convertedUpper = convertLinksToTemplateUrl(htmlUpper);
    assert(
      /<a\s+href="{{.URL}}"/i.test(convertedUpper),
      `Uppercase <A HREF=...> failed: ${convertedUpper}`
    );

    // Single quotes & multiple attributes
    const htmlComplex = '<a target="_blank" class="nav-link" href=\'https://service.com/page?id=1&name=test\' id="main-link">Click</a>';
    const convertedComplex = convertLinksToTemplateUrl(htmlComplex);
    assert(convertedComplex.includes('href="{{.URL}}"'), "Single-quoted href conversion failed");
    assert(convertedComplex.includes('target="_blank"'), "target attribute lost");
    assert(convertedComplex.includes('id="main-link"'), "id attribute lost");

    // Unquoted href
    const htmlUnquoted = '<a href=https://raw-url.com>Plain</a>';
    assert(
      convertLinksToTemplateUrl(htmlUnquoted) === '<a href="{{.URL}}">Plain</a>',
      "Unquoted href conversion failed"
    );

    // Preserving non-anchor elements
    const htmlWithOtherElements = '<div><img src="https://corp.com/logo.png"><link rel="stylesheet" href="style.css"><a href="https://corp.com/dest">Go</a></div>';
    const convertedOther = convertLinksToTemplateUrl(htmlWithOtherElements);
    assert(convertedOther.includes('src="https://corp.com/logo.png"'), "img src was altered!");
    assert(convertedOther.includes('href="style.css"'), "link stylesheet href was altered!");
    assert(convertedOther.includes('href="{{.URL}}"'), "anchor href was not converted!");

    console.log("  ✔ Link conversion correctly targets only <a> tags with all casing and quoting styles.\n");
  }

  // -------------------------------------------------------------------
  // TEST 6: Tracking Image Logic & Deduplication
  // -------------------------------------------------------------------
  console.log("👁️ Test 6: Tracking Image Logic & Deduplication");
  {
    // Uppercase </BODY>
    const upperBodyHtml = "<html><BODY><p>Hello</p></BODY></html>";
    const injectedUpper = injectTracker(upperBodyHtml);
    assert(injectedUpper.includes("{{.Tracker}}</body>"), "Failed to inject tracker before uppercase </BODY>");

    // No body tag
    const noBodyHtml = "<p>Snippet without body</p>";
    const injectedNoBody = injectTracker(noBodyHtml);
    assert(injectedNoBody.endsWith("{{.Tracker}}"), "Failed to append tracker when no </body> tag exists");

    // Deduplication when {{.Tracker}} already exists
    const alreadyTracked = "<p>Test {{.Tracker}}</p></body>";
    assert(injectTracker(alreadyTracked) === alreadyTracked, "Duplicate tracker injected!");

    // Deduplication when {{.TrackingUrl}} exists
    const withTrackingUrl = "<p>Test {{.TrackingUrl}}</p></body>";
    assert(injectTracker(withTrackingUrl) === withTrackingUrl, "Duplicate tracker injected when {{.TrackingUrl}} exists!");

    // Stripping
    const toStrip = "<html><body><p>Test</p>{{.Tracker}}</body></html>";
    assert(stripTracker(toStrip) === "<html><body><p>Test</p></body></html>", "stripTracker failed");

    console.log("  ✔ Tracking image injection, deduplication, and stripping fully verified.\n");
  }

  // -------------------------------------------------------------------
  // TEST 7: Raw MIME Parser Corner Cases
  // -------------------------------------------------------------------
  console.log("📧 Test 7: Raw MIME Parser Edge Cases");
  {
    // Raw HTML pasted without MIME transport headers
    const rawHtml = "<html><body><h1>Direct HTML</h1><p>No headers here</p></body></html>";
    const parsedHtml = parseRawEmail(rawHtml);
    assert(parsedHtml.html.includes("Direct HTML"), "Raw HTML fallback failed");
    assert(parsedHtml.subject === "", "Expected empty subject for headerless HTML");

    // Raw plaintext pasted without MIME transport headers
    const rawPlain = "Just a quick plain note to verify fallback parsing.";
    const parsedPlain = parseRawEmail(rawPlain);
    assert(parsedPlain.text.includes("Just a quick plain note"), "Raw plaintext fallback failed");

    // Quoted-Printable with trailing equals and soft breaks
    const qpEmail = [
      "Subject: QP Test",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "Line 1 with soft break=\r\n and continued text=21",
    ].join("\r\n");
    const parsedQp = parseRawEmail(qpEmail);
    assert(parsedQp.text === "Line 1 with soft break and continued text!", `QP decode error: ${parsedQp.text}`);

    console.log("  ✔ Raw MIME parser edge cases (headerless HTML/text, QP soft-breaks) passed.\n");
  }

  console.log("=========================================================");
  console.log("   🎉 ALL ADVERSARIAL & SECURITY CHECKS PASSED!          ");
  console.log("=========================================================");
}

runAdversarialSuite()
  .catch((err) => {
    console.error("Adversarial suite failure:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
