import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSessionCookie, verifySession } from "@/lib/session";
import {
  cleanTemplateUrls,
  injectTracker,
  stripTracker,
  formatTemplate,
} from "@/lib/mime-parser";

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

export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await db.template.findMany({
      where: {
        OR: [{ userId: session.userId }, { userId: null }],
      },
      orderBy: { modifiedDate: "desc" },
      include: {
        attachments: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    const formatted = templates.map((t) => formatTemplate(t, false));
    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch email templates:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Template name not specified", message: "Template name not specified" },
        { status: 400 }
      );
    }

    // Check unique name per user
    const existing = await db.template.findFirst({
      where: {
        userId: session.userId,
        name: { equals: name },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Template name already in use", message: "Template name already in use" },
        { status: 409 }
      );
    }

    const text = typeof body.text === "string" ? body.text : "";
    let html = typeof body.html === "string" ? body.html : "";

    if (!text.trim() && !html.trim()) {
      return NextResponse.json(
        {
          error: "Need to specify at least plaintext or HTML content",
          message: "Need to specify at least plaintext or HTML content",
        },
        { status: 400 }
      );
    }

    if (html) {
      html = cleanTemplateUrls(html);
      if (body.use_tracker === true || body.useTracker === true || body.addTrackingImage === true) {
        html = injectTracker(html);
      } else if (body.use_tracker === false || body.useTracker === false || body.addTrackingImage === false) {
        html = stripTracker(html);
      }
    }

    const envelopeSenderRaw = body.envelope_sender ?? body.envelopeSender;
    const envelopeSender =
      typeof envelopeSenderRaw === "string" && envelopeSenderRaw.trim()
        ? envelopeSenderRaw.trim()
        : null;

    const subject =
      typeof body.subject === "string" && body.subject.trim()
        ? body.subject.trim()
        : null;

    interface AttachmentInput {
      name?: string;
      type?: string;
      content?: string;
    }

    const rawAttachments: AttachmentInput[] = Array.isArray(body.attachments)
      ? (body.attachments as AttachmentInput[])
      : [];

    const created = await db.template.create({
      data: {
        userId: session.userId,
        name,
        subject,
        envelopeSender,
        text,
        html,
        modifiedDate: new Date(),
        attachments: {
          create: rawAttachments.map((att: AttachmentInput) => ({
            name: String(att.name || "attachment"),
            type: String(att.type || "application/octet-stream"),
            content: String(att.content || "").replace(/^data:[^;]+;base64,/, "").trim(),
          })),
        },
      },
      include: {
        attachments: true,
      },
    });

    return NextResponse.json(formatTemplate(created, true), { status: 201 });
  } catch (error) {
    console.error("Failed to create email template:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
