import { NextResponse } from "next/server";
import { sessionCookie } from "@/lib/session";

export async function POST() {
  return NextResponse.json({ ok: true }, {
    headers: { "Set-Cookie": sessionCookie(null) },
  });
}
