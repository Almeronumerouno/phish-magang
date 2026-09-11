import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSessionCookie, verifySession } from "@/lib/session";

export async function GET(req: Request) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const campaigns = await db.campaign.findMany({
      include: {
        _count: { select: { results: true, events: true } },
        results: true,
      },
      orderBy: { createdDate: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch (error) {
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
    const { name, templateId, groupId, smtpId, status } = body;

    const campaign = await db.campaign.create({
      data: {
        userId: session.userId,
        name,
        templateId: templateId ? parseInt(templateId) : null,
        groupId: groupId ? parseInt(groupId) : null,
        smtpId: smtpId ? parseInt(smtpId) : null,
        status: status || "In_Progress",
        launchDate: new Date(),
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
