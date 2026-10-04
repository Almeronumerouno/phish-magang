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

export async function POST(
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
    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group || group.userId !== session.userId) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const body = await req.json();
    const { firstName, lastName, email, position } = body;
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    let target = await db.target.findFirst({ where: { email: email.trim() } });
    if (!target) {
      target = await db.target.create({
        data: {
          firstName: firstName?.trim() || null,
          lastName: lastName?.trim() || null,
          email: email.trim(),
          position: position?.trim() || null,
        },
      });
    }

    await db.groupTarget.upsert({
      where: { groupId_targetId: { groupId, targetId: target.id } },
      update: {},
      create: { groupId, targetId: target.id },
    });

    await db.group.update({ where: { id: groupId }, data: { modifiedDate: new Date() } });

    return NextResponse.json({ ok: true, target });
  } catch (error) {
    console.error("Failed to add member:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
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
    const targetId = parseInt(new URL(req.url).searchParams.get("targetId") || "", 10);
    if (!targetId) {
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });
    }

    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group || group.userId !== session.userId) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    await db.groupTarget.deleteMany({ where: { groupId, targetId } });
    // Hapus targetnya kalau sudah tidak dipakai group mana pun
    const remaining = await db.groupTarget.findMany({ where: { targetId } });
    if (remaining.length === 0) {
      await db.target.deleteMany({ where: { id: targetId } });
    }

    await db.group.update({ where: { id: groupId }, data: { modifiedDate: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete member:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
