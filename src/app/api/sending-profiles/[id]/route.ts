import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/session";
import { db } from "@/lib/db";

function isValidFromAddress(addr: string): boolean {
  if (!addr || !addr.trim()) return false;
  const matchAngle = addr.match(/<([^>]+)>/);
  const emailToTest = matchAngle ? matchAngle[1].trim() : addr.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailToTest);
}

function normalizeHost(host: string): string {
  const parts = host.trim().split(":");
  if (parts.length === 1) {
    return `${parts[0]}:25`;
  }
  return host.trim();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ message: "Invalid profile ID", success: false }, { status: 400 });
    }

    const profile = await db.sendingProfile.findFirst({
      where: { id, userId: session.userId },
      include: {
        headers: {
          select: { id: true, key: true, value: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ message: "SMTP not found", success: false }, { status: 404 });
    }

    return NextResponse.json({
      id: profile.id,
      name: profile.name,
      interface_type: profile.interfaceType || "SMTP",
      from_address: profile.fromAddress || "",
      host: profile.host || "",
      username: profile.username || "",
      password: profile.password || "",
      ignore_cert_errors: Boolean(profile.ignoreCertErrors),
      modified_date: profile.modifiedDate.toISOString(),
      headers: profile.headers.map((h) => ({ key: h.key, value: h.value })),
    });
  } catch (error) {
    console.error("Error fetching profile by ID:", error);
    return NextResponse.json({ message: "Internal Server Error", success: false }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ message: "Invalid profile ID", success: false }, { status: 400 });
    }

    const existing = await db.sendingProfile.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ message: "SMTP not found", success: false }, { status: 404 });
    }

    const body = await req.json();
    const name = (body.name || "").trim();
    const fromAddress = (body.from_address || body.fromAddress || "").trim();
    let host = (body.host || "").trim();
    const username = (body.username || "").trim();
    const password = body.password !== undefined ? String(body.password) : existing.password || "";
    const ignoreCertErrors = body.ignore_cert_errors !== undefined ? Boolean(body.ignore_cert_errors) : true;
    const headersList: { key: string; value: string }[] = Array.isArray(body.headers) ? body.headers : [];

    if (!name) {
      return NextResponse.json({ message: "No profile name specified", success: false }, { status: 400 });
    }
    if (!fromAddress) {
      return NextResponse.json({ message: "No From Address specified", success: false }, { status: 400 });
    }
    if (!isValidFromAddress(fromAddress)) {
      return NextResponse.json({ message: "Invalid From Address format", success: false }, { status: 400 });
    }
    if (!host) {
      return NextResponse.json({ message: "No SMTP Host specified", success: false }, { status: 400 });
    }

    host = normalizeHost(host);

    // Check if name is taken by another profile
    const nameConflict = await db.sendingProfile.findFirst({
      where: {
        userId: session.userId,
        name: { equals: name },
        id: { not: id },
      },
    });
    if (nameConflict) {
      return NextResponse.json({ message: "SMTP name already in use", success: false }, { status: 409 });
    }

    // Replace headers and update profile
    await db.header.deleteMany({
      where: { smtpId: id },
    });

    const updated = await db.sendingProfile.update({
      where: { id },
      data: {
        name,
        host,
        fromAddress,
        username,
        password,
        ignoreCertErrors,
        modifiedDate: new Date(),
        headers: {
          create: headersList
            .filter((h) => h.key && h.key.trim())
            .map((h) => ({
              key: h.key.trim(),
              value: (h.value || "").trim(),
            })),
        },
      },
      include: {
        headers: true,
      },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      interface_type: updated.interfaceType,
      from_address: updated.fromAddress,
      host: updated.host,
      username: updated.username,
      ignore_cert_errors: updated.ignoreCertErrors,
      modified_date: updated.modifiedDate.toISOString(),
      headers: updated.headers.map((h) => ({ key: h.key, value: h.value })),
      success: true,
      message: "Profile edited successfully!",
    });
  } catch (error) {
    console.error("Error updating sending profile:", error);
    return NextResponse.json({ message: "Internal Server Error", success: false }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ message: "Invalid profile ID", success: false }, { status: 400 });
    }

    const existing = await db.sendingProfile.findFirst({
      where: { id, userId: session.userId },
    });
    if (!existing) {
      return NextResponse.json({ message: "SMTP not found", success: false }, { status: 404 });
    }

    await db.sendingProfile.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Sending profile deleted successfully!",
    });
  } catch (error) {
    console.error("Error deleting sending profile:", error);
    return NextResponse.json({ message: "Internal Server Error", success: false }, { status: 500 });
  }
}
