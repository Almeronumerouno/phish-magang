import { NextResponse } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/session";
import http from "node:http";
import https from "node:https";

function fetchTargetSite(targetUrl: string, maxRedirects = 10): Promise<{ finalUrl: string; html: string }> {
  return new Promise((resolve, reject) => {
    function requestHop(currentUrl: string, hops: number) {
      if (hops > maxRedirects) {
        return reject(new Error("Terlalu banyak redirect (max 10)."));
      }

      let parsed: URL;
      try {
        parsed = new URL(currentUrl);
      } catch {
        return reject(new Error("URL tidak valid."));
      }

      const isHttps = parsed.protocol === "https:";
      const mod = isHttps ? https : http;

      const options = {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        },
        rejectUnauthorized: false, // GoPhish behavior: InsecureSkipVerify = true
      };

      const req = mod.request(options, (res) => {
        // Follow redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
          try {
            const nextUrl = new URL(res.headers.location, currentUrl).href;
            return requestHop(nextUrl, hops + 1);
          } catch {
            // If location is unparseable, continue reading body
          }
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (!body || body.trim().length === 0) {
            return reject(new Error("Halaman website kosong atau tidak dapat diakses."));
          }
          resolve({ finalUrl: currentUrl, html: body });
        });
      });

      req.on("error", (err) => {
        reject(new Error(`Gagal menghubungi server target: ${err.message}`));
      });

      req.setTimeout(15000, () => {
        req.destroy(new Error("Koneksi timeout setelah 15 detik."));
      });

      req.end();
    }

    requestHop(targetUrl, 0);
  });
}

function transformGophish(html: string, siteUrl: string): string {
  let result = html;

  // 1. Insert <base href="%s"> at the beginning of <head> if not already present
  if (!/<base\b/i.test(result)) {
    const baseTag = `<base href="${siteUrl}"/>`;
    if (/<head[^>]*>/i.test(result)) {
      result = result.replace(/<head[^>]*>/i, (match) => `${match}\n\t${baseTag}`);
    } else {
      result = `${baseTag}\n${result}`;
    }
  }

  // 2. GoPhish Form logic:
  // For each <form>, find the original action, prepend <input type="hidden" name="__original_url" value="..."/>
  // and set action="" so the form will submit to phishing listener
  result = result.replace(/<form\b([\s\S]*?)>/gi, (formTag, inside) => {
    // Extract existing action
    const actionMatch = inside.match(/action=["']([^"']*)["']/i);
    let origUrl = actionMatch ? actionMatch[1].trim() : siteUrl;

    if (!origUrl) {
      origUrl = siteUrl;
    } else if (!origUrl.startsWith("http://") && !origUrl.startsWith("https://")) {
      try {
        origUrl = new URL(origUrl, siteUrl).href;
      } catch {
        origUrl = siteUrl;
      }
    }

    const hiddenField = `<input type="hidden" name="__original_url" value="${origUrl.replace(/"/g, "&quot;")}"/>`;

    // Rewrite action to empty string "" (standard GoPhish template)
    let newInside = inside;
    if (actionMatch) {
      newInside = inside.replace(/action=["'][^"']*["']/i, 'action=""');
    } else {
      newInside = `${inside} action=""`;
    }

    return `<form${newInside}>\n\t${hiddenField}`;
  });

  return result;
}

export async function POST(req: Request) {
  const token = readSessionCookie(req.headers.get("cookie"));
  if (!token || !verifySession(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

  if (!rawUrl) {
    return NextResponse.json({ error: "No URL Specified!" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Enter a valid http(s) URL." }, { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Enter a valid http(s) URL." }, { status: 400 });
  }

  try {
    const { finalUrl, html } = await fetchTargetSite(parsed.toString());
    const transformedHtml = transformGophish(html, finalUrl);

    return NextResponse.json({
      html: transformedHtml,
      redirectUrl: finalUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal meng-import website.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
