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
    const { name, members } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (members !== undefined && !Array.isArray(members)) {
      return NextResponse.json({ error: "Members must be an array" }, { status: 400 });
    }

    const rows: Array<{
      firstName: string | null;
      lastName: string | null;
      email: string;
      position: string | null;
    }> = Array.isArray(members) ? members : [];

    for (const m of rows) {
      if (!m.email || typeof m.email !== "string") {
        return NextResponse.json({ error: "Each member needs an email" }, { status: 400 });
      }
    }

    const group = await db.group.create({
      data: {
        userId: session.userId,
        name,
        modifiedDate: new Date(),
        ...(rows.length > 0
          ? {
              targets: {
                create: rows.map((m) => ({
                  target: {
                    create: {
                      firstName: m.firstName ?? null,
                      lastName: m.lastName ?? null,
                      email: m.email,
                      position: m.position ?? null,
                    },
                  },
                })),
              },
            }
          : {}),
      },
      include: { _count: { select: { targets: true } } },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error("Failed to create group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
