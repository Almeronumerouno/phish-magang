import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/session";
import { db } from "@/lib/db";

// Validate RFC 5322 From Address (e.g. "user@example.com" or "First Last <user@example.com>")
function isValidFromAddress(addr: string): boolean {
  if (!addr || !addr.trim()) return false;
  const matchAngle = addr.match(/<([^>]+)>/);
  const emailToTest = matchAngle ? matchAngle[1].trim() : addr.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailToTest);
}

// Normalize host to host:port format (default port 25)
function normalizeHost(host: string): string {
  const parts = host.trim().split(":");
  if (parts.length === 1) {
    return `${parts[0]}:25`;
  }
  return host.trim();
}

export async function GET(req: NextRequest) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const profiles = await db.sendingProfile.findMany({
      where: { userId: session.userId },
      include: {
        headers: {
          select: {
            id: true,
            key: true,
            value: true,
          },
        },
      },
      orderBy: { modifiedDate: "desc" },
    });

    const formatted = profiles.map((p) => ({
      id: p.id,
      name: p.name,
      interface_type: p.interfaceType || "SMTP",
      from_address: p.fromAddress || "",
      host: p.host || "",
      username: p.username || "",
      password: p.password || "",
      ignore_cert_errors: Boolean(p.ignoreCertErrors),
      modified_date: p.modifiedDate.toISOString(),
      headers: p.headers.map((h) => ({ key: h.key, value: h.value })),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching sending profiles:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const name = (body.name || "").trim();
    const fromAddress = (body.from_address || body.fromAddress || "").trim();
    let host = (body.host || "").trim();
    const username = (body.username || "").trim();
    const password = body.password !== undefined ? String(body.password) : "";
    const ignoreCertErrors = body.ignore_cert_errors !== undefined ? Boolean(body.ignore_cert_errors) : true;
    const headersList: { key: string; value: string }[] = Array.isArray(body.headers) ? body.headers : [];

    // Validations ala GoPhish
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

    // Check name conflict
    const existing = await db.sendingProfile.findFirst({
      where: {
        userId: session.userId,
        name: { equals: name },
      },
    });

    if (existing) {
      return NextResponse.json({ message: "SMTP name already in use", success: false }, { status: 409 });
    }

    // Determine the next available ID
    const maxProfile = await db.sendingProfile.findFirst({
      orderBy: { id: "desc" },
    });
    const nextId = (maxProfile?.id || 0) + 1;

    const newProfile = await db.sendingProfile.create({
      data: {
        id: nextId,
        userId: session.userId,
        name,
        host,
        fromAddress,
        username,
        password,
        interfaceType: "SMTP",
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

    return NextResponse.json(
      {
        id: newProfile.id,
        name: newProfile.name,
        interface_type: newProfile.interfaceType,
        from_address: newProfile.fromAddress,
        host: newProfile.host,
        username: newProfile.username,
        ignore_cert_errors: newProfile.ignoreCertErrors,
        modified_date: newProfile.modifiedDate.toISOString(),
        headers: newProfile.headers.map((h) => ({ key: h.key, value: h.value })),
        success: true,
        message: "Profile added successfully!",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating sending profile:", error);
    return NextResponse.json({ message: "Internal Server Error", success: false }, { status: 500 });
  }
}
