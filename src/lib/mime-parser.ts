export interface ParsedEmail {
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
}

export interface AttachmentRecord {
  id?: number;
  name: string;
  type: string;
  content?: string;
}

export interface TemplateRecord {
  id: number;
  name: string;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  envelopeSender?: string | null;
  modifiedDate: Date | string;
  attachments?: AttachmentRecord[];
}

export function formatTemplate(t: TemplateRecord, includeAttachmentContent = false) {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject ?? "",
    text: t.text ?? "",
    html: t.html ?? "",
    envelope_sender: t.envelopeSender ?? "",
    envelopeSender: t.envelopeSender ?? "",
    modified_date: t.modifiedDate instanceof Date ? t.modifiedDate.toISOString() : String(t.modifiedDate),
    modifiedDate: t.modifiedDate instanceof Date ? t.modifiedDate.toISOString() : String(t.modifiedDate),
    attachments: (t.attachments || []).map((att: AttachmentRecord) => {
      const formattedAtt: {
        id?: number;
        name: string;
        type: string;
        content?: string;
      } = {
        id: att.id,
        name: att.name,
        type: att.type,
      };
      if (includeAttachmentContent || "content" in att) {
        formattedAtt.content = att.content;
      }
      return formattedAtt;
    }),
  };
}

/**
 * Decodes bytes into string using specified charset.
 */
function decodeBytesWithCharset(bytes: Uint8Array, charset = "utf-8"): string {
  const norm = charset.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  try {
    return new TextDecoder(norm).decode(bytes);
  } catch {
    try {
      if (norm.includes("8859") || norm.includes("latin")) {
        return new TextDecoder("iso-8859-1").decode(bytes);
      }
      if (norm.includes("1252")) {
        return new TextDecoder("windows-1252").decode(bytes);
      }
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return Buffer.from(bytes).toString("utf-8");
    }
  }
}

/**
 * Decodes RFC 2047 encoded-word format: =?charset?encoding?encoded_text?=
 * For example: =?UTF-8?B?VGVzdA==?= or =?ISO-8859-1?Q?Keld_J=F8rn_Simonsen?=
 */
export function decodeRfc2047(text: string): string {
  if (!text || !text.includes("=?")) return text;

  // RFC 2047: whitespace between adjacent encoded-words should be removed
  const normalized = text.replace(/(\=\?[^?]+\?[bBqQ]\?[^?]+\?\=)\s+(?=\=\?[^?]+\?[bBqQ]\?[^?]+\?\=)/g, "$1");

  const rfc2047Regex = /=\?([^?]+)\?([bBqQ])\?([^?]+)\?=/g;

  return normalized.replace(rfc2047Regex, (_match, charset, encoding, payload) => {
    const enc = encoding.toUpperCase();
    try {
      if (enc === "B") {
        // Base64
        const rawBytes = Buffer.from(payload, "base64");
        return decodeBytesWithCharset(rawBytes, charset);
      } else if (enc === "Q") {
        // Quoted-Printable in header: '_' represents space (0x20)
        const bytes: number[] = [];
        for (let i = 0; i < payload.length; i++) {
          const char = payload[i];
          if (char === "_") {
            bytes.push(0x20);
          } else if (char === "=" && i + 2 < payload.length) {
            const hex = payload.slice(i + 1, i + 3);
            if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
              bytes.push(parseInt(hex, 16));
              i += 2;
            } else {
              bytes.push(char.charCodeAt(0));
            }
          } else {
            bytes.push(char.charCodeAt(0));
          }
        }
        return decodeBytesWithCharset(new Uint8Array(bytes), charset);
      }
    } catch {
      return payload;
    }
    return payload;
  });
}

/**
 * Decodes quoted-printable body text.
 */
export function decodeQuotedPrintable(input: string, charset = "utf-8"): string {
  if (!input) return "";

  // 1. Remove soft line breaks (an equals sign at the end of a line)
  const softBreakStripped = input.replace(/=\r?\n/g, "");

  // 2. Decode hex-encoded bytes =XX
  const bytes: number[] = [];
  for (let i = 0; i < softBreakStripped.length; i++) {
    const char = softBreakStripped[i];
    if (char === "=" && i + 2 < softBreakStripped.length) {
      const hex = softBreakStripped.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(char.charCodeAt(0));
  }

  return decodeBytesWithCharset(new Uint8Array(bytes), charset);
}

/**
 * Decodes base64 body text.
 */
export function decodeBase64(input: string, charset = "utf-8"): string {
  if (!input) return "";
  const cleaned = input.replace(/\s+/g, "");
  try {
    const buffer = Buffer.from(cleaned, "base64");
    return decodeBytesWithCharset(buffer, charset);
  } catch {
    return input;
  }
}

/**
 * Parses header block into normalized key-value pairs with RFC 2822 unfolding.
 */
function parseHeaders(rawHeaders: string): { map: Record<string, string>; rawMap: Record<string, string> } {
  const map: Record<string, string> = {};
  const rawMap: Record<string, string> = {};
  if (!rawHeaders) return { map, rawMap };

  // Unfold multi-line headers (lines starting with space or tab)
  const unfolded = rawHeaders.replace(/\r?\n[ \t]+/g, " ");
  const lines = unfolded.split(/\r?\n/);

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    const lowerKey = key.toLowerCase();
    rawMap[lowerKey] = val;
    map[lowerKey] = decodeRfc2047(val);
  }

  return { map, rawMap };
}

/**
 * Extracts boundary string and charset from Content-Type header.
 */
function parseContentType(contentTypeHeader?: string): {
  type: string;
  boundary?: string;
  charset: string;
} {
  if (!contentTypeHeader) {
    return { type: "text/plain", charset: "utf-8" };
  }

  const parts = contentTypeHeader.split(";").map((p) => p.trim());
  const type = parts[0]?.toLowerCase() || "text/plain";
  let boundary: string | undefined;
  let charset = "utf-8";

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const paramKey = part.slice(0, eqIdx).trim().toLowerCase();
    let paramVal = part.slice(eqIdx + 1).trim();
    if (paramVal.startsWith('"') && paramVal.endsWith('"')) {
      paramVal = paramVal.slice(1, -1);
    }
    if (paramKey === "boundary") {
      boundary = paramVal;
    } else if (paramKey === "charset") {
      charset = paramVal;
    }
  }

  return { type, boundary, charset };
}

/**
 * Decodes body content according to Content-Transfer-Encoding and charset.
 */
function decodeBodyContent(body: string, transferEncoding?: string, charset = "utf-8"): string {
  const enc = (transferEncoding || "").toLowerCase().trim();
  if (enc === "quoted-printable") {
    return decodeQuotedPrintable(body, charset);
  } else if (enc === "base64") {
    return decodeBase64(body, charset);
  }
  // 7bit, 8bit, binary, or unspecified
  return body;
}

/**
 * Recursively parses MIME parts given body and boundary.
 */
function parseMultipart(
  body: string,
  boundary: string
): { text: string; html: string } {
  let text = "";
  let html = "";

  const delimiter = `--${boundary}`;
  const parts = body.split(delimiter);

  // First part is preamble, last part may end with '--' (epilogue)
  for (let i = 1; i < parts.length; i++) {
    let part = parts[i];
    if (part.startsWith("--")) {
      // Reached closing boundary
      break;
    }

    // Strip leading newline after delimiter
    part = part.replace(/^(\r?\n)/, "");

    // Separate headers from body
    const headerSep = part.match(/\r?\n\r?\n/);
    if (!headerSep || headerSep.index === undefined) continue;

    const rawPartHeaders = part.slice(0, headerSep.index);
    const rawPartBody = part.slice(headerSep.index + headerSep[0].length);

    const { map: partHeaders } = parseHeaders(rawPartHeaders);
    const contentTypeInfo = parseContentType(partHeaders["content-type"]);
    const transferEncoding = partHeaders["content-transfer-encoding"];

    if (contentTypeInfo.type.startsWith("multipart/") && contentTypeInfo.boundary) {
      // Nested multipart
      const nested = parseMultipart(rawPartBody, contentTypeInfo.boundary);
      if (nested.text && !text) text = nested.text;
      if (nested.html && !html) html = nested.html;
    } else {
      const decodedBody = decodeBodyContent(
        rawPartBody,
        transferEncoding,
        contentTypeInfo.charset
      );
      if (contentTypeInfo.type === "text/plain") {
        if (!text) text = decodedBody.trim();
      } else if (contentTypeInfo.type === "text/html") {
        if (!html) html = decodedBody.trim();
      }
    }
  }

  return { text, html };
}

/**
 * Rewrites all <a ... href="..."> anchor tags to <a ... href="{{.URL}}">
 * Preserves all other attributes (class, id, style, title, target, etc.) and inner HTML.
 */
export function convertLinksToTemplateUrl(html: string): string {
  if (!html) return "";

  // 1. Quoted href attributes: href="..." or href='...'
  let converted = html.replace(
    /<a\b([^>]*?)\bhref\s*=\s*(["'])(.*?)\2([^>]*)>/gi,
    '<a$1href="{{.URL}}"$4>'
  );

  // 2. Unquoted href attributes: href=http://example.com
  converted = converted.replace(
    /<a\b([^>]*?)\bhref\s*=\s*([^"'\s>]+)([^>]*)>/gi,
    '<a$1href="{{.URL}}"$3>'
  );

  return converted;
}

/**
 * Strips accidental http:// or https:// prepended to {{.URL}} by rich text editors.
 * E.g., <a href="http://{{.URL}}"> -> <a href="{{.URL}}">
 */
export function cleanTemplateUrls(html: string): string {
  if (!html) return "";
  return html.replace(/https?:\/\/{{\.URL}}/gi, "{{.URL}}");
}

/**
 * Checks if tracker tag is present in HTML string.
 */
export function hasTracker(html: string): boolean {
  if (!html) return false;
  return (
    html.includes("{{.Tracker}}") ||
    html.includes("{{.TrackingUrl}}") ||
    html.includes("{{.TrackingURL}}")
  );
}

/**
 * Injects {{.Tracker}} before </body> if present and not already tracked.
 * Appends {{.Tracker}} at end if </body> is missing.
 */
export function injectTracker(html: string): string {
  if (!html) return "{{.Tracker}}";
  if (hasTracker(html)) return html;

  const bodyCloseRegex = /<\/body\s*>/i;
  if (bodyCloseRegex.test(html)) {
    return html.replace(bodyCloseRegex, "{{.Tracker}}</body>");
  }

  return `${html}{{.Tracker}}`;
}

/**
 * Strips {{.Tracker}} before </body> or any standalone {{.Tracker}} occurrence.
 */
export function stripTracker(html: string): string {
  if (!html) return "";
  let cleaned = html.replace(/{{.Tracker}}<\/body\s*>/gi, "</body>");
  cleaned = cleaned.replace(/{{.Tracker}}/g, "");
  return cleaned;
}

/**
 * Parses raw MIME or EML content string into Subject, Text, and HTML body.
 */
export function parseRawEmail(raw: string, convertLinks = false): ParsedEmail {
  if (!raw || !raw.trim()) {
    return {
      subject: "",
      text: "",
      html: "",
      headers: {},
    };
  }

  // Strip leading blank lines and mbox 'From ' envelope header
  let trimmedRaw = raw.replace(/^(\r?\n)+/, "");
  if (/^From\s+[^\r\n]*(\r?\n|$)/i.test(trimmedRaw)) {
    trimmedRaw = trimmedRaw.replace(/^From\s+[^\r\n]*(\r?\n|$)/i, "");
    trimmedRaw = trimmedRaw.replace(/^(\r?\n)+/, "");
  }

  // Check if raw string is not a MIME message but raw HTML or plain text
  // (Missing colon in the first line before any newline)
  const firstLine = trimmedRaw.split(/\r?\n/)[0] || "";
  const hasHeaders = /^[a-zA-Z0-9_-]+:/.test(firstLine);

  let subject = "";
  let text = "";
  let html = "";
  let headers: Record<string, string> = {};

  if (!hasHeaders) {
    // If it looks like HTML
    if (/<[a-z][\s\S]*>/i.test(trimmedRaw)) {
      html = trimmedRaw;
    } else {
      text = trimmedRaw;
    }
  } else {
    // Separate top-level headers and body
    const headerSep = trimmedRaw.match(/\r?\n\r?\n/);
    if (!headerSep || headerSep.index === undefined) {
      // Only headers or badly formatted
      const { map } = parseHeaders(trimmedRaw);
      headers = map;
      subject = map["subject"] || "";
    } else {
      const rawHeaders = trimmedRaw.slice(0, headerSep.index);
      const rawBody = trimmedRaw.slice(headerSep.index + headerSep[0].length);

      const { map } = parseHeaders(rawHeaders);
      headers = map;
      subject = map["subject"] || "";

      const contentTypeInfo = parseContentType(map["content-type"]);
      const transferEncoding = map["content-transfer-encoding"];

      if (contentTypeInfo.type.startsWith("multipart/") && contentTypeInfo.boundary) {
        const parsed = parseMultipart(rawBody, contentTypeInfo.boundary);
        text = parsed.text;
        html = parsed.html;
      } else {
        const decoded = decodeBodyContent(
          rawBody,
          transferEncoding,
          contentTypeInfo.charset
        );
        if (contentTypeInfo.type === "text/html") {
          html = decoded.trim();
        } else if (contentTypeInfo.type === "text/plain") {
          text = decoded.trim();
        } else if (/<[a-z][\s\S]*>/i.test(decoded)) {
          html = decoded.trim();
        } else {
          text = decoded.trim();
        }
      }
    }
  }

  // Apply URL sanitization
  if (html) {
    html = cleanTemplateUrls(html);
    if (convertLinks) {
      html = convertLinksToTemplateUrl(html);
    }
  }

  return {
    subject,
    text,
    html,
    headers,
  };
}
