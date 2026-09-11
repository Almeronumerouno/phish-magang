import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await db.sendingProfile.findMany({
      where: { userId: session.userId },
      select: {
        id: true,
        name: true,
        host: true,
        fromAddress: true,
        modifiedDate: true,
      },
      orderBy: { modifiedDate: 'desc' }
    });

    return NextResponse.json(profiles);
  } catch (error) {
    console.error("Error fetching sending profiles:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await req.json();

    // Determine the next available ID
    const maxProfile = await db.sendingProfile.findFirst({
      orderBy: { id: 'desc' }
    });
    const nextId = (maxProfile?.id || 0) + 1;

    const newProfile = await db.sendingProfile.create({
      data: {
        id: nextId,
        userId: session.userId,
        name: data.name,
        host: data.host,
        fromAddress: data.fromAddress,
        username: data.username || "",
        password: data.password || "",
        interfaceType: "SMTP",
        ignoreCertErrors: true,
        modifiedDate: new Date(),
      }
    });

    // Don't return password
    const { password, ...safeProfile } = newProfile;
    return NextResponse.json(safeProfile, { status: 201 });
  } catch (error) {
    console.error("Error creating sending profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
