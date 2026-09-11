import { NextResponse } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Active campaigns
    const activeCampaigns = await db.campaign.count({
      where: {
        userId: session.userId,
        status: { in: ["In Progress", "In_Progress", "Active"] },
      },
    });

    // Total emails sent
    const totalEmailsSent = await db.result.count({
      where: {
        userId: session.userId,
        status: { not: "Scheduled" },
      },
    });

    // Emails opened (Opened, Clicked, Submitted)
    const emailsOpened = await db.result.count({
      where: {
        userId: session.userId,
        status: { in: ["Opened", "Clicked", "Submitted"] },
      },
    });

    // Clicked or Submitted
    const clicks = await db.result.count({
      where: {
        userId: session.userId,
        status: { in: ["Clicked", "Submitted"] },
      },
    });

    let clickRate = "0.0%";
    if (totalEmailsSent > 0) {
      clickRate = ((clicks / totalEmailsSent) * 100).toFixed(1) + "%";
    }

    // Recent campaigns
    const campaigns = await db.campaign.findMany({
      where: { userId: session.userId },
      orderBy: { createdDate: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        createdDate: true,
        status: true,
        results: {
          select: { status: true },
        },
      },
    });

    const recentCampaigns = campaigns.map((c) => {
      let sent = 0;
      let opened = 0;
      let clicked = 0;

      for (const r of c.results) {
        if (r.status !== "Scheduled") sent++;
        if (["Opened", "Clicked", "Submitted"].includes(r.status)) opened++;
        if (["Clicked", "Submitted"].includes(r.status)) clicked++;
      }

      return {
        id: c.id,
        campaign: c.name,
        date: c.createdDate.toISOString(),
        status: c.status,
        sent,
        opened,
        clicked,
      };
    });

    return NextResponse.json({
      activeCampaigns,
      totalEmailsSent,
      emailsOpened,
      clickRate,
      recentCampaigns,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
