import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSessionCookie, verifySession } from "@/lib/session";
import { dispatchCampaignEmails } from "@/lib/campaign-dispatcher";

function getSession(req: Request) {
  const cookieHeader = req.headers.get("cookie");
  const token = readSessionCookie(cookieHeader);
  if (token) {
    const s = verifySession(token);
    if (s) return s;
  }
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const bearer = auth.slice(7).trim();
    const s = verifySession(bearer);
    if (s) return s;
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const campaignId = parseInt(id);
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
    }

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        template: {
          select: {
            id: true,
            name: true,
            subject: true,
            envelopeSender: true,
            text: true,
            html: true,
            attachments: {
              select: { id: true, name: true, type: true },
            },
          },
        },
        page: {
          select: {
            id: true,
            name: true,
            redirectUrl: true,
            captureCredentials: true,
            capturePasswords: true,
          },
        },
        profile: {
          select: {
            id: true,
            name: true,
            fromAddress: true,
            host: true,
            interfaceType: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            _count: { select: { targets: true } },
          },
        },
        results: {
          orderBy: { id: "asc" },
        },
        events: {
          orderBy: { time: "desc" },
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Verify ownership if userId is set
    if (campaign.userId && session.userId && campaign.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Calculate detailed telemetry
    const results = campaign.results || [];
    const total = results.length;
    let scheduled = 0;
    let sent = 0;
    let opened = 0;
    let clicked = 0;
    let submitted = 0;
    let reported = 0;
    let error = 0;

    for (const r of results) {
      const s = (r.status || "").toLowerCase();
      if (s === "scheduled") scheduled++;
      if (s !== "scheduled" && !s.includes("error")) sent++;
      if (s.includes("open") || s.includes("click") || s.includes("submit")) opened++;
      if (s.includes("click") || s.includes("submit")) clicked++;
      if (s.includes("submit")) submitted++;
      if (r.reported) reported++;
      if (s.includes("error")) error++;
    }

    const stats = {
      total,
      scheduled,
      sent,
      opened,
      clicked,
      submitted,
      reported,
      error,
      sentRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
      submitRate: sent > 0 ? Math.round((submitted / sent) * 100) : 0,
      reportRate: sent > 0 ? Math.round((reported / sent) * 100) : 0,
    };

    return NextResponse.json({
      ...campaign,
      stats,
    });
  } catch (error) {
    console.error("GET /api/campaigns/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const campaignId = parseInt(id);
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
    }

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
      include: { results: true },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.userId && session.userId && campaign.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const newStatus = typeof body?.status === "string" ? body.status.trim() : null;

    if (!newStatus) {
      return NextResponse.json({ error: "Status is required." }, { status: 400 });
    }

    const now = new Date();
    const updateData: { status: string; completedDate?: Date } = { status: newStatus };

    // Lifecycle transitions
    if (newStatus.toLowerCase() === "completed") {
      updateData.completedDate = now;
      await db.simEvent.create({
        data: {
          campaignId,
          email: "Operator",
          time: now,
          message: "Campaign Completed",
          details: "Campaign manually or automatically marked as completed",
        },
      });
    } else if (newStatus.toLowerCase() === "paused") {
      await db.simEvent.create({
        data: {
          campaignId,
          email: "Operator",
          time: now,
          message: "Campaign Paused",
          details: "Simulation execution suspended",
        },
      });
    } else if (newStatus === "Active" || newStatus === "In_Progress") {
      // If was scheduled, dispatch scheduled targets using authentic SMTP engine
      if (campaign.status === "Scheduled") {
        await db.simEvent.create({
          data: {
            campaignId,
            email: "Operator",
            time: now,
            message: "Campaign Launched",
            details: "Scheduled campaign dispatched to targets",
          },
        });

        const fullCampaignData = await db.campaign.findUnique({
          where: { id: campaignId },
          include: {
            template: {
              include: { attachments: true },
            },
            profile: {
              include: { headers: true },
            },
            results: {
              where: { status: "Scheduled" },
            },
          },
        });

        if (
          fullCampaignData &&
          fullCampaignData.template &&
          fullCampaignData.profile &&
          fullCampaignData.results.length > 0
        ) {
          await dispatchCampaignEmails({
            campaignId,
            baseUrl: fullCampaignData.url || "",
            profile: fullCampaignData.profile,
            template: fullCampaignData.template,
            targets: fullCampaignData.results.map((r) => ({
              id: r.id,
              rId: r.rId,
              email: r.email || "",
              firstName: r.firstName,
              lastName: r.lastName,
              position: r.position,
            })),
          });
        }
      } else {
        await db.simEvent.create({
          data: {
            campaignId,
            email: "Operator",
            time: now,
            message: "Campaign Resumed",
            details: "Simulation resumed by operator",
          },
        });
      }
    }

    const updated = await db.campaign.update({
      where: { id: campaignId },
      data: updateData,
      include: {
        template: true,
        page: true,
        profile: true,
        group: true,
        results: true,
        events: { orderBy: { time: "desc" } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/campaigns/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const campaignId = parseInt(id);
    if (isNaN(campaignId)) {
      return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
    }

    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (campaign.userId && session.userId && campaign.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.campaign.delete({
      where: { id: campaignId },
    });

    return NextResponse.json({ success: true, message: `Campaign #${campaignId} deleted.` });
  } catch (error) {
    console.error("DELETE /api/campaigns/[id] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
