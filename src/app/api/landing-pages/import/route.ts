import { NextResponse } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/session";

const MAX_BYTES = 500 * 1024;

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

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch URL." }, { status: 400 });
  }
  if (!res.ok) return NextResponse.json({ error: "Failed to fetch URL." }, { status: 400 });

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("html") && !contentType.includes("xhtml"))
    return NextResponse.json({ error: "URL did not return HTML." }, { status: 400 });

  if (!res.body) return NextResponse.json({ error: "URL did not return HTML." }, { status: 400 });
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel().catch(() => {});
      return NextResponse.json({ error: "Page exceeds 500KB limit." }, { status: 413 });
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  const html = new TextDecoder().decode(merged);
  if (!html.trim()) return NextResponse.json({ error: "URL did not return HTML." }, { status: 400 });
  return NextResponse.json({ html });
}
