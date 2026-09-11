import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySession, readSessionCookie } from "@/lib/session";

export async function GET(req: Request) {
  const token = readSessionCookie(req.headers.get("cookie"));
  if (!token) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const session = verifySession(token);
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json({ username: user.username });
}
