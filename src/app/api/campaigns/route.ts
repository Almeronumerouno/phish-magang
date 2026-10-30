import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSessionCookie, verifySession } from "@/lib/session";
import crypto from "crypto";
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

function generateRId(): string {
  // 7-character alphanumeric random token matching GoPhish r_id convention
  return crypto.randomBytes(6).toString("base64url").slice(0, 7);
}

function isValidUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const campaigns = await db.campaign.findMany({
      where: {
        OR: [{ userId: session.userId }, { userId: null }],
      },
      include: {
        template: {
          select: { id: true, name: true, subject: true },
        },
        page: {
          select: { id: true, name: true, redirectUrl: true },
        },
        profile: {
          select: { id: true, name: true, fromAddress: true, host: true },
        },
        group: {
          select: {
            id: true,
            name: true,
            _count: { select: { targets: true } },
          },
        },
        results: true,
        events: {
          orderBy: { time: "desc" },
          take: 20,
        },
        _count: { select: { results: true, events: true } },
      },
      orderBy: { createdDate: "desc" },
    });

    const formatted = campaigns.map((cmp) => {
      const results = cmp.results || [];
      const total = results.length;
      let sent = 0;
      let opened = 0;
      let clicked = 0;
      let submitted = 0;
      let reported = 0;
      let error = 0;

      for (const r of results) {
        const s = (r.status || "").toLowerCase();
        if (s !== "scheduled" && !s.includes("error")) sent++;
        if (s.includes("open") || s.includes("click") || s.includes("submit")) opened++;
        if (s.includes("click") || s.includes("submit")) clicked++;
        if (s.includes("submit")) submitted++;
        if (r.reported) reported++;
        if (s.includes("error")) error++;
      }

      return {
        id: cmp.id,
        name: cmp.name,
        createdDate: cmp.createdDate,
        created_date: cmp.createdDate,
        launchDate: cmp.launchDate,
        launch_date: cmp.launchDate,
        completedDate: cmp.completedDate,
        completed_date: cmp.completedDate,
        status: cmp.status,
        url: cmp.url,
        templateId: cmp.templateId,
        template_id: cmp.templateId,
        pageId: cmp.pageId,
        page_id: cmp.pageId,
        smtpId: cmp.smtpId,
        smtp_id: cmp.smtpId,
        groupId: cmp.groupId,
        group_id: cmp.groupId,
        template: cmp.template,
        page: cmp.page,
        profile: cmp.profile,
        smtp: cmp.profile,
        group: cmp.group,
        results: cmp.results,
        events: cmp.events,
        stats: {
          total,
          sent,
          opened,
          clicked,
          submitted,
          reported,
          error,
          openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
          clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
          submitRate: sent > 0 ? Math.round((submitted / sent) * 100) : 0,
          reportRate: sent > 0 ? Math.round((reported / sent) * 100) : 0,
        },
        _count: cmp._count,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET /api/campaigns error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = getSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const templateId = body?.templateId ?? body?.template_id;
    const pageId = body?.pageId ?? body?.page_id;
    const smtpId = body?.smtpId ?? body?.smtp_id;
    const groupId = body?.groupId ?? body?.group_id;
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    const launchDateInput = body?.launchDate ?? body?.launch_date;
    const sendByDateInput = body?.sendByDate ?? body?.send_by_date;

    // 1. Validation: Campaign Name
    if (!name) {
      return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
    }

    // Check duplicate name for this user
    const existing = await db.campaign.findFirst({
      where: {
        userId: session.userId,
        name: { equals: name },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Campaign with name "${name}" already exists.` },
        { status: 409 }
      );
    }

    // 2. Validation: Template
    const parsedTemplateId = parseInt(String(templateId));
    if (isNaN(parsedTemplateId)) {
      return NextResponse.json({ error: "Email Template is required." }, { status: 400 });
    }
    const template = await db.template.findUnique({
      where: { id: parsedTemplateId },
      include: { attachments: true },
    });
    if (!template) {
      return NextResponse.json({ error: "Selected Email Template does not exist." }, { status: 404 });
    }

    // 3. Validation: Landing Page
    const parsedPageId = parseInt(String(pageId));
    if (isNaN(parsedPageId)) {
      return NextResponse.json({ error: "Landing Page is required." }, { status: 400 });
    }
    const page = await db.landingPage.findUnique({ where: { id: parsedPageId } });
    if (!page) {
      return NextResponse.json({ error: "Selected Landing Page does not exist." }, { status: 404 });
    }

    // 4. Validation: Sending Profile
    const parsedSmtpId = parseInt(String(smtpId));
    if (isNaN(parsedSmtpId)) {
      return NextResponse.json({ error: "Sending Profile is required." }, { status: 400 });
    }
    const profile = await db.sendingProfile.findUnique({
      where: { id: parsedSmtpId },
      include: { headers: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "Selected Sending Profile does not exist." }, { status: 404 });
    }

    // 5. Validation: Target Group
    const parsedGroupId = parseInt(String(groupId));
    if (isNaN(parsedGroupId)) {
      return NextResponse.json({ error: "Target Group is required." }, { status: 400 });
    }
    const group = await db.group.findUnique({
      where: { id: parsedGroupId },
      include: {
        targets: {
          include: { target: true },
        },
      },
    });
    if (!group) {
      return NextResponse.json({ error: "Selected Target Group does not exist." }, { status: 404 });
    }

    // 6. Validation: Phishing URL
    if (!rawUrl) {
      return NextResponse.json(
        { error: "URL is required (e.g. http://192.168.1.1 or https://phish.example.com)." },
        { status: 400 }
      );
    }
    if (!isValidUrl(rawUrl)) {
      return NextResponse.json(
        { error: "Invalid URL format. URL must start with http:// or https://" },
        { status: 400 }
      );
    }

    // 7. Determine Scheduling & Status
    const now = new Date();
    let launchDate = now;
    let sendByDate: Date | null = null;
    let initialStatus = "In_Progress";

    if (launchDateInput) {
      const parsedLaunch = new Date(launchDateInput);
      if (!isNaN(parsedLaunch.getTime())) {
        launchDate = parsedLaunch;
        // If scheduled more than 60 seconds into the future
        if (parsedLaunch.getTime() > now.getTime() + 60000) {
          initialStatus = "Scheduled";
        }
      }
    }

    if (sendByDateInput) {
      const parsedSendBy = new Date(sendByDateInput);
      if (!isNaN(parsedSendBy.getTime())) {
        sendByDate = parsedSendBy;
      }
    }

    // 8. Create Campaign, Target Results, and SimEvents atomically
    const { campaign, createdTargets } = await db.$transaction(async (tx) => {
      const createdCampaign = await tx.campaign.create({
        data: {
          userId: session.userId,
          name,
          templateId: parsedTemplateId,
          pageId: parsedPageId,
          smtpId: parsedSmtpId,
          groupId: parsedGroupId,
          url: rawUrl,
          status: initialStatus,
          launchDate,
          sendByDate,
          createdDate: now,
        },
      });

      // Log initial event: Campaign Created
      await tx.simEvent.create({
        data: {
          campaignId: createdCampaign.id,
          email: "Operator",
          time: now,
          message: "Campaign Created",
          details: JSON.stringify({
            status: initialStatus,
            targetsCount: group.targets.length,
            template: template.name,
            page: page.name,
            profile: profile.name,
            group: group.name,
          }),
        },
      });

      // Generate initial Result records with status "Scheduled"
      const targetsList: Array<{
        id: number;
        rId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
        position: string | null;
      }> = [];

      for (const gt of group.targets) {
        const target = gt.target;
        if (!target) continue;

        const rId = generateRId();

        const createdResult = await tx.result.create({
          data: {
            campaignId: createdCampaign.id,
            userId: session.userId,
            rId,
            email: target.email,
            firstName: target.firstName,
            lastName: target.lastName,
            position: target.position,
            status: "Scheduled",
            sendDate: null,
            reported: false,
          },
        });

        targetsList.push({
          id: createdResult.id,
          rId,
          email: target.email,
          firstName: target.firstName,
          lastName: target.lastName,
          position: target.position,
        });
      }

      return { campaign: createdCampaign, createdTargets: targetsList };
    });

    // 9. Execute authentic SMTP email dispatch outside the database transaction
    const isScheduled = initialStatus === "Scheduled";
    if (!isScheduled) {
      await dispatchCampaignEmails({
        campaignId: campaign.id,
        baseUrl: rawUrl,
        profile,
        template,
        targets: createdTargets,
      });
    }

    // Return complete campaign payload
    const fullCampaign = await db.campaign.findUnique({
      where: { id: campaign.id },
      include: {
        template: true,
        page: true,
        profile: true,
        group: { select: { id: true, name: true } },
        results: true,
        events: { orderBy: { time: "desc" } },
        _count: { select: { results: true, events: true } },
      },
    });

    return NextResponse.json(fullCampaign, { status: 201 });
  } catch (error) {
    console.error("POST /api/campaigns error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
