import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signSession, sessionCookie, generateApiKey } from "@/lib/session";

function normalize(username: unknown): string {
  return typeof username === "string" ? username.trim().toLowerCase() : "";
}

function isValidUsername(username: string): boolean {
  return /^[a-z0-9._@-]{3,64}$/.test(username);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = normalize(body?.username);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username) {
    return NextResponse.json({ error: "Please enter a username." }, { status: 400 });
  }
  if (!isValidUsername(username)) {
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
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this username already exists." },
      { status: 409 },
    );
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: { username, hash, apiKey: generateApiKey() },
  });

  return NextResponse.json({ username: user.username }, {
    status: 201,
    headers: { "Set-Cookie": sessionCookie(signSession(user.id)) },
  });
}
