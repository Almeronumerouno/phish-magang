import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSessionCookie, verifySession } from "@/lib/session";

function getSession(req: Request) {
  const token = readSessionCookie(req.headers.get("cookie"));
  if (!token) return null;
  return verifySession(token);
}

const select = {
  id: true,
  name: true,
  html: true,
  captureCredentials: true,
  capturePasswords: true,
  redirectUrl: true,
  modifiedDate: true,
};

export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pages = await db.landingPage.findMany({
    where: { OR: [{ userId: session.userId }, { userId: null }] },
    orderBy: { modifiedDate: "desc" },
    select,
  });
  return NextResponse.json(pages);
}

export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const html = typeof body?.html === "string" ? body.html : "";
  if (!name) return NextResponse.json({ error: "Page name is required." }, { status: 400 });
  if (!html.trim()) return NextResponse.json({ error: "HTML content is required." }, { status: 400 });
  const captureCredentials = body?.captureCredentials === true;
  const capturePasswords = captureCredentials && body?.capturePasswords === true;
  const redirectUrl = typeof body?.redirectUrl === "string" ? body.redirectUrl.trim() : null;
  const page = await db.landingPage.create({
    data: {
      userId: session.userId,
      name,
      html,
      captureCredentials,
      capturePasswords,
      redirectUrl,
      modifiedDate: new Date(),
    },
    select,
  });
  return NextResponse.json(page, { status: 201 });
}
