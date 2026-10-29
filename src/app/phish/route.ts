import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// 1x1 Transparent GIF byte payload for tracking pixel
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "127.0.0.1";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rId = url.searchParams.get("rid") || url.searchParams.get("rId");
  const isTrack = url.searchParams.get("track") === "true" || url.pathname.endsWith("/track");
  const isReport = url.searchParams.get("report") === "true" || url.pathname.endsWith("/report");
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "Unknown";

  // Case 1: Tracking Pixel (/phish?track=true&rid=... or /phish/track?rid=...)
  if (isTrack) {
    if (rId) {
      try {
        const result = await db.result.findUnique({ where: { rId } });
        if (result) {
          const s = (result.status || "").toLowerCase();
          if (s.includes("sent") || s.includes("sched")) {
            await db.result.update({
              where: { id: result.id },
              data: { status: "Email Opened", ip },
            });
          }
          await db.simEvent.create({
            data: {
              campaignId: result.campaignId,
              email: result.email,
              message: "Email Opened",
              details: JSON.stringify({ ip, userAgent }),
            },
          });
        }
      } catch (err) {
        console.error("Error logging open in Next.js phish handler:", err);
      }
    }

    return new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Content-Length": String(TRACKING_PIXEL.length),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  }

  // Case 2: Target Reports Phishing (/phish?report=true&rid=...)
  if (isReport) {
    if (rId) {
      try {
        const result = await db.result.findUnique({ where: { rId } });
        if (result) {
          await db.result.update({
            where: { id: result.id },
            data: { reported: true },
          });
          await db.simEvent.create({
            data: {
              campaignId: result.campaignId,
              email: result.email,
              message: "Email Reported",
              details: JSON.stringify({ ip, userAgent }),
            },
          });
        }
      } catch (err) {
        console.error("Error logging report in Next.js phish handler:", err);
      }
    }

    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head><title>Laporan Phishing Diterima</title><meta name="viewport" content="width=device-width, initial-scale=1"/><style>body { font-family: -apple-system, sans-serif; background: #f4f6f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; } .c { background: #fff; padding: 32px; border-radius: 12px; max-width: 440px; text-align: center; border-top: 4px solid #10b981; box-shadow: 0 4px 12px rgba(0,0,0,0.08); } h2 { margin-top: 0; color: #111827; } p { color: #4b5563; font-size: 14px; line-height: 1.5; }</style></head>
        <body><div class="c"><h2>Terima Kasih Telah Melaporkan!</h2><p>Anda berhasil mengidentifikasi simulasi latihan phishing ini. Kesadaran keamanan Anda membantu menjaga organisasi tetap aman.</p></div></body>
      </html>`,
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Case 3: Target Clicks Link (/phish?rid=...)
  if (rId) {
    try {
      const result = await db.result.findUnique({
        where: { rId },
        include: { campaign: { include: { page: true } } },
      });

      if (result) {
        const s = (result.status || "").toLowerCase();
        if (!s.includes("submit")) {
          await db.result.update({
            where: { id: result.id },
            data: { status: "Clicked Link", ip },
          });
        }

        await db.simEvent.create({
          data: {
            campaignId: result.campaignId,
            email: result.email,
            message: "Clicked Link",
            details: JSON.stringify({ ip, userAgent, path: url.pathname }),
          },
        });

        const landingHtml = result.campaign.page?.html;
        if (landingHtml && landingHtml.trim()) {
          const modifiedHtml = landingHtml.replace(
            /(<form\b[^>]*>)/gi,
            `$1\n\t<input type="hidden" name="rid" value="${rId}"/>`
          );
          return new NextResponse(modifiedHtml, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      }
    } catch (err) {
      console.error("Error logging click in Next.js phish handler:", err);
    }
  }

  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0f172a;color:#e2e8f0;"><h2>Listener Simulasi Phishing Aktif</h2><p>Interaksi target dengan parameter token (?rid=...) dipantau secara real-time.</p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  let rId = url.searchParams.get("rid") || url.searchParams.get("rId");
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") || "Unknown";

  let formData: Record<string, any> = {};
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      formData = await req.json();
    } else {
      const form = await req.formData();
      form.forEach((value, key) => {
        formData[key] = value;
      });
    }
  } catch {
    formData = {};
  }

  if (!rId && formData.rid) rId = String(formData.rid);
  if (!rId && formData.rId) rId = String(formData.rId);

  if (rId) {
    try {
      const result = await db.result.findUnique({
        where: { rId },
        include: { campaign: { include: { page: true } } },
      });

      if (result) {
        const page = result.campaign.page;
        const captureCreds = page?.captureCredentials !== false;
        const capturePasswords = page?.capturePasswords === true;

        const capturedPayload: Record<string, any> = {};
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

        await db.result.update({
          where: { id: result.id },
          data: { status: "Submitted Data", ip },
        });

        await db.simEvent.create({
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

        if (page?.redirectUrl) {
          return NextResponse.redirect(page.redirectUrl, 302);
        }
      }
    } catch (err) {
      console.error("Error logging submission in Next.js phish handler:", err);
    }
  }

  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#fef2f2;color:#991b1b;"><h2>Pemberitahuan Simulasi</h2><p>Kredensial dikirimkan ke dalam simulasi latihan keamanan. Silakan hubungi tim Keamanan IT Anda untuk panduan kesadaran keamanan.</p></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
