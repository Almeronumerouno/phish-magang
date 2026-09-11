import { NextResponse } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pages = await db.landingPage.findMany({
      orderBy: { modifiedDate: "desc" },
    });

    return NextResponse.json(pages);
  } catch (error) {
    console.error("Error fetching landing pages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, html, redirectUrl, captureCredentials, capturePasswords } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Generate random id (assuming Int @id)
    const id = Math.floor(Math.random() * 1000000000);

    const page = await db.landingPage.create({
      data: {
        id,
        userId: session.userId,
        name,
        html: html || "",
        modifiedDate: new Date(),
        captureCredentials: captureCredentials ?? true,
        capturePasswords: capturePasswords ?? true,
        redirectUrl: redirectUrl || null,
      },
    });

    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    console.error("Error creating landing page:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
