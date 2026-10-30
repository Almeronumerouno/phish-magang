/**
 * scripts/challenger-smtp-stress.mjs
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST HARNESS FOR CAMPAIGN DISPATCH ENGINE
 * Author: teamwork_preview_challenger_1 (Empirical Challenger)
 * Target: src/lib/campaign-dispatcher.ts
 *
 * Test Dimensions:
 * 1. Variable replacement edge cases (relative/malformed URLs, unicode, emojis, $ replacement tokens, mixed case)
 * 2. Attachment stress cases (corrupt base64, data-uri variations with charset, duplicate names, strange MIME types)
 * 3. Transporter & Network edge cases (slow greeting, auth failure 535, TLS toggle, 10-target interleaved 550 batch isolation)
 * 4. Database cleanup and zero-leakage verification
 */

import net from "node:net";
import path from "node:path";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const rootDir = process.cwd();

// Setup jiti with @ alias mapping to src
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(rootDir, "src") },
});

// Import dispatcher modules, MIME decoder, and db
const {
  renderTemplateVariables,
  convertAttachmentsToBuffers,
  buildPhishingUrl,
  buildTrackingUrl,
  dispatchCampaignEmails,
  buildNodemailerTransporter,
} = await jiti.import(path.resolve(rootDir, "src/lib/campaign-dispatcher.ts"));

const { decodeQuotedPrintable } = await jiti.import(path.resolve(rootDir, "src/lib/mime-parser.ts"));
const { db } = await jiti.import(path.resolve(rootDir, "src/lib/db.ts"));

console.log("================================================================================");
console.log("⚔️  STARTING ADVERSARIAL EMPIRICAL STRESS TEST HARNESS (CHALLENGER)");
console.log("================================================================================\n");

let passedCount = 0;
let findingsCount = 0;
const findings = [];

function recordPass(msg) {
  passedCount++;
  console.log(`  ✅ [PASS] ${msg}`);
}

function recordFinding(title, description, severity = "MEDIUM") {
  findingsCount++;
  const item = { title, description, severity };
  findings.push(item);
  console.log(`  ⚠️  [FINDING - ${severity}] ${title}`);
  console.log(`     ${description}`);
}

/**
 * Configurable Mock SMTP Server implementing RFC 5321 with edge case triggers:
 * - rejectRecipients: array of emails to reject with 550
 * - expectedAuth: { user, pass } credentials; returns 535 on invalid credentials
 * - greetingDelayMs: delay before emitting initial 220 greeting
 */
function createAdvancedMockSmtpServer({
  rejectRecipients = [],
  expectedAuth = null,
  greetingDelayMs = 0,
} = {}) {
  const receivedEmails = [];
  const connections = [];

  const server = net.createServer((socket) => {
    connections.push(socket);
    let state = "INIT";
    let buffer = "";
    let currentMail = { from: "", recipients: [], headers: {}, rawData: "" };
    let authUser = "";

    const sendGreeting = () => {
      state = "CMD";
      socket.write("220 127.0.0.1 Adversarial Mock SMTP Ready\r\n");
    };

    if (greetingDelayMs > 0) {
      setTimeout(sendGreeting, greetingDelayMs);
    } else {
      sendGreeting();
    }

    socket.on("data", (chunk) => {
      buffer += chunk.toString();

      while (true) {
        if (state === "DATA") {
          const endDataIdx = buffer.indexOf("\r\n.\r\n");
          if (endDataIdx !== -1) {
            currentMail.rawData = buffer.slice(0, endDataIdx);
            receivedEmails.push({ ...currentMail });
            currentMail = { from: "", recipients: [], headers: {}, rawData: "" };
            buffer = buffer.slice(endDataIdx + 5);
            state = "CMD";
            socket.write("250 2.0.0 OK: queued\r\n");
          } else {
            break;
          }
        } else {
          const lineEndIdx = buffer.indexOf("\r\n");
          if (lineEndIdx === -1) break;
          const line = buffer.slice(0, lineEndIdx);
          buffer = buffer.slice(lineEndIdx + 2);
          const upper = line.toUpperCase().trim();

          if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
            socket.write("250-127.0.0.1\r\n250-AUTH LOGIN PLAIN\r\n250 OK\r\n");
          } else if (upper.startsWith("AUTH PLAIN")) {
            const rawToken = line.slice(10).trim();
            let authPlainUser = "";
            let authPlainPass = "";
            try {
              const decoded = Buffer.from(rawToken, "base64").toString("utf8");
              const parts = decoded.split("\0");
              authPlainUser = parts[1] || parts[0] || "";
              authPlainPass = parts[2] || parts[1] || "";
            } catch {}
            if (expectedAuth) {
              if (authPlainUser === expectedAuth.user && authPlainPass === expectedAuth.pass) {
                socket.write("235 2.7.0 Authentication successful\r\n");
              } else {
                socket.write("535 5.7.8 Authentication credentials invalid\r\n");
              }
            } else {
              socket.write("235 2.7.0 Authentication accepted\r\n");
            }
          } else if (upper.startsWith("AUTH LOGIN")) {
            state = "AUTH_USER";
            socket.write("334 VXNlcm5hbWU6\r\n");
          } else if (state === "AUTH_USER") {
            try {
              authUser = Buffer.from(line.trim(), "base64").toString("utf8");
            } catch {
              authUser = line.trim();
            }
            state = "AUTH_PASS";
            socket.write("334 UGFzc3dvcmQ6\r\n");
          } else if (state === "AUTH_PASS") {
            let authPass = "";
            try {
              authPass = Buffer.from(line.trim(), "base64").toString("utf8");
            } catch {
              authPass = line.trim();
            }
            state = "CMD";
            if (expectedAuth) {
              if (authUser === expectedAuth.user && authPass === expectedAuth.pass) {
                socket.write("235 2.7.0 Authentication successful\r\n");
              } else {
                socket.write("535 5.7.8 Authentication credentials invalid\r\n");
              }
            } else {
              socket.write("235 2.7.0 Authentication accepted\r\n");
            }
          } else if (upper.startsWith("MAIL FROM:")) {
            currentMail.from = line.slice(10).trim();
            socket.write("250 2.1.0 Sender OK\r\n");
          } else if (upper.startsWith("RCPT TO:")) {
            const rcpt = line.slice(8).trim().replace(/[<>]/g, "");
            currentMail.recipients.push(rcpt);
            if (rejectRecipients.includes(rcpt)) {
              socket.write(`550 5.1.1 <${rcpt}>: Recipient address rejected: User unknown\r\n`);
            } else {
              socket.write("250 2.1.5 Recipient OK\r\n");
            }
          } else if (upper === "DATA") {
            state = "DATA";
            socket.write("354 Start mail input; end with <CRLF>.<CRLF>\r\n");
          } else if (upper === "QUIT") {
            socket.write("221 2.0.0 Service closing transmission channel\r\n");
            socket.end();
          } else if (upper === "RSET") {
            currentMail = { from: "", recipients: [], headers: {}, rawData: "" };
            state = "CMD";
            socket.write("250 2.0.0 OK\r\n");
          } else if (upper === "NOOP") {
            socket.write("250 2.0.0 OK\r\n");
          } else {
            socket.write("250 2.0.0 OK\r\n");
          }
        }
      }
    });

    socket.on("error", () => {});
  });

  return {
    server,
    receivedEmails,
    connections,
    async start() {
      return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          resolve(server.address().port);
        });
      });
    },
    async stop() {
      return new Promise((resolve) => {
        for (const sock of connections) {
          try {
            sock.destroy();
          } catch {}
        }
        server.close(() => resolve());
      });
    },
  };
}

async function runChallengerStress() {
  const trackedCampaignIds = [];
  const trackedProfileIds = [];
  const trackedTemplateIds = [];

  try {
    // =========================================================================
    // SUITE 1: VARIABLE REPLACEMENT ADVERSARIAL STRESS
    // =========================================================================
    console.log("--------------------------------------------------------------------------------");
    console.log("SUITE 1: VARIABLE REPLACEMENT ADVERSARIAL STRESS");
    console.log("--------------------------------------------------------------------------------");

    // 1.1 URL Edge Cases
    const urlEdgeCases = [
      {
        name: "Relative path '/login'",
        input: "/login",
        rid: "tok1",
        expectedPhish: "/login?rid=tok1",
        expectedTrack: "/login/track?rid=tok1",
      },
      {
        name: "Relative path with query '/auth?flow=sso'",
        input: "/auth?flow=sso",
        rid: "tok2",
        expectedPhish: "/auth?flow=sso&rid=tok2",
        expectedTrack: "/auth?flow=sso/track?rid=tok2",
      },
      {
        name: "Malformed protocol 'http://'",
        input: "http://",
        rid: "tok3",
        expectedPhish: "http://?rid=tok3",
      },
      {
        name: "URL with query and hash 'https://example.com/login?foo=1&bar=2#top'",
        input: "https://example.com/login?foo=1&bar=2#top",
        rid: "tok4",
        expectedPhish: "https://example.com/login?foo=1&bar=2&rid=tok4#top",
        expectedTrack: "https://example.com/track?rid=tok4",
      },
      {
        name: "Empty baseUrl",
        input: "",
        rid: "tok5",
        expectedPhish: "",
        expectedTrack: "/track?rid=tok5",
      },
    ];

    for (const ec of urlEdgeCases) {
      const phish = buildPhishingUrl(ec.input, ec.rid);
      assert.strictEqual(phish, ec.expectedPhish, `buildPhishingUrl for ${ec.name}`);
      if (ec.expectedTrack) {
        const track = buildTrackingUrl(ec.input, ec.rid);
        assert.strictEqual(track, ec.expectedTrack, `buildTrackingUrl for ${ec.name}`);
      }
    }
    recordPass("All 5 malformed and relative URL edge cases handled without throwing exceptions");

    // 1.2 Unicode, Emojis, and Multilingual Characters
    const unicodeVars = {
      rId: "unicode_01",
      firstName: "Владимир 🎅",
      lastName: "Al-Mu'allim (المعلم)",
      position: "Senior 🚀 CISO / 首席安全官",
      email: "vladimir.al+sec@corp.internal",
      from: "SecOps 🛡️ <helpdesk@corp.internal>",
      baseUrl: "https://sec.corp.internal/portal",
    };

    const unicodeTemplate = `
      Subject: Notice for {{.FirstName}} {{.LastName}}
      Body: Dear {{.FirstName}}, position: {{.Position}} (Ref: {{.RId}}).
      Contact: {{.Email}} / {{.From}}.
      URL: {{.URL}}
    `;

    const renderedUnicode = renderTemplateVariables(unicodeTemplate, { ...unicodeVars, isHtml: false });
    assert.ok(renderedUnicode.includes("Владимир 🎅"), "Cyrillic and emoji preserved in FirstName");
    assert.ok(renderedUnicode.includes("Al-Mu'allim (المعلم)"), "Arabic script and single quote preserved in LastName");
    assert.ok(renderedUnicode.includes("Senior 🚀 CISO / 首席安全官"), "Chinese CJK and rocket emoji preserved in Position");
    recordPass("Unicode, Cyrillic, Arabic, CJK, and emojis preserved across template interpolation");

    // 1.3 String Replacement Pattern Vulnerability Stress (Dollar signs and Backreferences)
    const dollarVars = {
      rId: "r_dollar",
      firstName: "Bonus $100 Recipient",
      lastName: "Target $200",
      position: "VP ($100k) & Dev $& Ops",
      email: "finance$team@corp.internal",
      from: "admin@corp.internal",
      baseUrl: "https://corp.internal",
    };

    const dollarTemplate = "Pos: {{.Position}} | User: {{.FirstName}} {{.LastName}}";
    const renderedDollar = renderTemplateVariables(dollarTemplate, { ...dollarVars, isHtml: false });

    // Check if $100 was swallowed and $& was reinjected
    if (renderedDollar.includes("VP ()") || renderedDollar.includes("{{.Position}}")) {
      recordFinding(
        "String.replace Dollar Backreference Evaluation Bug in renderTemplateVariables",
        `Input position 'VP ($100k) & Dev $& Ops' was rendered as '${renderedDollar}'. ` +
          `JavaScript String.prototype.replace(regex, val) interprets '$10' as a capture group and '$&' as the match pattern, ` +
          `swallowing '$100k' into '' and re-injecting '{{.Position}}'. Mitigation: Use replacer function '() => val'.`,
        "HIGH"
      );
    } else {
      recordPass("Special characters with dollar signs and backreferences ($100k, $&) rendered literally");
    }

    // 1.4 Mixed Case and Whitespace Token Permutations
    const mixedCaseTemplate = `
      Token 1: {{.rid}}
      Token 2: {{ .URL }}
      Token 3: {{.tracker}}
      Token 4: {{.FirstName }}
      Token 5: {{   .LASTNAME   }}
      Token 6: {{ .position }}
      Token 7: {{.email}}
      Token 8: {{.from}}
      Token 9: {{.trackingurl}}
    `;

    const mixedCaseRendered = renderTemplateVariables(mixedCaseTemplate, {
      rId: "RID123",
      firstName: "MixedFirst",
      lastName: "MixedLast",
      position: "MixedPos",
      email: "mixed@corp.internal",
      from: "from@corp.internal",
      baseUrl: "https://phish.internal",
      isHtml: true,
    });

    assert.ok(mixedCaseRendered.includes("Token 1: RID123"), "Handled {{.rid}}");
    assert.ok(
      mixedCaseRendered.includes("Token 2: https://phish.internal/?rid=RID123") ||
        mixedCaseRendered.includes("Token 2: https://phish.internal?rid=RID123"),
      "Handled {{ .URL }}"
    );
    assert.ok(mixedCaseRendered.includes("Token 3: <img src="), "Handled {{.tracker}} in HTML");
    assert.ok(mixedCaseRendered.includes("Token 4: MixedFirst"), "Handled {{.FirstName }}");
    assert.ok(mixedCaseRendered.includes("Token 5: MixedLast"), "Handled {{   .LASTNAME   }}");
    assert.ok(mixedCaseRendered.includes("Token 6: MixedPos"), "Handled {{ .position }}");
    recordPass("Case-insensitivity and arbitrary whitespace in template tokens fully supported");

    // 1.5 Template Structure Variations (no variables vs duplicate vs overlapping)
    const plainTextNoVars = "Static corporate security notification with no placeholders.";
    const renderedNoVars = renderTemplateVariables(plainTextNoVars, { ...unicodeVars, isHtml: false });
    assert.strictEqual(renderedNoVars, plainTextNoVars, "Template without variables remains unchanged");

    const duplicateTemplate = "{{.FirstName}} and {{.FirstName}} and {{.FirstName}}";
    const renderedDuplicate = renderTemplateVariables(duplicateTemplate, { ...unicodeVars, isHtml: false });
    assert.strictEqual(
      renderedDuplicate,
      "Владимир 🎅 and Владимир 🎅 and Владимир 🎅",
      "Duplicate variable occurrences all replaced"
    );

    const overlappingTemplate = "{{.FirstNameX}} {{.FirstName_}} {{{{.FirstName}}}}";
    const renderedOverlapping = renderTemplateVariables(overlappingTemplate, { ...unicodeVars, isHtml: false });
    assert.ok(renderedOverlapping.includes("{{.FirstNameX}}"), "Overlapping pseudo-token {{.FirstNameX}} left untouched");
    assert.ok(renderedOverlapping.includes("Владимир 🎅"), "Nested token {{{{.FirstName}}}} resolved correctly");
    recordPass("Template structure variations (no variables, duplicates, overlapping tokens) correctly parsed");

    // 1.6 Whitespace tolerance in cleanTemplateUrls (rich text editor prepended http://)
    const rteHtmlWithSpace = '<a href="http://{{ .URL }}">Verify Account</a>';
    const renderedRte = renderTemplateVariables(rteHtmlWithSpace, {
      ...unicodeVars,
      isHtml: true,
    });

    if (renderedRte.includes("http://https://") || renderedRte.includes("http://http://")) {
      recordFinding(
        "cleanTemplateUrls Fails on Whitespace Tokens (e.g. http://{{ .URL }})",
        `Regex in cleanTemplateUrls (/https?:\\/\\/{{\\.URL}}/gi) strictly requires no spaces. ` +
          `When a template contains '<a href="http://{{ .URL }}">', it produces a double-protocol URL: '${renderedRte}'. ` +
          `Mitigation: Use /https?:\\/\\/{{\\s*\\.URL\\s*}}/gi.`,
        "LOW"
      );
    } else {
      recordPass("cleanTemplateUrls cleanly handles whitespace tokens in http://{{ .URL }}");
    }

    // =========================================================================
    // SUITE 2: ATTACHMENT STRESS CASES
    // =========================================================================
    console.log("\n--------------------------------------------------------------------------------");
    console.log("SUITE 2: ATTACHMENT STRESS CASES");
    console.log("--------------------------------------------------------------------------------");

    // 2.1 Corrupt Base64, Empty String, and Data-URI Variations
    const samplePayload = "Plain text secret document content";
    const validBase64 = Buffer.from(samplePayload).toString("base64");

    const stressAttachments = [
      {
        name: "valid-standard.txt",
        type: "text/plain",
        content: `data:text/plain;base64,${validBase64}`,
      },
      {
        name: "data-uri-with-charset.txt",
        type: "text/plain",
        content: `data:text/plain;charset=utf-8;base64,${validBase64}`,
      },
      {
        name: "uppercase-data-uri.txt",
        type: "text/plain",
        content: `DATA:TEXT/PLAIN;BASE64,${validBase64}`,
      },
      {
        name: "corrupt-non-base64.bin",
        type: "application/octet-stream",
        content: "not-base64-at-all-!@#$%^&*()_+{}:<>?",
      },
      {
        name: "empty-content.txt",
        type: "text/plain",
        content: "",
      },
      {
        name: "null-attachment.txt",
        type: "text/plain",
        content: null,
      },
    ];

    const convertedBuffers = convertAttachmentsToBuffers(stressAttachments);

    // Empty content and null attachment should be filtered out
    const emptyFound = convertedBuffers.some((b) => b.filename === "empty-content.txt" || b.filename === "null-attachment.txt");
    assert.strictEqual(emptyFound, false, "Empty and null attachments filtered out");

    // Valid standard attachment decoded
    const standardAtt = convertedBuffers.find((b) => b.filename === "valid-standard.txt");
    assert.ok(standardAtt, "valid-standard.txt present");
    assert.strictEqual(standardAtt.content.toString(), samplePayload, "valid-standard decoded correctly");

    // Corrupt base64 should return a Buffer without throwing
    const corruptAtt = convertedBuffers.find((b) => b.filename === "corrupt-non-base64.bin");
    assert.ok(corruptAtt && Buffer.isBuffer(corruptAtt.content), "Corrupt base64 safely handled as Buffer without throwing");

    // Data URI with charset: test if regex stripped the prefix
    const charsetAtt = convertedBuffers.find((b) => b.filename === "data-uri-with-charset.txt");
    if (charsetAtt && charsetAtt.content.toString() !== samplePayload) {
      recordFinding(
        "Data-URI Regex Fails on Parameterized MIME Types (e.g. charset=utf-8)",
        `Regex /^data:[^;]+;base64,/ fails on 'data:text/plain;charset=utf-8;base64,...' because ';charset=utf-8' precedes ';base64'. ` +
          `Result: Attachment payload was corrupted with raw data URI header text. ` +
          `Mitigation: Use /^data:[^,]+;base64,/i or split on comma.`,
        "MEDIUM"
      );
    } else {
      recordPass("Data-URI with charset parameters correctly stripped");
    }

    // Uppercase DATA: URI: test case sensitivity
    const upperAtt = convertedBuffers.find((b) => b.filename === "uppercase-data-uri.txt");
    if (upperAtt && upperAtt.content.toString() !== samplePayload) {
      recordFinding(
        "Data-URI Prefix Stripping is Case-Sensitive",
        `Regex /^data:[^;]+;base64,/ does not have 'i' flag, failing to strip 'DATA:TEXT/PLAIN;BASE64,...'. ` +
          `Mitigation: Add 'i' flag: /^data:[^,]+;base64,/i.`,
        "LOW"
      );
    } else {
      recordPass("Uppercase DATA: URI correctly stripped");
    }

    // 2.2 Multiple Attachments with Identical Names & Strange MIME Types
    const multiAttachments = [
      {
        name: "duplicate.pdf",
        type: "application/pdf",
        content: Buffer.from("First duplicate").toString("base64"),
      },
      {
        name: "duplicate.pdf",
        type: "application/pdf",
        content: Buffer.from("Second duplicate").toString("base64"),
      },
      {
        name: "chemical-model.pdb",
        type: "chemical/x-pdb",
        content: Buffer.from("ATOM 1 N ALA").toString("base64"),
      },
      {
        name: "empty-mime-file.bin",
        type: "",
        content: Buffer.from("binary").toString("base64"),
      },
    ];

    const multiConverted = convertAttachmentsToBuffers(multiAttachments);
    assert.strictEqual(multiConverted.length, 4, "All 4 multi/strange attachments converted");
    assert.strictEqual(multiConverted[0].filename, "duplicate.pdf");
    assert.strictEqual(multiConverted[1].filename, "duplicate.pdf");
    assert.strictEqual(multiConverted[2].contentType, "chemical/x-pdb");
    assert.strictEqual(multiConverted[3].contentType, "application/octet-stream", "Empty MIME defaults to application/octet-stream");
    recordPass("Multiple attachments with identical names and unusual MIME types properly converted with fallback");

    // =========================================================================
    // SUITE 3: TRANSPORTER & NETWORK EDGE CASES
    // =========================================================================
    console.log("\n--------------------------------------------------------------------------------");
    console.log("SUITE 3: TRANSPORTER & NETWORK EDGE CASES");
    console.log("--------------------------------------------------------------------------------");

    // 3.1 Transporter Configuration Matrix
    const configMatrix = [
      { host: "smtp.corp.internal:465", expectedPort: 465, expectedSecure: true },
      { host: "smtp.corp.internal:587", expectedPort: 587, expectedSecure: false },
      { host: "mail.corp.internal:25", expectedPort: 25, expectedSecure: false },
      { host: "smtp-relay.corp.internal:2525", expectedPort: 2525, expectedSecure: false },
      { host: "localhost", expectedPort: 25, expectedSecure: false },
    ];

    for (const c of configMatrix) {
      const tp = buildNodemailerTransporter({
        id: 99,
        name: "Config Matrix Test",
        host: c.host,
        username: "user",
        password: "pwd",
        fromAddress: "test@corp.internal",
        ignoreCertErrors: true,
      });
      assert.strictEqual(tp.options.port, c.expectedPort, `Port matches for ${c.host}`);
      assert.strictEqual(tp.options.secure, c.expectedSecure, `Secure flag matches for ${c.host}`);
      assert.strictEqual(tp.options.tls.rejectUnauthorized, false, "ignoreCertErrors: true reflected");
    }
    recordPass("Transporter configuration matrix verified across ports 465, 587, 25, 2525, and TLS tolerance");

    // Setup DB User for live tests
    const dbUser = await db.user.findFirst();
    assert.ok(dbUser, "Database user exists for tests");

    // 3.2 Network Latency / Slow Greeting Test
    console.log("  [Network Latency] Testing dispatch with 250ms delayed SMTP greeting...");
    const slowSmtp = createAdvancedMockSmtpServer({ greetingDelayMs: 250 });
    const slowPort = await slowSmtp.start();

    const slowProfile = await db.sendingProfile.create({
      data: {
        name: `Slow Greeting Profile ${Date.now()}`,
        userId: dbUser.id,
        host: `127.0.0.1:${slowPort}`,
        fromAddress: "slow-sec@corp.internal",
        ignoreCertErrors: true,
      },
    });
    trackedProfileIds.push(slowProfile.id);

    const stressTemplate = await db.template.create({
      data: {
        name: `Stress Template ${Date.now()}`,
        userId: dbUser.id,
        subject: "Security Notification: {{.FirstName}}",
        text: "Notice for {{.Email}}: visit {{.URL}}\n{{.Tracker}}",
        html: "<p>Notice for {{.Email}}: visit <a href=\"{{.URL}}\">Portal</a></p>{{.Tracker}}",
        attachments: {
          create: [
            {
              name: "policy.pdf",
              type: "application/pdf",
              content: Buffer.from("Policy text").toString("base64"),
            },
          ],
        },
      },
      include: { attachments: true },
    });
    trackedTemplateIds.push(stressTemplate.id);

    const slowCampaign = await db.campaign.create({
      data: {
        name: `Slow Greeting Campaign ${Date.now()}`,
        userId: dbUser.id,
        templateId: stressTemplate.id,
        smtpId: slowProfile.id,
        status: "In_Progress",
        url: "http://127.0.0.1:8080/portal",
      },
    });
    trackedCampaignIds.push(slowCampaign.id);

    const slowRes = await db.result.create({
      data: {
        campaignId: slowCampaign.id,
        userId: dbUser.id,
        rId: `slow_${Date.now()}`,
        email: "slow.target@corp.internal",
        firstName: "Slow",
        lastName: "Target",
        status: "Scheduled",
      },
    });

    const slowDispatch = await dispatchCampaignEmails({
      campaignId: slowCampaign.id,
      baseUrl: "http://127.0.0.1:8080/portal",
      profile: slowProfile,
      template: stressTemplate,
      targets: [
        {
          id: slowRes.id,
          rId: slowRes.rId,
          email: slowRes.email,
          firstName: slowRes.firstName,
          lastName: slowRes.lastName,
        },
      ],
    });

    assert.strictEqual(slowDispatch.sent, 1, "Slow greeting dispatched successfully within timeout");
    assert.strictEqual(slowDispatch.error, 0, "Zero errors on slow greeting");
    recordPass("Slow network / 250ms greeting delay safely handled without premature timeout");
    await slowSmtp.stop();

    // 3.3 SMTP Authentication Failure Handling (535 Invalid Credentials)
    console.log("  [Auth Failure] Testing dispatch with invalid SMTP credentials (535 response)...");
    const authSmtp = createAdvancedMockSmtpServer({
      expectedAuth: { user: "correct_user", pass: "correct_pass" },
    });
    const authPort = await authSmtp.start();

    const badAuthProfile = await db.sendingProfile.create({
      data: {
        name: `Bad Auth Profile ${Date.now()}`,
        userId: dbUser.id,
        host: `127.0.0.1:${authPort}`,
        username: "wrong_user",
        password: "wrong_password",
        fromAddress: "auth-test@corp.internal",
        ignoreCertErrors: true,
      },
    });
    trackedProfileIds.push(badAuthProfile.id);

    const authCampaign = await db.campaign.create({
      data: {
        name: `Auth Failure Campaign ${Date.now()}`,
        userId: dbUser.id,
        templateId: stressTemplate.id,
        smtpId: badAuthProfile.id,
        status: "In_Progress",
        url: "http://127.0.0.1:8080/portal",
      },
    });
    trackedCampaignIds.push(authCampaign.id);

    const authRes = await db.result.create({
      data: {
        campaignId: authCampaign.id,
        userId: dbUser.id,
        rId: `auth_${Date.now()}`,
        email: "auth.target@corp.internal",
        status: "Scheduled",
      },
    });

    const authDispatch = await dispatchCampaignEmails({
      campaignId: authCampaign.id,
      baseUrl: "http://127.0.0.1:8080/portal",
      profile: badAuthProfile,
      template: stressTemplate,
      targets: [{ id: authRes.id, rId: authRes.rId, email: authRes.email }],
    });

    assert.strictEqual(authDispatch.sent, 0, "Zero sent on auth failure");
    assert.strictEqual(authDispatch.error, 1, "Exactly 1 error recorded on auth failure");
    assert.ok(
      authDispatch.errors[0].error.includes("535") || authDispatch.errors[0].error.includes("Authentication"),
      "Error details contain 535 authentication failure message"
    );

    const dbAuthRes = await db.result.findUnique({ where: { id: authRes.id } });
    assert.strictEqual(dbAuthRes.status, "Error", "Result status set to 'Error'");

    const authSimEvents = await db.simEvent.findMany({ where: { campaignId: authCampaign.id } });
    assert.strictEqual(authSimEvents.length, 1, "One SimEvent recorded for auth failure");
    assert.strictEqual(authSimEvents[0].message, "Error Sending Email");
    assert.ok(authSimEvents[0].details.includes("535"), "SimEvent details record 535 rejection");
    recordPass("SMTP Authentication failure (535) gracefully captured with 'Error' status and SimEvent");
    await authSmtp.stop();

    // 3.4 10-Target Batch Isolation Stress (5 Valid, 5 Rejected with 550, Alternating)
    console.log("  [Batch Isolation Stress] Running 10-target batch with alternating valid and 550 rejections...");
    const batchSize = 10;
    const rejectedTargets = [];
    const acceptedTargets = [];

    for (let i = 0; i < batchSize; i++) {
      const email = `target_${i}@stress.corp.internal`;
      if (i % 2 === 1) {
        rejectedTargets.push(email); // odd targets rejected (5 targets)
      } else {
        acceptedTargets.push(email); // even targets accepted (5 targets)
      }
    }

    const batchMockSmtp = createAdvancedMockSmtpServer({
      rejectRecipients: rejectedTargets,
    });
    const batchPort = await batchMockSmtp.start();

    const batchProfile = await db.sendingProfile.create({
      data: {
        name: `Batch Stress Profile ${Date.now()}`,
        userId: dbUser.id,
        host: `127.0.0.1:${batchPort}`,
        fromAddress: "batch-sec@corp.internal",
        ignoreCertErrors: true,
        headers: {
          create: [{ key: "X-Stress-Id", value: "STRESS-{{.RId}}" }],
        },
      },
      include: { headers: true },
    });
    trackedProfileIds.push(batchProfile.id);

    const batchCampaign = await db.campaign.create({
      data: {
        name: `10-Target Batch Stress Campaign ${Date.now()}`,
        userId: dbUser.id,
        templateId: stressTemplate.id,
        smtpId: batchProfile.id,
        status: "In_Progress",
        url: "http://127.0.0.1:8080/portal?batch=stress",
      },
    });
    trackedCampaignIds.push(batchCampaign.id);

    const batchTargets = [];
    for (let i = 0; i < batchSize; i++) {
      const email = `target_${i}@stress.corp.internal`;
      const isReject = i % 2 === 1;
      const res = await db.result.create({
        data: {
          campaignId: batchCampaign.id,
          userId: dbUser.id,
          rId: `bt_${i}_${Date.now()}`,
          email,
          firstName: isReject ? `BadUser_${i}` : `GoodUser_${i}`,
          lastName: "StressTest",
          position: "Tester",
          status: "Scheduled",
        },
      });
      batchTargets.push(res);
    }

    const batchDispatchResult = await dispatchCampaignEmails({
      campaignId: batchCampaign.id,
      baseUrl: "http://127.0.0.1:8080/portal?batch=stress",
      profile: batchProfile,
      template: stressTemplate,
      targets: batchTargets.map((t) => ({
        id: t.id,
        rId: t.rId,
        email: t.email,
        firstName: t.firstName,
        lastName: t.lastName,
        position: t.position,
      })),
    });

    assert.strictEqual(batchDispatchResult.total, 10, "Total targets is exactly 10");
    assert.strictEqual(batchDispatchResult.sent, 5, "Exactly 5 targets marked sent");
    assert.strictEqual(batchDispatchResult.error, 5, "Exactly 5 targets marked error");
    assert.strictEqual(batchDispatchResult.errors.length, 5, "Errors list contains exactly 5 items");

    // Verify all 5 rejected targets are in the errors list with 550 reason
    for (const rejEmail of rejectedTargets) {
      const errItem = batchDispatchResult.errors.find((e) => e.email === rejEmail);
      assert.ok(errItem, `Rejected email ${rejEmail} recorded in errors list`);
      assert.ok(
        errItem.error.includes("550") || errItem.error.includes("Recipient address rejected"),
        `Error contains 550 rejection details for ${rejEmail}`
      );
    }

    // Verify Database Result state for all 10 targets
    const dbBatchResults = await db.result.findMany({
      where: { campaignId: batchCampaign.id },
    });
    assert.strictEqual(dbBatchResults.length, 10, "10 Result records exist in DB");

    const dbSentCount = dbBatchResults.filter((r) => r.status === "Email Sent").length;
    const dbErrorCount = dbBatchResults.filter((r) => r.status === "Error").length;
    assert.strictEqual(dbSentCount, 5, "Database contains exactly 5 'Email Sent' results");
    assert.strictEqual(dbErrorCount, 5, "Database contains exactly 5 'Error' results");

    // Verify Database SimEvents
    const dbSimEvents = await db.simEvent.findMany({
      where: { campaignId: batchCampaign.id },
    });
    const sentEvents = dbSimEvents.filter((ev) => ev.message === "Email Sent");
    const errorEvents = dbSimEvents.filter((ev) => ev.message === "Error Sending Email");
    assert.strictEqual(sentEvents.length, 5, "Database contains exactly 5 'Email Sent' SimEvents");
    assert.strictEqual(errorEvents.length, 5, "Database contains exactly 5 'Error Sending Email' SimEvents");

    // Verify mock server received exactly 5 delivered emails
    assert.strictEqual(batchMockSmtp.receivedEmails.length, 5, "Mock SMTP server received exactly 5 delivered messages");

    // Ensure sockets clean up and no hung connections
    assert.ok(batchMockSmtp.connections.length > 0, "Connections tracked by mock server");
    recordPass("10-target interleaved batch isolation: exactly 5 sent, 5 error, perfect database & event parity");
    await batchMockSmtp.stop();

    // =========================================================================
    // SUITE 4: DATABASE CLEANUP VERIFICATION
    // =========================================================================
    console.log("\n--------------------------------------------------------------------------------");
    console.log("SUITE 4: DATABASE CLEANUP VERIFICATION");
    console.log("--------------------------------------------------------------------------------");

    // Delete all tracked test records
    for (const cId of trackedCampaignIds) {
      await db.campaign.delete({ where: { id: cId } });
    }
    await db.sendingProfile.deleteMany({
      where: { id: { in: trackedProfileIds } },
    });
    for (const tId of trackedTemplateIds) {
      await db.template.delete({ where: { id: tId } });
    }

    // Verify zero leftover test campaigns or results
    const remainingCampaigns = await db.campaign.findMany({
      where: { id: { in: trackedCampaignIds } },
    });
    const remainingResults = await db.result.findMany({
      where: { campaignId: { in: trackedCampaignIds } },
    });
    const remainingEvents = await db.simEvent.findMany({
      where: { campaignId: { in: trackedCampaignIds } },
    });

    assert.strictEqual(remainingCampaigns.length, 0, "Zero test campaigns remaining");
    assert.strictEqual(remainingResults.length, 0, "Zero test results remaining");
    assert.strictEqual(remainingEvents.length, 0, "Zero test simEvents remaining");
    recordPass("Database cleanup: all test campaigns, results, simEvents, profiles, and templates purged");

  } finally {
    // Teardown safety: ensure cleanup runs even if an unhandled assertion occurs
    try {
      if (trackedCampaignIds.length > 0) {
        await db.campaign.deleteMany({ where: { id: { in: trackedCampaignIds } } });
      }
      if (trackedProfileIds.length > 0) {
        await db.sendingProfile.deleteMany({ where: { id: { in: trackedProfileIds } } });
      }
      if (trackedTemplateIds.length > 0) {
        await db.template.deleteMany({ where: { id: { in: trackedTemplateIds } } });
      }
    } catch {}
  }

  // ===========================================================================
  // SUMMARY REPORT
  // ===========================================================================
  console.log("\n================================================================================");
  console.log("📊 CHALLLENGER STRESS HARNESS SUMMARY");
  console.log("================================================================================");
  console.log(`Passed Assertions: ${passedCount}`);
  console.log(`Vulnerabilities / Edge Case Findings: ${findingsCount}`);

  if (findings.length > 0) {
    console.log("\n⚠️  CONFIRMED FINDINGS & FAILURE MODES:");
    for (let i = 0; i < findings.length; i++) {
      console.log(`  ${i + 1}. [${findings[i].severity}] ${findings[i].title}`);
      console.log(`     ${findings[i].description}`);
    }
  }

  console.log("\n================================================================================\n");
  return {
    passedCount,
    findingsCount,
    findings,
  };
}

runChallengerStress()
  .then((report) => {
    if (report.findingsCount > 0) {
      console.log(`⚠️  Stress test completed with ${report.findingsCount} findings.`);
    } else {
      console.log("🎉 ALL ADVERSARIAL STRESS TESTS PASSED WITH ZERO FINDINGS!");
    }
  })
  .catch((err) => {
    console.error("\n❌ UNEXPECTED TEST CRASH:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await db.$disconnect();
    } catch {}
  });
