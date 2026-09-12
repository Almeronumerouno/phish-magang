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

async function findOwned(id: number, userId: number) {
  const page = await db.landingPage.findUnique({ where: { id }, select: { ...select, userId: true } });
  if (!page) return null;
  if (page.userId !== null && page.userId !== userId) return null;
  return page;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt((await params).id, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const page = await findOwned(id, session.userId);
  if (!page) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({
    id: page.id,
    name: page.name,
    html: page.html,
    captureCredentials: page.captureCredentials,
    capturePasswords: page.capturePasswords,
    redirectUrl: page.redirectUrl,
    modifiedDate: page.modifiedDate,
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt((await params).id, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const existing = await findOwned(id, session.userId);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  const data: {
    name?: string;
    html?: string;
    captureCredentials?: boolean;
    capturePasswords?: boolean;
    redirectUrl?: string | null;
  } = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Page name is required." }, { status: 400 });
    data.name = name;
  }
  if ("html" in body) {
    if (typeof body.html !== "string" || !body.html.trim())
      return NextResponse.json({ error: "HTML content is required." }, { status: 400 });
    data.html = body.html;
  }
  if ("captureCredentials" in body) data.captureCredentials = body.captureCredentials === true;
  if ("capturePasswords" in body) data.capturePasswords = body.capturePasswords === true;
  if ("redirectUrl" in body)
    data.redirectUrl = body.redirectUrl === null || body.redirectUrl === undefined || body.redirectUrl === "" ? null : String(body.redirectUrl);

  const nextCapture = data.captureCredentials ?? existing.captureCredentials;
  if (!nextCapture) data.capturePasswords = false;
  else if (data.captureCredentials === true && !("capturePasswords" in body)) data.capturePasswords = false;

  const page = await db.landingPage.update({
    where: { id },
    data: { ...data, modifiedDate: new Date() },
    select,
  });
  return NextResponse.json(page);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt((await params).id, 10);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const existing = await findOwned(id, session.userId);
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await db.campaign.updateMany({ where: { pageId: id }, data: { pageId: null } });
  await db.landingPage.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
