import nodemailer, { Transporter } from "nodemailer";
import { db } from "@/lib/db";
import { cleanTemplateUrls } from "@/lib/mime-parser";

export interface SendingProfileWithHeaders {
  id: number;
  name: string;
  host: string | null;
  username: string | null;
  password?: string | null;
  fromAddress: string | null;
  ignoreCertErrors: boolean;
  headers?: { key: string; value: string }[] | null;
}

export interface TemplateAttachmentRecord {
  id?: number;
  name: string;
  type: string;
  content: string; // base64 payload
}

export interface TemplateWithAttachments {
  id: number;
  name: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  envelopeSender?: string | null;
  attachments?: TemplateAttachmentRecord[] | null;
}

export interface TargetRecipient {
  id: number; // Result.id
  rId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
}

export interface CampaignDispatchOptions {
  campaignId: number;
  baseUrl: string;
  profile: SendingProfileWithHeaders;
  template: TemplateWithAttachments;
  targets?: TargetRecipient[];
}

export interface CampaignDispatchSummary {
  total: number;
  sent: number;
  error: number;
  errors: Array<{ email: string; error: string }>;
}

export interface TemplateVariables {
  rId: string;
  firstName?: string | null;
  lastName?: string | null;
  position?: string | null;
  email: string;
  from: string;
  baseUrl: string;
  isHtml?: boolean;
}

/**
 * Constructs the parameterized phishing URL appending ?rid=<rId> or &rid=<rId>.
 */
export function buildPhishingUrl(baseUrl: string, rId: string): string {
  if (!baseUrl) return "";
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("rid", rId);
    return u.toString();
  } catch {
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}rid=${encodeURIComponent(rId)}`;
  }
}

/**
 * Constructs the tracking pixel URL pointing to /track?rid=<rId>.
 */
export function buildTrackingUrl(baseUrl: string, rId: string): string {
  if (!baseUrl) return `/track?rid=${encodeURIComponent(rId)}`;
  try {
    const u = new URL(baseUrl);
    return `${u.origin}/track?rid=${encodeURIComponent(rId)}`;
  } catch {
    const trimmed = baseUrl.replace(/\/+$/, "");
    return `${trimmed}/track?rid=${encodeURIComponent(rId)}`;
  }
}

/**
 * Interpolates GoPhish template variables across Subject, HTML, Plaintext, and Headers:
 * {{.RId}}, {{.FirstName}}, {{.LastName}}, {{.Position}}, {{.Email}}, {{.From}},
 * {{.URL}}, {{.TrackingURL}}, {{.Tracker}}.
 */
export function renderTemplateVariables(template: string, vars: TemplateVariables): string {
  if (!template) return "";

  const targetUrl = buildPhishingUrl(vars.baseUrl, vars.rId);
  const trackingUrl = buildTrackingUrl(vars.baseUrl, vars.rId);
  const isHtml = Boolean(vars.isHtml);

  let rendered = template;

  if (isHtml) {
    rendered = cleanTemplateUrls(rendered);
    // Replace src="{{.Tracker}}" or src='{{.Tracker}}' with trackingUrl to prevent malformed nested img tags
    rendered = rendered.replace(/src=(["'])\{\{\s*\.Tracker\s*\}\}\1/gi, `src=$1${trackingUrl}$1`);
    // Replace standalone {{.Tracker}} with hidden image tag
    rendered = rendered.replace(/\{\{\s*\.Tracker\s*\}\}/gi, `<img src="${trackingUrl}" style="display: none;"/>`);
  } else {
    // In plain text or subject, tracker pixel is empty string
    rendered = rendered.replace(/\{\{\s*\.Tracker\s*\}\}/gi, "");
  }

  const replacements: [RegExp, string][] = [
    [/\{\{\s*\.RId\s*\}\}/gi, vars.rId || ""],
    [/\{\{\s*\.FirstName\s*\}\}/gi, vars.firstName || ""],
    [/\{\{\s*\.LastName\s*\}\}/gi, vars.lastName || ""],
    [/\{\{\s*\.Position\s*\}\}/gi, vars.position || ""],
    [/\{\{\s*\.Email\s*\}\}/gi, vars.email || ""],
    [/\{\{\s*\.From\s*\}\}/gi, vars.from || ""],
    [/\{\{\s*\.URL\s*\}\}/gi, targetUrl],
    [/\{\{\s*\.TrackingURL\s*\}\}/gi, trackingUrl],
    [/\{\{\s*\.TrackingUrl\s*\}\}/gi, trackingUrl],
  ];

  for (const [regex, val] of replacements) {
    rendered = rendered.replace(regex, () => val);
  }

  return rendered;
}

// Aliases for convenience
export const renderTemplateText = renderTemplateVariables;
export const renderTemplateContent = renderTemplateVariables;

/**
 * Builds a configured Nodemailer Transporter from a SendingProfile model.
 */
export function buildNodemailerTransporter(profile: SendingProfileWithHeaders): Transporter {
  const rawHost = (profile.host || "").trim();
  const hostParts = rawHost.split(":");
  const host = hostParts[0] || "localhost";
  const port = hostParts[1] ? parseInt(hostParts[1], 10) : 25;
  const isSecure = port === 465;

  const username = (profile.username || "").trim();
  const password = profile.password ?? "";

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: username ? { user: username, pass: password } : undefined,
    tls: {
      rejectUnauthorized: !profile.ignoreCertErrors,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export const createSmtpTransporter = buildNodemailerTransporter;

/**
 * Converts stored base64 attachment records into Nodemailer Buffer attachments.
 */
export function convertAttachmentsToBuffers(attachments?: TemplateAttachmentRecord[] | null) {
  if (!attachments || !Array.isArray(attachments)) return [];
  return attachments
    .filter((att) => att && att.name && att.content)
    .map((att) => {
      const cleanBase64 = (att.content || "").replace(/^data:[^,]+;base64,/i, "").trim();
      return {
        filename: att.name,
        content: Buffer.from(cleanBase64, "base64"),
        contentType: att.type || "application/octet-stream",
      };
    });
}

/**
 * Dispatches campaign emails to all targets using authentic SMTP transport.
 * Implements strict per-target error isolation, DB status updates, and SimEvent logging.
 */
export async function dispatchCampaignEmails(
  options: CampaignDispatchOptions
): Promise<CampaignDispatchSummary> {
  const { campaignId, baseUrl, profile, template } = options;

  let targetsToDispatch = options.targets;
  if (!targetsToDispatch || targetsToDispatch.length === 0) {
    const pendingResults = await db.result.findMany({
      where: { campaignId, status: "Scheduled" },
    });
    targetsToDispatch = pendingResults.map((r) => ({
      id: r.id,
      rId: r.rId,
      email: r.email || "",
      firstName: r.firstName,
      lastName: r.lastName,
      position: r.position,
    }));
  }

  const transporter = buildNodemailerTransporter(profile);
  const attachments = convertAttachmentsToBuffers(template.attachments);
  const fromAddress = profile.fromAddress?.trim() || template.envelopeSender?.trim() || "";
  const envelopeSender = template.envelopeSender?.trim();

  let sent = 0;
  let errorCount = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const target of targetsToDispatch) {
    const now = new Date();
    const vars: TemplateVariables = {
      rId: target.rId,
      firstName: target.firstName,
      lastName: target.lastName,
      position: target.position,
      email: target.email,
      from: fromAddress,
      baseUrl,
    };

    const renderedSubject = renderTemplateVariables(template.subject || "", { ...vars, isHtml: false });
    const renderedHtml = template.html ? renderTemplateVariables(template.html, { ...vars, isHtml: true }) : undefined;
    const renderedText = template.text ? renderTemplateVariables(template.text, { ...vars, isHtml: false }) : undefined;

    const recipientName = [target.firstName, target.lastName].filter(Boolean).join(" ").trim();
    const toAddress = recipientName ? `"${recipientName}" <${target.email}>` : target.email;

    const customHeaders: Record<string, string> = {};
    if (profile.headers && Array.isArray(profile.headers)) {
      for (const h of profile.headers) {
        if (h.key && h.key.trim()) {
          customHeaders[h.key.trim()] = renderTemplateVariables(h.value || "", { ...vars, isHtml: false });
        }
      }
    }

    try {
      await transporter.sendMail({
        from: fromAddress || profile.name,
        to: toAddress,
        envelope: envelopeSender
          ? {
              from: envelopeSender,
              to: target.email,
            }
          : undefined,
        subject: renderedSubject,
        text: renderedText,
        html: renderedHtml,
        headers: customHeaders,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Update Result record
      await db.result.update({
        where: target.id ? { id: target.id } : { rId: target.rId },
        data: {
          status: "Email Sent",
          sendDate: now,
        },
      });

      // Record SimEvent
      await db.simEvent.create({
        data: {
          campaignId,
          email: target.email,
          time: now,
          message: "Email Sent",
          details: `Dispatched to ${target.email} via ${profile.name}`,
        },
      });

      sent++;
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : String(err) || "Failed to send email via SMTP";
      console.error(`[CampaignDispatcher] Error sending email to ${target.email}:`, err);

      // Update Result record to Error
      await db.result.update({
        where: target.id ? { id: target.id } : { rId: target.rId },
        data: {
          status: "Error",
          sendDate: now,
        },
      });

      // Record SimEvent for failure
      await db.simEvent.create({
        data: {
          campaignId,
          email: target.email,
          time: now,
          message: "Error Sending Email",
          details: errorMsg,
        },
      });

      errorCount++;
      errors.push({ email: target.email, error: errorMsg });
      // Crucial: continue to next target, do NOT throw or abort!
    }
  }

  return {
    total: targetsToDispatch.length,
    sent,
    error: errorCount,
    errors,
  };
}
