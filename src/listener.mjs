import http from "node:http";
import { URL } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PORT = process.env.PHISH_PORT ? parseInt(process.env.PHISH_PORT) : 8080;
const HOST = "0.0.0.0";

// 1x1 Transparent GIF byte payload for tracking pixel
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "127.0.0.1";
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      // Protect against memory exhaustion (max 1MB)
      if (body.length > 1024 * 1024) {
        req.destroy();
        resolve({});
      }
    });
    req.on("end", () => {
      try {
        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("application/json")) {
          resolve(JSON.parse(body));
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          const params = new URLSearchParams(body);
          const obj = {};
          for (const [key, val] of params.entries()) {
            obj[key] = val;
          }
          resolve(obj);
        } else {
          resolve({ raw: body });
        }
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const rId = parsedUrl.searchParams.get("rid") || parsedUrl.searchParams.get("rId");
  const ip = getClientIp(req);
  const userAgent = req.headers["user-agent"] || "Unknown";

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route 0: Health / Status Check (GET /health, GET /ping)
  if (pathname === "/health" || pathname === "/ping") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "phishing-listener", port: PORT, host: HOST }));
    return;
  }

  // Route 1: Email Tracking Pixel (GET /track?rid=...)
  if (pathname === "/track" || pathname === "/track/") {
    res.writeHead(200, {
      "Content-Type": "image/gif",
      "Content-Length": TRACKING_PIXEL.length,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    });
    res.end(TRACKING_PIXEL);

    if (rId) {
      try {
        const result = await prisma.result.findUnique({
          where: { rId },
          include: { campaign: true },
        });

        if (result) {
          // If status is currently Email Sent or Scheduled, upgrade to Email Opened
          const s = (result.status || "").toLowerCase();
          if (s.includes("sent") || s.includes("sched")) {
            await prisma.result.update({
              where: { id: result.id },
              data: { status: "Email Opened", ip },
            });
          }

          // Record SimEvent
          await prisma.simEvent.create({
            data: {
              campaignId: result.campaignId,
              email: result.email,
              message: "Email Opened",
              details: JSON.stringify({ ip, userAgent }),
            },
          });
          console.log(`[Phish Server] Target "${result.email}" opened email (rId: ${rId}) from ${ip}`);
        }
      } catch (err) {
        console.error("[Phish Server] Error tracking email open:", err);
      }
    }
    return;
  }

  // Route 2: Target Reports Phishing (GET /report?rid=...)
  if (pathname === "/report" || pathname === "/report/") {
    if (rId) {
      try {
        const result = await prisma.result.findUnique({
          where: { rId },
        });

        if (result) {
          await prisma.result.update({
            where: { id: result.id },
            data: { reported: true },
          });

          await prisma.simEvent.create({
            data: {
              campaignId: result.campaignId,
              email: result.email,
              message: "Email Reported",
              details: JSON.stringify({ ip, userAgent }),
            },
          });
          console.log(`[Phish Server] Target "${result.email}" reported phishing email (rId: ${rId})`);
        }
      } catch (err) {
        console.error("[Phish Server] Error recording report:", err);
      }
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Phishing Report Received</title>
          <meta name="viewport" content="width=device-width, initial-scale=1"/>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f6f8; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
            .card { background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); max-width: 480px; text-align: center; border-top: 4px solid #10b981; }
            h2 { color: #111827; margin-top: 0; }
            p { color: #4b5563; line-height: 1.6; font-size: 14px; }
            .badge { display: inline-block; background: #ecfdf5; color: #065f46; font-weight: 600; padding: 6px 14px; rounded: 9999px; font-size: 12px; margin-bottom: 16px; border: 1px solid #a7f3d0; border-radius: 9999px; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">Security Awareness Telemetry</span>
            <h2>Thank You For Reporting!</h2>
            <p>You successfully identified and reported this simulated phishing exercise. Your vigilance helps keep our organization secure against real-world social engineering attacks.</p>
          </div>
        </body>
      </html>
    `);
    return;
  }

  // Route 3: Form Submission / Credential Capture (POST /*)
  if (req.method === "POST") {
    const formData = await parseBody(req);
    const postRId = rId || formData.rid || formData.rId || formData.__rid;

    if (postRId) {
      try {
        const result = await prisma.result.findUnique({
          where: { rId: postRId },
          include: { campaign: { include: { page: true } } },
        });

        if (result) {
          const page = result.campaign.page;
          const captureCreds = page?.captureCredentials !== false;
          const capturePasswords = page?.capturePasswords === true;

          // Process and sanitize captured fields
          const capturedPayload = {};
          if (captureCreds) {
            for (const [key, val] of Object.entries(formData)) {
              if (key === "__original_url" || key === "rid" || key === "rId") continue;
              const isPassword = /pass|pwd|secret/i.test(key);
              if (isPassword && !capturePasswords) {
                capturedPayload[key] = "******** (masked)";
              } else {
                capturedPayload[key] = typeof val === "string" ? val.slice(0, 200) : val;
              }
            }
          }

          // Update Result status
          await prisma.result.update({
            where: { id: result.id },
            data: { status: "Submitted Data", ip },
          });

          // Record SimEvent
          await prisma.simEvent.create({
            data: {
              campaignId: result.campaignId,
              email: result.email,
              message: "Submitted Data",
              details: JSON.stringify({
                ip,
                userAgent,
                capturedFields: Object.keys(capturedPayload),
                payload: capturedPayload,
              }),
            },
          });

          console.log(`[Phish Server] Target "${result.email}" submitted credentials (rId: ${postRId}) from ${ip}`);

          // Redirect to target URL if configured
          if (page?.redirectUrl) {
            res.writeHead(302, { Location: page.redirectUrl });
            res.end();
            return;
          }
        }
      } catch (err) {
        console.error("[Phish Server] Error handling form submission:", err);
      }
    }

    // Default response if no redirectUrl
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Security Awareness Notice</title>
          <meta name="viewport" content="width=device-width, initial-scale=1"/>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff1f2; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
            .card { background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); max-width: 480px; text-align: center; border-top: 4px solid #ef4444; }
            h2 { color: #991b1b; margin-top: 0; }
            p { color: #4b5563; line-height: 1.6; font-size: 14px; }
            .badge { display: inline-block; background: #fef2f2; color: #b91c1c; font-weight: 600; padding: 6px 14px; border-radius: 9999px; font-size: 12px; margin-bottom: 16px; border: 1px solid #fecaca; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">Security Awareness Simulation</span>
            <h2>Simulation Notice</h2>
            <p>This was a controlled organizational phishing simulation. No credentials have been stored in cleartext. Please review company security awareness guidelines on verifying sender legitimacy and URL domains.</p>
          </div>
        </body>
      </html>
    `);
    return;
  }

  // Route 4: Target Clicks Link (GET /*?rid=...)
  if (rId) {
    try {
      const result = await prisma.result.findUnique({
        where: { rId },
        include: {
          campaign: {
            include: { page: true },
          },
        },
      });

      if (result) {
        const s = (result.status || "").toLowerCase();
        // Upgrade to Clicked Link if not already submitted
        if (!s.includes("submit")) {
          await prisma.result.update({
            where: { id: result.id },
            data: { status: "Clicked Link", ip },
          });
        }

        // Record SimEvent
        await prisma.simEvent.create({
          data: {
            campaignId: result.campaignId,
            email: result.email,
            message: "Clicked Link",
            details: JSON.stringify({ ip, userAgent, path: pathname }),
          },
        });

        console.log(`[Phish Server] Target "${result.email}" clicked link (rId: ${rId}) from ${ip}`);

        // Render Landing Page HTML if available
        const landingHtml = result.campaign.page?.html;
        if (landingHtml && landingHtml.trim()) {
          // Inject hidden input for rId in all forms so submission tracks back
          const modifiedHtml = landingHtml.replace(
            /(<form\b[^>]*>)/gi,
            `$1\n\t<input type="hidden" name="rid" value="${rId}"/>`
          );

          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(modifiedHtml);
          return;
        }
      }
    } catch (err) {
      console.error("[Phish Server] Error handling link click:", err);
    }
  }

  // Default Landing if accessed without rId or landing page
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Simulation Listener</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; text-align: center; }
          .box { background: #1e293b; border: 1px solid #334155; padding: 32px; border-radius: 12px; max-width: 440px; }
          h1 { font-size: 20px; margin-bottom: 8px; color: #38bdf8; }
          p { font-size: 13px; color: #94a3b8; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Phishing Simulation Listener</h1>
          <p>Listener service is active and operational. Target email lures with tracking parameters will automatically record telemetry upon victim interaction.</p>
        </div>
      </body>
    </html>
  `);
});

server.listen(PORT, HOST, () => {
  console.log(`\n==================================================`);
  console.log(`🎣 GoPhish-Style Phishing Server Active`);
  console.log(`Listening on: http://${HOST}:${PORT}`);
  console.log(`Local Access: http://127.0.0.1:${PORT}`);
  console.log(`Ready to receive target interactions (?rid=...)`);
  console.log(`==================================================\n`);
});
