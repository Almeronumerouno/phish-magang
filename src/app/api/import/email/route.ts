import { NextResponse } from "next/server";
import { parseRawEmail } from "@/lib/mime-parser";
import { readSessionCookie, verifySession } from "@/lib/session";

function getSession(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const token = readSessionCookie(cookieHeader);
  if (token) {
    const s = verifySession(token);
    if (s) return s;
  }
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const bearer = auth.slice(7).trim();
    const s = verifySession(bearer);
    if (s) return s;
  }
  return null;
}

export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "No Content Specified!", message: "No Content Specified!" },
        { status: 400 }
      );
    }

    const content = typeof body.content === "string" ? body.content : "";
    if (!content.trim()) {
      return NextResponse.json(
        { error: "No Content Specified!", message: "No Content Specified!" },
        { status: 400 }
      );
    }

    const convertLinks = body.convert_links === true || body.convertLinks === true;
    const parsed = parseRawEmail(content, convertLinks);

    return NextResponse.json({
      subject: parsed.subject,
      text: parsed.text,
      html: parsed.html,
    });
  } catch (error) {
    console.error("Failed to parse email import:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
