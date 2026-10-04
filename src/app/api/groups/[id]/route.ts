import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSessionCookie, verifySession } from "@/lib/session";

async function ownedGroup(groupId: number, userId: number) {
  const group = await db.group.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== userId) return null;
  return group;
}

export async function PUT(
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
    if (!await ownedGroup(groupId, session.userId)) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, members } = body;
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const rows: Array<{
      id?: number;
      firstName: string | null;
      lastName: string | null;
      email: string;
      position: string | null;
    }> = Array.isArray(members) ? members : [];
    for (const m of rows) {
      if (!m.email) {
        return NextResponse.json({ error: "Each member needs an email" }, { status: 400 });
      }
    }

    const keepIds = rows.filter((m) => m.id).map((m) => m.id as number);
    const links = await db.groupTarget.findMany({ where: { groupId } });
    const removeIds = links.map((l) => l.targetId).filter((t) => !keepIds.includes(t));

    if (removeIds.length > 0) {
      await db.groupTarget.deleteMany({ where: { groupId, targetId: { in: removeIds } } });
      // Hapus target yang sudah tidak dipakai group mana pun
      const stillUsed = await db.groupTarget.findMany({ where: { targetId: { in: removeIds } } });
      const stillUsedIds = new Set(stillUsed.map((l) => l.targetId));
      const orphans = removeIds.filter((t) => !stillUsedIds.has(t));
      if (orphans.length > 0) {
        await db.target.deleteMany({ where: { id: { in: orphans } } });
      }
    }

    for (const m of rows) {
      if (m.id) {
        await db.target.update({
          where: { id: m.id },
          data: {
            firstName: m.firstName ?? null,
            lastName: m.lastName ?? null,
            email: m.email,
            position: m.position ?? null,
          },
        });
        await db.groupTarget.upsert({
          where: { groupId_targetId: { groupId, targetId: m.id } },
          update: {},
          create: { groupId, targetId: m.id },
        });
      } else {
        const created = await db.target.create({
          data: {
            firstName: m.firstName ?? null,
            lastName: m.lastName ?? null,
            email: m.email,
            position: m.position ?? null,
          },
        });
        await db.groupTarget.create({ data: { groupId, targetId: created.id } });
      }
    }

    const group = await db.group.update({
      where: { id: groupId },
      data: { name, modifiedDate: new Date() },
      include: { _count: { select: { targets: true } } },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error("Failed to update group:", error);
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
    if (!await ownedGroup(groupId, session.userId)) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    const doomed = await db.groupTarget.findMany({ where: { groupId }, select: { targetId: true } });
    await db.group.delete({ where: { id: groupId } });
    const goneIds = doomed.map((l) => l.targetId);
    if (goneIds.length > 0) {
      const stillUsed = await db.groupTarget.findMany({ where: { targetId: { in: goneIds } } });
      const stillUsedIds = new Set(stillUsed.map((l) => l.targetId));
      const orphans = goneIds.filter((t) => !stillUsedIds.has(t));
      if (orphans.length > 0) {
        await db.target.deleteMany({ where: { id: { in: orphans } } });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
