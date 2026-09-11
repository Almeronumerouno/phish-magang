import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signSession, sessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const raw = body?.username;
  const username = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username) {
    return NextResponse.json(
      { error: "Please enter a username." },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9._@-]{3,64}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-64 characters (letters, numbers, . _ - @)." },
      { status: 400 },
    );
  }
  if (!password) {
    return NextResponse.json(
      { error: "Password is required." },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.hash))) {
    return NextResponse.json(
      { error: "Incorrect username or password." },
      { status: 401 },
    );
  }
  if (user.accountLocked) {
    return NextResponse.json(
      { error: "Account is locked." },
      { status: 403 },
    );
  }

  await db.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  return NextResponse.json({ username: user.username }, {
    headers: { "Set-Cookie": sessionCookie(signSession(user.id)) },
  });
}
