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

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function findOwnedTemplate(id: number, userId: number) {
  const template = await db.template.findUnique({
    where: { id },
    include: { attachments: true },
  });
  if (!template) return null;
  if (template.userId !== null && template.userId !== userId) return null;
  return template;
}

export async function GET(req: Request, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const templateId = parseInt(rawId, 10);
  if (!Number.isInteger(templateId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const template = await findOwnedTemplate(templateId, session.userId);
    if (!template) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    return NextResponse.json(formatTemplate(template, true));
  } catch (error) {
    console.error("Failed to get email template:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const templateId = parseInt(rawId, 10);
  if (!Number.isInteger(templateId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const existing = await findOwnedTemplate(templateId, session.userId);
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    interface TemplateUpdateData {
      name?: string;
      subject?: string | null;
      envelopeSender?: string | null;
      text?: string | null;
      html?: string | null;
      modifiedDate: Date;
    }

    const dataToUpdate: TemplateUpdateData = {
      modifiedDate: new Date(),
    };

    if ("name" in body) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        return NextResponse.json(
          { error: "Template name not specified", message: "Template name not specified" },
          { status: 400 }
        );
      }

      // Check unique name per user excluding this template
      const conflict = await db.template.findFirst({
        where: {
          userId: session.userId,
          name: { equals: name },
          id: { not: templateId },
        },
      });

      if (conflict) {
        return NextResponse.json(
          { error: "Template name already in use", message: "Template name already in use" },
          { status: 409 }
        );
      }

      dataToUpdate.name = name;
    }

    if ("subject" in body) {
      dataToUpdate.subject =
        typeof body.subject === "string" && body.subject.trim()
          ? body.subject.trim()
          : null;
    }

    if ("envelope_sender" in body || "envelopeSender" in body) {
      const senderRaw = body.envelope_sender ?? body.envelopeSender;
      dataToUpdate.envelopeSender =
        typeof senderRaw === "string" && senderRaw.trim()
          ? senderRaw.trim()
          : null;
    }

    const nextText = "text" in body ? (typeof body.text === "string" ? body.text : "") : (existing.text ?? "");
    let nextHtml = "html" in body ? (typeof body.html === "string" ? body.html : "") : (existing.html ?? "");

    if ("text" in body) {
      dataToUpdate.text = nextText;
    }

    if ("html" in body) {
      nextHtml = cleanTemplateUrls(nextHtml);
      if (body.use_tracker === true || body.useTracker === true || body.addTrackingImage === true) {
        nextHtml = injectTracker(nextHtml);
      } else if (body.use_tracker === false || body.useTracker === false || body.addTrackingImage === false) {
        nextHtml = stripTracker(nextHtml);
      }
      dataToUpdate.html = nextHtml;
    }

    if (!nextText.trim() && !nextHtml.trim()) {
      return NextResponse.json(
        {
          error: "Need to specify at least plaintext or HTML content",
          message: "Need to specify at least plaintext or HTML content",
        },
        { status: 400 }
      );
    }

    interface AttachmentInput {
      name?: string;
      type?: string;
      content?: string;
    }

    // Handle attachments replacement if attachments field is present
    if (Array.isArray(body.attachments)) {
      const rawAttachments = body.attachments as AttachmentInput[];
      await db.$transaction(async (tx) => {
        await tx.attachment.deleteMany({ where: { templateId } });
        if (rawAttachments.length > 0) {
          await tx.attachment.createMany({
            data: rawAttachments.map((att: AttachmentInput) => ({
              templateId,
              name: String(att.name || "attachment"),
              type: String(att.type || "application/octet-stream"),
              content: String(att.content || "").replace(/^data:[^;]+;base64,/, "").trim(),
            })),
          });
        }
      });
    }

    const updated = await db.template.update({
      where: { id: templateId },
      data: dataToUpdate,
      include: {
        attachments: true,
      },
    });

    return NextResponse.json(formatTemplate(updated, true));
  } catch (error) {
    console.error("Failed to update email template:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const session = getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const templateId = parseInt(rawId, 10);
  if (!Number.isInteger(templateId)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const existing = await findOwnedTemplate(templateId, session.userId);
    if (!existing) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    // Detach from any existing campaigns referencing this template
    await db.campaign.updateMany({
      where: { templateId },
      data: { templateId: null },
    });

    // Delete template (attachments cascade deleted)
    await db.template.delete({
      where: { id: templateId },
    });

    return NextResponse.json({
      success: true,
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete email template:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
