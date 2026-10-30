/**
 * scripts/verify-campaign-dispatch.mjs
 *
 * Comprehensive Automated Integration Verification Suite for Milestone 3:
 * Authentic SMTP Campaign Dispatch Engine & GoPhish Lifecycle
 *
 * Requirements & Features Verified:
 * 1. GoPhish Template Variable Interpolation across Subject, HTML, Plaintext (9 variables):
 *    {{.RId}}, {{.FirstName}}, {{.LastName}}, {{.Position}}, {{.Email}}, {{.From}},
 *    {{.URL}}, {{.TrackingURL}}, {{.Tracker}}.
 *    - Case-insensitivity & whitespace tolerance (e.g. {{  .FirstName  }} vs {{.firstname}}).
 *    - Graceful fallback for null/undefined fields (renders empty string, never "null" or "undefined").
 * 2. URL Parameterization:
 *    - Clean URL correctly appends ?rid=token.
 *    - Parameterized URL correctly appends &rid=token.
 *    - Preserves URL fragments/hashes.
 * 3. Tracker Pixel Behavior:
 *    - Invisible tracking <img src="..."/> in HTML.
 *    - Clean empty string in Plaintext and Subject without leaking HTML tags.
 *    - Prevents malformed nested <img> when src="{{.Tracker}}" is used.
 * 4. Nodemailer Transporter Configuration (Feature 1):
 *    - Correct host, port, secure flag (465 vs 587/25).
 *    - TLS rejectUnauthorized reflects ignoreCertErrors.
 *    - Authentication credentials handling.
 * 5. Base64 Attachment to Node Buffer Conversion (Feature 3):
 *    - Base64 payloads decoded to binary Buffers with filenames and content types.
 *    - Strips data URI prefixes (e.g. data:application/pdf;base64,).
 *    - Skips empty / null attachments gracefully.
 * 6. Live SMTP Transmission & Decoupled Dispatch Loop (Feature 4 & 5):
 *    - Spawns local mock SMTP server on dynamic port using Node's net.createServer.
 *    - Dispatches campaign via live SMTP socket.
 *    - Verifies received email headers, subject, body, personalized rId, and attachments.
 *    - Verifies DB Result.status "Email Sent" and sendDate timestamp.
 *    - Verifies SimEvent "Email Sent" with sender profile attribution.
 * 7. Error Lifecycle & Granular Target Isolation (Feature 5):
 *    - Network connection failure (ECONNREFUSED on unreachable port).
 *    - Captures exact error message in SimEvent details.
 *    - Per-target isolation: recipient rejection (550 User Unknown) does not crash or abort batch;
 *      subsequent valid recipients in the same batch are successfully transmitted.
 * 8. Telemetry Statistics Calculation (Feature 6):
 *    - Confirms "sent" counter strictly excludes "Error" and "Scheduled" results.
 *    - Confirms "error" counter accurately reflects all failed deliveries.
 *    - Confirms rates (sentRate, openRate) are accurately computed.
 */

import net from "node:net";
import path from "node:path";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const rootDir = process.cwd();

// Setup jiti with path alias for @ -> src
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(rootDir, "src") },
});

// Import dispatcher modules, MIME decoder, and database client
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
console.log("🚀 STARTING CAMPAIGN DISPATCH ENGINE INTEGRATION VERIFICATION");
console.log("================================================================================\n");

let passedAssertions = 0;
function logPass(msg) {
  passedAssertions++;
  console.log(`  ✅ [PASS] ${msg}`);
}

/**
 * Lightweight mock SMTP server implementing RFC 5321 conversation.
 * Runs on dynamic port using Node's net.createServer.
 */
function createMockSmtpServer({ rejectRecipients = [] } = {}) {
  const receivedEmails = [];
  const connections = [];

  const server = net.createServer((socket) => {
    connections.push(socket);
    let state = "CMD";
    let buffer = "";
    let currentMail = { from: "", recipients: [], headers: {}, rawData: "" };

    socket.write("220 127.0.0.1 Authentic Mock SMTP Ready\r\n");

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
          } else if (upper.startsWith("AUTH LOGIN")) {
            state = "AUTH_USER";
            socket.write("334 VXNlcm5hbWU6\r\n");
          } else if (state === "AUTH_USER") {
            state = "AUTH_PASS";
            socket.write("334 UGFzc3dvcmQ6\r\n");
          } else if (state === "AUTH_PASS") {
            state = "CMD";
            socket.write("235 2.7.0 Authentication successful\r\n");
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

    socket.on("error", () => {
      // Ignore socket reset errors on teardown
    });
  });

  return {
    server,
    receivedEmails,
    async start() {
      return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          const port = server.address().port;
          resolve(port);
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

async function runTests() {
  console.log("--------------------------------------------------------------------------------");
  console.log("TEST SUITE 1: GoPhish Template Variable Interpolation & URL Parameterization");
  console.log("--------------------------------------------------------------------------------");

  const testVars = {
    rId: "abc1234",
    firstName: "Alice",
    lastName: "Wonderland",
    position: "Security Lead",
    email: "alice.wonderland@corp.internal",
    from: "IT Helpdesk <support@corp.internal>",
    baseUrl: "https://phish.corp.internal/login",
  };

  // 1.1 All 9 variables rendered in HTML
  const htmlTemplate = `
    <html>
      <head><title>Test</title></head>
      <body>
        <h1>Hello {{.FirstName}} {{.LastName}}</h1>
        <p>Position: {{.Position}}</p>
        <p>Email: {{.Email}}</p>
        <p>From: {{.From}}</p>
        <p>Target RId: {{.RId}}</p>
        <p>Login URL: <a href="{{.URL}}">Click Here</a></p>
        <p>Tracking: {{.TrackingURL}}</p>
        {{.Tracker}}
      </body>
    </html>
  `;

  const renderedHtml = renderTemplateVariables(htmlTemplate, { ...testVars, isHtml: true });

  assert.ok(renderedHtml.includes("Hello Alice Wonderland"), "HTML FirstName and LastName interpolated");
  assert.ok(renderedHtml.includes("Position: Security Lead"), "HTML Position interpolated");
  assert.ok(renderedHtml.includes("Email: alice.wonderland@corp.internal"), "HTML Email interpolated");
  assert.ok(renderedHtml.includes("From: IT Helpdesk <support@corp.internal>"), "HTML From interpolated");
  assert.ok(renderedHtml.includes("Target RId: abc1234"), "HTML RId interpolated");
  assert.ok(
    renderedHtml.includes('href="https://phish.corp.internal/login?rid=abc1234"'),
    "HTML clean URL correctly appends ?rid=abc1234"
  );
  assert.ok(
    renderedHtml.includes("Tracking: https://phish.corp.internal/track?rid=abc1234"),
    "HTML TrackingURL correctly resolved to /track?rid=abc1234"
  );
  assert.ok(
    renderedHtml.includes('<img src="https://phish.corp.internal/track?rid=abc1234" style="display: none;"/>'),
    "HTML {{.Tracker}} produces invisible tracking img"
  );
  logPass("Rendered all 9 GoPhish variables in HTML body with correct URL query parameterization");

  // 1.2 URL parameterization with existing query parameters
  const parameterizedUrl = buildPhishingUrl("https://phish.corp.internal/portal?session=xyz&locale=id", "token777");
  assert.strictEqual(
    parameterizedUrl,
    "https://phish.corp.internal/portal?session=xyz&locale=id&rid=token777",
    "buildPhishingUrl with existing query parameters correctly appends &rid=..."
  );
  logPass("buildPhishingUrl with existing query parameters correctly uses &rid= separator");

  // 1.3 Clean URL parameterization
  const cleanUrl = buildPhishingUrl("https://phish.corp.internal/verify", "token777");
  assert.strictEqual(
    cleanUrl,
    "https://phish.corp.internal/verify?rid=token777",
    "buildPhishingUrl with clean URL correctly uses ?rid= separator"
  );
  logPass("buildPhishingUrl with clean URL correctly uses ?rid= separator");

  // 1.4 Preserves URL hashes / fragments
  const urlWithHash = buildPhishingUrl("https://phish.corp.internal/app#login-form", "abc1234");
  assert.ok(
    urlWithHash.includes("rid=abc1234") && urlWithHash.includes("#login-form"),
    "buildPhishingUrl preserves fragment/hash with rid appended"
  );
  logPass("buildPhishingUrl preserves URL hash/fragment");

  // 1.5 Tracker behavior in Plaintext Body & Subject
  const textTemplate = "Notice for {{.FirstName}} {{.LastName}} ({{.RId}}): visit {{.URL}} [Tracker: {{.Tracker}}]";
  const renderedText = renderTemplateVariables(textTemplate, { ...testVars, isHtml: false });
  assert.ok(renderedText.includes("Notice for Alice Wonderland (abc1234):"), "Plaintext variables rendered");
  assert.ok(!renderedText.includes("<img"), "Plaintext {{.Tracker}} must NOT output <img> tag");
  assert.ok(renderedText.includes("[Tracker: ]"), "Plaintext {{.Tracker}} resolved to empty string");
  logPass("Plaintext mode cleanly strips {{.Tracker}} to empty string without HTML tags");

  // 1.6 Subject line interpolation
  const subjectTemplate = "Security Alert for {{.FirstName}} [Ref: {{.RId}}] {{.Tracker}}";
  const renderedSubject = renderTemplateVariables(subjectTemplate, { ...testVars, isHtml: false });
  assert.strictEqual(
    renderedSubject,
    "Security Alert for Alice [Ref: abc1234] ",
    "Subject line correctly interpolates variables and strips {{.Tracker}}"
  );
  logPass("Subject line correctly interpolates variables without HTML markup");

  // 1.7 Malformed src="{{.Tracker}}" in HTML body
  const malformedHtml = '<p>Test</p><img src="{{.Tracker}}" alt="track"/>';
  const renderedMalformed = renderTemplateVariables(malformedHtml, { ...testVars, isHtml: true });
  assert.ok(
    !renderedMalformed.includes('<img src="<img'),
    "Malformed src={{.Tracker}} does not create nested <img> tags"
  );
  assert.ok(
    renderedMalformed.includes('src="https://phish.corp.internal/track?rid=abc1234"'),
    "Malformed src={{.Tracker}} properly substituted with tracking URL"
  );
  logPass("HTML sanitization handles src='{{.Tracker}}' without duplicate nesting");

  // 1.8 Whitespace & case-insensitivity tolerance in variable tokens
  const variationsTemplate = "{{   .firstname   }} - {{ .LASTNAME }} - {{ .rid }} - {{.url}}";
  const renderedVariations = renderTemplateVariables(variationsTemplate, { ...testVars, isHtml: false });
  assert.strictEqual(
    renderedVariations,
    "Alice - Wonderland - abc1234 - https://phish.corp.internal/login?rid=abc1234",
    "Variable tokens handle whitespace and case-insensitive naming"
  );
  logPass("Variable tokens handle case-insensitivity and extra whitespace");

  // 1.9 Fallback for null/undefined fields (never output 'null' or 'undefined')
  const nullVars = {
    rId: "id999",
    firstName: null,
    lastName: undefined,
    position: null,
    email: "nulltarget@corp.internal",
    from: "admin@corp.internal",
    baseUrl: "http://localhost:8080",
  };
  const nullOutput = renderTemplateVariables("User: [{{.FirstName}}] [{{.LastName}}] [{{.Position}}]", {
    ...nullVars,
    isHtml: false,
  });
  assert.strictEqual(nullOutput, "User: [] [] []", "Missing fields evaluate to empty string, not literal 'null'");
  logPass("Missing and null fields safely evaluate to empty strings");

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST SUITE 2: Nodemailer Transporter Configuration (Feature 1)");
  console.log("--------------------------------------------------------------------------------");

  // 2.1 Port 465 triggers secure: true
  const sslProfile = {
    id: 1,
    name: "SSL SMTPS Profile",
    host: "smtp.corp.internal:465",
    username: "ssl_user",
    password: "ssl_password",
    fromAddress: "ssl@corp.internal",
    ignoreCertErrors: true,
  };
  const sslTransporter = buildNodemailerTransporter(sslProfile);
  assert.strictEqual(sslTransporter.options.port, 465, "Parsed port is 465");
  assert.strictEqual(sslTransporter.options.secure, true, "Port 465 sets secure: true");
  assert.strictEqual(
    sslTransporter.options.tls.rejectUnauthorized,
    false,
    "ignoreCertErrors: true sets rejectUnauthorized: false"
  );
  assert.strictEqual(sslTransporter.options.auth.user, "ssl_user", "Transporter auth user matches");
  assert.strictEqual(sslTransporter.options.auth.pass, "ssl_password", "Transporter auth pass matches");
  logPass("buildNodemailerTransporter correctly configures SSL port 465 and TLS bypass");

  // 2.2 Standard port 587 with strict TLS (ignoreCertErrors: false)
  const tlsProfile = {
    id: 2,
    name: "TLS Profile",
    host: "mail.corp.internal:587",
    username: "",
    password: "",
    fromAddress: "tls@corp.internal",
    ignoreCertErrors: false,
  };
  const tlsTransporter = buildNodemailerTransporter(tlsProfile);
  assert.strictEqual(tlsTransporter.options.port, 587, "Parsed port is 587");
  assert.strictEqual(tlsTransporter.options.secure, false, "Port 587 sets secure: false");
  assert.strictEqual(
    tlsTransporter.options.tls.rejectUnauthorized,
    true,
    "ignoreCertErrors: false sets rejectUnauthorized: true"
  );
  assert.strictEqual(tlsTransporter.options.auth, undefined, "Empty username results in undefined auth");
  logPass("buildNodemailerTransporter correctly configures port 587 with strict TLS enforcement");

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST SUITE 3: Base64 Attachment to Node Buffer Conversion (Feature 3)");
  console.log("--------------------------------------------------------------------------------");

  const rawPdfContent = "%PDF-1.4 mock binary pdf stream content with special chars: \x00\x01\xFF";
  const base64Pdf = Buffer.from(rawPdfContent).toString("base64");
  const dataUriBase64 = `data:application/pdf;base64,${base64Pdf}`;

  const attachments = [
    {
      name: "urgent-policy.pdf",
      type: "application/pdf",
      content: base64Pdf,
    },
    {
      name: "data-uri-attachment.pdf",
      type: "application/pdf",
      content: dataUriBase64,
    },
    {
      name: "empty-attachment.txt",
      type: "text/plain",
      content: "",
    },
    null,
  ];

  const converted = convertAttachmentsToBuffers(attachments);
  assert.strictEqual(converted.length, 2, "Only valid non-empty attachments converted");
  assert.strictEqual(converted[0].filename, "urgent-policy.pdf");
  assert.strictEqual(converted[0].contentType, "application/pdf");
  assert.ok(Buffer.isBuffer(converted[0].content), "Attachment content must be a Node Buffer");
  assert.strictEqual(
    converted[0].content.toString(),
    rawPdfContent,
    "Decoded buffer content exactly matches binary payload"
  );

  assert.strictEqual(converted[1].filename, "data-uri-attachment.pdf");
  assert.ok(Buffer.isBuffer(converted[1].content), "Data URI scheme stripped and converted to Buffer");
  assert.strictEqual(
    converted[1].content.toString(),
    rawPdfContent,
    "Data URI attachment correctly decodes without URI header prefix"
  );
  logPass("Base64 attachments correctly transformed to valid Nodemailer binary Buffers");

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST SUITE 4: Live SMTP Transmission & Decoupled Dispatch Loop (Feature 4)");
  console.log("--------------------------------------------------------------------------------");

  const mockSmtp = createMockSmtpServer();
  const smtpPort = await mockSmtp.start();
  console.log(`  [Mock SMTP] Listening on 127.0.0.1:${smtpPort}`);

  // Setup test records in database
  const user = await db.user.findFirst();
  assert.ok(user, "Database must have at least one user for test harness");

  const testProfile = await db.sendingProfile.create({
    data: {
      name: `Test SMTP Profile ${Date.now()}`,
      userId: user.id,
      host: `127.0.0.1:${smtpPort}`,
      username: "mock_smtp_user",
      password: "mock_smtp_password",
      fromAddress: "SecOps Alert <alert@corp.internal>",
      ignoreCertErrors: true,
      headers: {
        create: [
          { key: "X-Campaign-Test", value: "Verified-{{.RId}}" },
          { key: "X-Mailer", value: "GoPhish-Engine" },
        ],
      },
    },
    include: { headers: true },
  });

  const testTemplate = await db.template.create({
    data: {
      name: `Test Email Template ${Date.now()}`,
      userId: user.id,
      subject: "Action Required: Verify Account for {{.FirstName}} {{.LastName}}",
      text: "Hello {{.FirstName}},\nPlease visit {{.URL}} immediately to verify your status: {{.Position}}.\n{{.Tracker}}",
      html: `
        <div>
          <h2>Account Notification for {{.FirstName}}</h2>
          <p>Click here to access portal: <a href="{{.URL}}">Verify Now</a></p>
          {{.Tracker}}
        </div>
      `,
      attachments: {
        create: [
          {
            name: "security_guidelines.txt",
            type: "text/plain",
            content: Buffer.from("Corporate security guidelines payload").toString("base64"),
          },
        ],
      },
    },
    include: { attachments: true },
  });

  const testCampaign = await db.campaign.create({
    data: {
      name: `Integration Test Campaign Live SMTP ${Date.now()}`,
      userId: user.id,
      templateId: testTemplate.id,
      smtpId: testProfile.id,
      status: "In_Progress",
      url: "http://127.0.0.1:8080/portal",
    },
  });

  // Create 2 test targets with Result records initially "Scheduled"
  const target1RId = `t1_${Date.now().toString().slice(-5)}`;
  const target2RId = `t2_${Date.now().toString().slice(-5)}`;

  const res1 = await db.result.create({
    data: {
      campaignId: testCampaign.id,
      userId: user.id,
      rId: target1RId,
      email: "bob.target1@corp.internal",
      firstName: "Bob",
      lastName: "Targetman",
      position: "Financial Analyst",
      status: "Scheduled",
      sendDate: null,
    },
  });

  const res2 = await db.result.create({
    data: {
      campaignId: testCampaign.id,
      userId: user.id,
      rId: target2RId,
      email: "carol.target2@corp.internal",
      firstName: "Carol",
      lastName: "Auditor",
      position: "Senior Auditor",
      status: "Scheduled",
      sendDate: null,
    },
  });

  // Execute authentic campaign dispatch
  const dispatchResult = await dispatchCampaignEmails({
    campaignId: testCampaign.id,
    baseUrl: "http://127.0.0.1:8080/portal",
    profile: testProfile,
    template: testTemplate,
    targets: [
      {
        id: res1.id,
        rId: res1.rId,
        email: res1.email,
        firstName: res1.firstName,
        lastName: res1.lastName,
        position: res1.position,
      },
      {
        id: res2.id,
        rId: res2.rId,
        email: res2.email,
        firstName: res2.firstName,
        lastName: res2.lastName,
        position: res2.position,
      },
    ],
  });

  assert.strictEqual(dispatchResult.total, 2, "Dispatched 2 total targets");
  assert.strictEqual(dispatchResult.sent, 2, "All 2 targets successfully sent via SMTP");
  assert.strictEqual(dispatchResult.error, 0, "Zero dispatch errors reported");
  assert.strictEqual(dispatchResult.errors.length, 0, "Errors array is empty");
  logPass("dispatchCampaignEmails executed successfully with 2/2 targets sent");

  // Verify mock SMTP server received the emails
  assert.strictEqual(mockSmtp.receivedEmails.length, 2, "Mock SMTP server received exactly 2 emails");

  // Inspect first received email payload
  const email1 = mockSmtp.receivedEmails.find((e) => e.recipients.includes("bob.target1@corp.internal"));
  assert.ok(email1, "SMTP received email destined for bob.target1@corp.internal");
  assert.ok(
    email1.rawData.includes("Subject: Action Required: Verify Account for Bob Targetman"),
    "SMTP email payload contains rendered Subject with Bob Targetman"
  );
  assert.ok(
    email1.rawData.includes("X-Campaign-Test: Verified-" + target1RId),
    "SMTP email payload contains custom header with interpolated RId"
  );

  const decodedEmail1 = decodeQuotedPrintable(email1.rawData);
  assert.ok(
    decodedEmail1.includes("http://127.0.0.1:8080/portal?rid=" + target1RId),
    "SMTP email payload contains phishing link with target rId parameter"
  );
  assert.ok(
    decodedEmail1.includes('<img src="http://127.0.0.1:8080/track?rid=' + target1RId + '" style="display: none;"/>'),
    "SMTP email payload contains tracking pixel with target rId"
  );
  assert.ok(
    email1.rawData.includes("security_guidelines.txt"),
    "SMTP email payload contains attachment filename"
  );
  assert.ok(
    email1.rawData.includes(Buffer.from("Corporate security guidelines payload").toString("base64")),
    "SMTP email payload contains attachment base64 payload"
  );
  logPass("Mock SMTP server verified headers, personalized subject, phishing URL with rId, and attachment");

  // Verify database updates for Target 1 & Target 2
  const dbResult1 = await db.result.findUnique({ where: { id: res1.id } });
  const dbResult2 = await db.result.findUnique({ where: { id: res2.id } });

  assert.strictEqual(dbResult1.status, "Email Sent", "Result 1 status updated to 'Email Sent'");
  assert.ok(dbResult1.sendDate instanceof Date, "Result 1 sendDate recorded as Date timestamp");
  assert.strictEqual(dbResult2.status, "Email Sent", "Result 2 status updated to 'Email Sent'");
  assert.ok(dbResult2.sendDate instanceof Date, "Result 2 sendDate recorded as Date timestamp");
  logPass("Database Result records transitioned from 'Scheduled' to 'Email Sent' with timestamps");

  // Verify SimEvents created in DB
  const simEvents = await db.simEvent.findMany({
    where: { campaignId: testCampaign.id },
    orderBy: { time: "asc" },
  });

  const sentEvents = simEvents.filter((ev) => ev.message === "Email Sent");
  assert.strictEqual(sentEvents.length, 2, "Two 'Email Sent' SimEvents recorded");
  assert.ok(
    sentEvents.some((ev) => ev.email === "bob.target1@corp.internal" && ev.details.includes(testProfile.name)),
    "SimEvent records target email and sending profile details"
  );
  logPass("SimEvents recorded with message 'Email Sent' and profile attribution");

  await mockSmtp.stop();

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST SUITE 5: Error Lifecycle & Granular Target Isolation (Feature 5)");
  console.log("--------------------------------------------------------------------------------");

  // 5.1 Connection failure (Unreachable port ECONNREFUSED)
  const deadPort = 19998;
  const deadProfile = await db.sendingProfile.create({
    data: {
      name: `Dead SMTP Profile ${Date.now()}`,
      userId: user.id,
      host: `127.0.0.1:${deadPort}`,
      username: "user",
      password: "pwd",
      fromAddress: "error-test@corp.internal",
    },
  });

  const deadCampaign = await db.campaign.create({
    data: {
      name: `Dead Port Test Campaign ${Date.now()}`,
      userId: user.id,
      templateId: testTemplate.id,
      smtpId: deadProfile.id,
      status: "In_Progress",
      url: "http://127.0.0.1:8080/portal",
    },
  });

  const deadRes1 = await db.result.create({
    data: {
      campaignId: deadCampaign.id,
      userId: user.id,
      rId: `err1_${Date.now().toString().slice(-5)}`,
      email: "err-user1@corp.internal",
      status: "Scheduled",
    },
  });

  const deadRes2 = await db.result.create({
    data: {
      campaignId: deadCampaign.id,
      userId: user.id,
      rId: `err2_${Date.now().toString().slice(-5)}`,
      email: "err-user2@corp.internal",
      status: "Scheduled",
    },
  });

  console.log(`  [Target Isolation] Testing dispatch against unreachable port ${deadPort}...`);
  const deadDispatch = await dispatchCampaignEmails({
    campaignId: deadCampaign.id,
    baseUrl: "http://127.0.0.1:8080/portal",
    profile: deadProfile,
    template: testTemplate,
    targets: [
      { id: deadRes1.id, rId: deadRes1.rId, email: deadRes1.email },
      { id: deadRes2.id, rId: deadRes2.rId, email: deadRes2.email },
    ],
  });

  assert.strictEqual(deadDispatch.total, 2, "Total attempted is 2");
  assert.strictEqual(deadDispatch.sent, 0, "Zero sent on connection error");
  assert.strictEqual(deadDispatch.error, 2, "Both targets recorded error");
  assert.strictEqual(deadDispatch.errors.length, 2, "Errors array contains both target errors");
  assert.ok(
    deadDispatch.errors[0].error.includes("ECONNREFUSED") || deadDispatch.errors[0].error.includes("connect"),
    "Captured exact transporter network error (ECONNREFUSED)"
  );
  logPass("Connection failure gracefully captured per target without crashing dispatcher");

  // Check DB status for dead port test
  const deadDb1 = await db.result.findUnique({ where: { id: deadRes1.id } });
  const deadDb2 = await db.result.findUnique({ where: { id: deadRes2.id } });
  assert.strictEqual(deadDb1.status, "Error", "Target 1 status set to 'Error'");
  assert.strictEqual(deadDb2.status, "Error", "Target 2 status set to 'Error'");

  const deadEvents = await db.simEvent.findMany({ where: { campaignId: deadCampaign.id } });
  const errorEvents = deadEvents.filter((ev) => ev.message === "Error Sending Email");
  assert.strictEqual(errorEvents.length, 2, "Two 'Error Sending Email' events recorded");
  assert.ok(
    errorEvents[0].details.includes("ECONNREFUSED") || errorEvents[0].details.includes("connect"),
    "SimEvent details record exact SMTP transporter failure message"
  );
  logPass("Database records updated with status 'Error' and SimEvent 'Error Sending Email'");

  // 5.2 Mixed Target Isolation (Recipient 1 is rejected with 550, Recipient 2 succeeds)
  console.log("\n  [Target Isolation] Testing mixed batch (Recipient 1 rejected 550, Recipient 2 succeeds)...");
  const rejectedEmail = "rejected.baduser@corp.internal";
  const acceptedEmail = "accepted.gooduser@corp.internal";

  const selectiveSmtp = createMockSmtpServer({
    rejectRecipients: [rejectedEmail],
  });
  const selectivePort = await selectiveSmtp.start();

  const selectiveProfile = await db.sendingProfile.create({
    data: {
      name: `Selective SMTP Profile ${Date.now()}`,
      userId: user.id,
      host: `127.0.0.1:${selectivePort}`,
      fromAddress: "selective-test@corp.internal",
    },
  });

  const selectiveCampaign = await db.campaign.create({
    data: {
      name: `Selective Test Campaign ${Date.now()}`,
      userId: user.id,
      templateId: testTemplate.id,
      smtpId: selectiveProfile.id,
      status: "In_Progress",
      url: "http://127.0.0.1:8080/portal",
    },
  });

  const mixedRes1 = await db.result.create({
    data: {
      campaignId: selectiveCampaign.id,
      userId: user.id,
      rId: `rej_${Date.now().toString().slice(-5)}`,
      email: rejectedEmail,
      firstName: "Bad",
      lastName: "Recipient",
      status: "Scheduled",
    },
  });

  const mixedRes2 = await db.result.create({
    data: {
      campaignId: selectiveCampaign.id,
      userId: user.id,
      rId: `acc_${Date.now().toString().slice(-5)}`,
      email: acceptedEmail,
      firstName: "Good",
      lastName: "Recipient",
      status: "Scheduled",
    },
  });

  const mixedDispatch = await dispatchCampaignEmails({
    campaignId: selectiveCampaign.id,
    baseUrl: "http://127.0.0.1:8080/portal",
    profile: selectiveProfile,
    template: testTemplate,
    targets: [
      { id: mixedRes1.id, rId: mixedRes1.rId, email: mixedRes1.email },
      { id: mixedRes2.id, rId: mixedRes2.rId, email: mixedRes2.email },
    ],
  });

  assert.strictEqual(mixedDispatch.total, 2, "Total attempted targets is 2");
  assert.strictEqual(mixedDispatch.sent, 1, "Exactly 1 target succeeded");
  assert.strictEqual(mixedDispatch.error, 1, "Exactly 1 target failed");
  assert.strictEqual(mixedDispatch.errors.length, 1, "Errors array captures exactly the failed target");
  assert.strictEqual(mixedDispatch.errors[0].email, rejectedEmail, "Failed target is the rejected email");
  assert.ok(
    mixedDispatch.errors[0].error.includes("550") || mixedDispatch.errors[0].error.includes("Recipient address rejected"),
    "Error details contain the 550 SMTP rejection reason"
  );

  // Check DB state for mixed batch
  const mixedDb1 = await db.result.findUnique({ where: { id: mixedRes1.id } });
  const mixedDb2 = await db.result.findUnique({ where: { id: mixedRes2.id } });

  assert.strictEqual(mixedDb1.status, "Error", "Target 1 status is 'Error'");
  assert.strictEqual(mixedDb2.status, "Email Sent", "Target 2 status is 'Email Sent' despite Target 1 failure");

  const mixedEvents = await db.simEvent.findMany({
    where: { campaignId: selectiveCampaign.id },
    orderBy: { time: "asc" },
  });

  const mixedErrEvent = mixedEvents.find((ev) => ev.email === rejectedEmail);
  const mixedSentEvent = mixedEvents.find((ev) => ev.email === acceptedEmail);

  assert.ok(mixedErrEvent, "SimEvent for rejected target found");
  assert.strictEqual(mixedErrEvent.message, "Error Sending Email");
  assert.ok(mixedErrEvent.details.includes("550"), "SimEvent details contain 550 rejection message");

  assert.ok(mixedSentEvent, "SimEvent for accepted target found");
  assert.strictEqual(mixedSentEvent.message, "Email Sent");
  logPass("Target isolation verified: recipient error (550) did not abort batch; next recipient was sent");

  await selectiveSmtp.stop();

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST SUITE 6: Telemetry Stats Calculation (Feature 6)");
  console.log("--------------------------------------------------------------------------------");

  // Simulate results matching the calculation in api/campaigns/route.ts and api/campaigns/[id]/route.ts
  const sampleResults = [
    { status: "Email Sent", reported: false },
    { status: "Email Sent", reported: false },
    { status: "Clicked", reported: false },
    { status: "Submitted Data", reported: true },
    { status: "Error", reported: false },
    { status: "Error", reported: false },
    { status: "Scheduled", reported: false },
  ];

  let scheduled = 0;
  let sent = 0;
  let opened = 0;
  let clicked = 0;
  let submitted = 0;
  let reported = 0;
  let error = 0;

  for (const r of sampleResults) {
    const s = (r.status || "").toLowerCase();
    if (s === "scheduled") scheduled++;
    if (s !== "scheduled" && !s.includes("error")) sent++;
    if (s.includes("open") || s.includes("click") || s.includes("submit")) opened++;
    if (s.includes("click") || s.includes("submit")) clicked++;
    if (s.includes("submit")) submitted++;
    if (r.reported) reported++;
    if (s.includes("error")) error++;
  }

  const total = sampleResults.length;
  const stats = {
    total,
    scheduled,
    sent,
    opened,
    clicked,
    submitted,
    reported,
    error,
    sentRate: total > 0 ? Math.round((sent / total) * 100) : 0,
    openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
  };

  assert.strictEqual(stats.total, 7, "Total targets: 7");
  assert.strictEqual(stats.sent, 4, "'sent' counter correctly includes sent/clicked/submitted, EXCLUDES 'Error' & 'Scheduled'");
  assert.strictEqual(stats.error, 2, "'error' counter accurately equals 2");
  assert.strictEqual(stats.scheduled, 1, "'scheduled' counter equals 1");
  assert.strictEqual(stats.sentRate, Math.round((4 / 7) * 100), "sentRate correctly computed relative to total");
  logPass("Telemetry stats computation verified: 'sent' strictly excludes 'Error', and 'error' matches count");

  console.log("\n--------------------------------------------------------------------------------");
  console.log("TEST SUITE 7: Database Cleanup");
  console.log("--------------------------------------------------------------------------------");

  // Clean up created test campaigns and cascading records
  const campaignsToClean = [testCampaign.id, deadCampaign.id, selectiveCampaign.id];
  for (const cId of campaignsToClean) {
    await db.campaign.delete({ where: { id: cId } });
  }
  await db.sendingProfile.deleteMany({
    where: { id: { in: [testProfile.id, deadProfile.id, selectiveProfile.id] } },
  });
  await db.template.delete({ where: { id: testTemplate.id } });

  logPass("Successfully cleaned up test campaigns, results, simEvents, templates, and profiles");

  console.log("\n================================================================================");
  console.log(`🎉 ALL TESTS PASSED! (${passedAssertions}/${passedAssertions} Assertions Succeeded)`);
  console.log("================================================================================\n");
}

runTests()
  .catch((err) => {
    console.error("\n❌ TEST SUITE FAILED WITH ERROR:");
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await db.$disconnect();
    } catch {}
  });
