import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSessionCookie, verifySession } from "@/lib/session";

export async function GET(req: Request) {
  const token = readSessionCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const groups = await db.group.findMany({
      where: { userId: session.userId },
      include: {
        _count: {
          select: { targets: true },
        },
      },
      orderBy: { modifiedDate: "desc" },
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Failed to fetch groups:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const token = readSessionCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name } = body;
    
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Generate random id for SQLite since it's not autoincrement in this schema?
    // Let's assume Prisma handles it if it's autoincrement, wait, the schema is `@id Int`, let me check if it's autoincrement. If not, I should generate it.
    // Actually, I can just use a unique ID based on timestamp or something, or let DB handle it if it's autoincrement.
    // Let's do a simple count or use a random integer.
    const id = Math.floor(Math.random() * 1000000);

    const group = await db.group.create({
      data: {
        id,
        userId: session.userId,
        name,
        modifiedDate: new Date(),
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error("Failed to create group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
