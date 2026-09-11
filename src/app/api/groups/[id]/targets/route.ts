import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSessionCookie, verifySession } from "@/lib/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = readSessionCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const session = verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const groupId = parseInt(id, 10);

    // Verify group belongs to user
    const group = await db.group.findUnique({
      where: { id: groupId },
    });

    if (!group || group.userId !== session.userId) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const groupTargets = await db.groupTarget.findMany({
      where: { groupId },
      include: {
        target: true,
      },
    });

    const targets = groupTargets.map((gt) => gt.target);

    return NextResponse.json(targets);
  } catch (error) {
    console.error("Failed to fetch targets:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
