import { NextRequest, NextResponse } from "next/server";
import { readSessionCookie, verifySession } from "@/lib/session";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const token = readSessionCookie(req.headers.get("cookie"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const toEmail = (body.email || body.to_email || "").trim();
    const firstName = (body.first_name || body.to_first_name || "").trim();
    const lastName = (body.last_name || body.to_last_name || "").trim();
    const position = (body.position || body.to_position || "").trim();

    if (!toEmail) {
      return NextResponse.json({ message: "No recipient email address specified", success: false }, { status: 400 });
    }

    const smtp = body.smtp || {};
    const fromAddress = (smtp.from_address || smtp.fromAddress || "").trim();
    const rawHost = (smtp.host || "").trim();
    const username = (smtp.username || "").trim();
    const password = smtp.password !== undefined ? String(smtp.password) : "";
    const ignoreCertErrors = smtp.ignore_cert_errors !== undefined ? Boolean(smtp.ignore_cert_errors) : true;
    const headersList: { key: string; value: string }[] = Array.isArray(smtp.headers) ? smtp.headers : [];

    if (!fromAddress) {
      return NextResponse.json({ message: "No From Address specified in SMTP configuration", success: false }, { status: 400 });
    }
    if (!rawHost) {
      return NextResponse.json({ message: "No SMTP Host specified", success: false }, { status: 400 });
    }

    // Parse host and port (default port: 25)
    const hostParts = rawHost.split(":");
    const host = hostParts[0];
    const port = hostParts[1] ? parseInt(hostParts[1], 10) : 25;
    const isSecure = port === 465;

    // Custom headers
    const customHeaders: Record<string, string> = {};
    headersList.forEach((h) => {
      if (h.key && h.key.trim()) {
        customHeaders[h.key.trim()] = h.value || "";
      }
    });

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: isSecure,
      auth: username ? { user: username, pass: password } : undefined,
      tls: {
        rejectUnauthorized: !ignoreCertErrors,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    const recipientName = [firstName, lastName].filter(Boolean).join(" ");
    const textBody = `Hello ${recipientName || "Recipient"},\n\nThis is a test email sent from Red Team Simulation to verify your SMTP sending profile configuration.\n\nConfiguration details:\n- Host: ${host}:${port}\n- From: ${fromAddress}\n- Position: ${position || "-"}\n\nIf you received this message, your sending profile is working correctly!`;

    await transporter.sendMail({
      from: fromAddress,
      to: recipientName ? `"${recipientName}" <${toEmail}>` : toEmail,
      subject: "Default Email from Gophish",
      text: textBody,
      headers: customHeaders,
    });

    return NextResponse.json({
      success: true,
      message: "Email Sent!",
    });
  } catch (error: any) {
    console.error("Failed to send test email:", error);
    const errorMsg = error?.message || "Failed to connect to SMTP server";
    return NextResponse.json({
      success: false,
      message: errorMsg,
    }, { status: 500 });
  }
}
