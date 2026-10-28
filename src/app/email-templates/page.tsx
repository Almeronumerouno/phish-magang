"use client";

import { useState, useEffect, useRef, useDeferredValue, useMemo } from "react";
import {
  Mail,
  Plus,
  Pencil,
  Copy,
  Trash2,
  HelpCircle,
  X,
  Loader2,
  Search,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Paperclip,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Radio,
  Eye,
  Code,
  ArrowLeft,
  Archive,
  OctagonAlert,
  Clock,
  FolderInput,
  Tag,
  MoreVertical,
  Star,
  Bookmark,
  Printer,
  ExternalLink,
  ChevronDown,
  Reply,
  Forward,
  Download,
  HardDrive,
  RefreshCw,
} from "lucide-react";

function getAvatarColor(seed: string) {
  const colors = [
    "#0b57d0", // Google Blue
    "#c5221f", // Google Red
    "#137333", // Google Green
    "#b06000", // Google Amber
    "#7b1fa2", // Google Purple
    "#007b83", // Google Teal
    "#d93025", // Vibrant Red
    "#188038", // Deep Green
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function parseEnvelopeSender(raw: string) {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return {
      name: "Security Operations",
      email: "security@company.com",
      initial: "S",
      color: "#0b57d0",
    };
  }

  // Format: "Display Name <user@domain.com>" or "Display Name<user@domain.com>"
  const match = trimmed.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    const rawName = match[1].trim();
    const email = match[2].trim();
    const name = rawName || email.split("@")[0] || "User";
    const initial = (name[0] || email[0] || "U").toUpperCase();
    return { name, email, initial, color: getAvatarColor(name + email) };
  }

  // Format: plain email "user@domain.com"
  if (trimmed.includes("@")) {
    const name = trimmed.split("@")[0];
    const initial = (name[0] || "U").toUpperCase();
    return { name, email: trimmed, initial, color: getAvatarColor(trimmed) };
  }

  // Format: plain string name
  return {
    name: trimmed,
    email: "security@company.com",
    initial: (trimmed[0] || "U").toUpperCase(),
    color: getAvatarColor(trimmed),
  };
}

function getGmailPreviewDocument(htmlContent: string, textContent: string, activeMode: "html" | "text" = "html") {
  const hasHtml = !!htmlContent && htmlContent.trim().length > 0;
  const hasText = !!textContent && textContent.trim().length > 0;

  // Determine effective rendering mode based on user's active editor tab / selection
  let modeToRender: "html" | "text" | "empty" = "empty";
  if (activeMode === "text") {
    if (hasText) modeToRender = "text";
    else if (hasHtml) modeToRender = "html";
  } else {
    if (hasHtml) modeToRender = "html";
    else if (hasText) modeToRender = "text";
  }

  if (modeToRender === "html") {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #222222;
      margin: 0;
      padding: 6px 0 16px 0;
      background: #ffffff;
      word-wrap: break-word;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    a {
      color: #1a73e8;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
  }

  if (modeToRender === "text") {
    const escaped = textContent
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #222222;
      margin: 0;
      padding: 6px 0 16px 0;
      background: #ffffff;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    a {
      color: #1a73e8;
    }
  </style>
</head>
<body>${escaped}</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 13px;
      color: #747775;
      font-style: italic;
      margin: 0;
      padding: 28px 0;
      background: #ffffff;
    }
  </style>
</head>
<body>(No content in message body)</body>
</html>`;
}

// Convert HTML email body into clean, human-readable plaintext
function htmlToPlainText(html: string): string {
  if (!html || !html.trim()) return "";

  if (typeof window !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());

      doc.querySelectorAll("a").forEach((a) => {
        const href = a.getAttribute("href");
        const text = a.textContent?.trim() || "";
        if (href && text && href !== text && !href.startsWith("javascript:")) {
          a.textContent = `${text} ( ${href} )`;
        }
      });

      doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      doc.querySelectorAll("li").forEach((li) => {
        li.prepend("• ");
        li.after("\n");
      });
      doc.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, tr, blockquote, hr").forEach((el) => {
        el.after("\n");
      });

      const raw = doc.body.textContent || "";
      const cleaned = raw
        .split("\n")
        .map((l) => l.trim())
        .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
        .join("\n")
        .trim();

      if (cleaned) return cleaned;
    } catch {
      // Fall through to regex below
    }
  }

  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (_, href, text) => {
      const cleanText = text.replace(/<[^>]+>/g, "").trim();
      if (!cleanText || cleanText === href) return href;
      return `${cleanText} ( ${href} )`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|li|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}


interface AttachmentItem {
  id?: number;
  name: string;
  type: string;
  size?: number;
  content: string; // Raw Base64 string without data URI scheme
}

interface EmailTemplate {
  id: number;
  name: string;
  envelope_sender?: string | null;
  envelopeSender?: string | null;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  modified_date?: string;
  modifiedDate?: string;
  attachments?: AttachmentItem[];
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Main Modal State (New / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formEnvelopeSender, setFormEnvelopeSender] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formText, setFormText] = useState("");
  const [formHtml, setFormHtml] = useState("");
  const [formAddTrackingImage, setFormAddTrackingImage] = useState(true);
  const [formAttachments, setFormAttachments] = useState<AttachmentItem[]>([]);

  // Editor Tabs: "text" | "html"
  const [activeTab, setActiveTab] = useState<"text" | "html">("html");
  // Track whether plaintext was manually customized by user
  const [isTextManuallyEdited, setIsTextManuallyEdited] = useState(false);
  // Dedicated preview tab override: null = follow editor activeTab, "html" = force HTML, "text" = force Plaintext
  const [previewTabOverride, setPreviewTabOverride] = useState<"html" | "text" | null>(null);

  const effectivePreviewMode = previewTabOverride ?? activeTab;

  // Mobile View Switcher: "editor" | "preview"
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor");

  // Deferred values for real-time zero-lag live Gmail preview
  const deferredHtml = useDeferredValue(formHtml);
  const deferredText = useDeferredValue(formText);
  const deferredSubject = useDeferredValue(formSubject);
  const deferredEnvelopeSender = useDeferredValue(formEnvelopeSender);

  // Parsed sender details for Gmail header
  const parsedSender = useMemo(
    () => parseEnvelopeSender(deferredEnvelopeSender),
    [deferredEnvelopeSender]
  );

  // Sandboxed Gmail preview document (automatically reflects active mode)
  const gmailPreviewDoc = useMemo(
    () => getGmailPreviewDocument(deferredHtml, deferredText, effectivePreviewMode),
    [deferredHtml, deferredText, effectivePreviewMode]
  );

  // DOM references for cursor tag insertion
  const textRef = useRef<HTMLTextAreaElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import Email Sub-modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importContent, setImportContent] = useState("");
  const [convertLinks, setConvertLinks] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Delete Confirm Dialog State
  const [deleteConfirm, setDeleteConfirm] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Page Flash Notification
  const [flashMessage, setFlashMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const showFlash = (text: string, type: "success" | "error" = "success") => {
    setFlashMessage({ text, type });
    setTimeout(() => setFlashMessage(null), 4000);
  };
  // Fetch Templates List
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : []);
      } else {
        showFlash("Gagal memuat email template.", "error");
      }
    } catch (err) {
      console.error("Failed to fetch email templates:", err);
      showFlash("Gagal memuat email template.", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchTemplates();
  }, []);

  // Open New Template Modal
  const openNewModal = () => {
    setEditingId(null);
    setFormName("");
    setFormEnvelopeSender("");
    setFormSubject("");
    setFormText("");
    setFormHtml("");
    setIsTextManuallyEdited(false);
    setFormAddTrackingImage(true);
    setFormAttachments([]);
    setActiveTab("html");
    setPreviewTabOverride(null);
    setMobileTab("editor");
    setModalError(null);
    setModalOpen(true);
  };
  // Open Edit Template Modal (fetches detail to get full attachments)
  const openEditModal = async (template: EmailTemplate) => {
    setEditingId(template.id);
    setFormName(template.name);
    setFormEnvelopeSender(template.envelope_sender || template.envelopeSender || "");
    setFormSubject(template.subject || "");
    setFormText(template.text || "");
    setIsTextManuallyEdited(!!(template.text && template.text.trim()));
    const initialHtml = template.html || "";
    setFormHtml(initialHtml);
    setFormAddTrackingImage(
      initialHtml.includes("{{.Tracker}}") ||
      initialHtml.includes("{{.TrackingUrl}}") ||
      initialHtml.includes("{{.TrackingURL}}")
    );
    setActiveTab(initialHtml ? "html" : "text");
    setPreviewTabOverride(null);
    setMobileTab("editor");
    setModalError(null);
    setModalOpen(true);

    try {
      const res = await fetch(`/api/email-templates/${template.id}`);
      if (res.ok) {
        const fullDetail: EmailTemplate = await res.json();
        if (fullDetail.attachments) {
          setFormAttachments(
            fullDetail.attachments.map((a) => ({
              id: a.id,
              name: a.name,
              type: a.type,
              content: a.content || "",
              size: a.size || (a.content ? Math.round(a.content.length * 0.75) : 0),
            }))
          );
        }
      }
    } catch (err) {
      console.error("Failed to fetch template detail attachments:", err);
    }
  };
  // Copy Template (GoPhish copy logic)
  const handleCopyTemplate = async (template: EmailTemplate) => {
    try {
      const res = await fetch(`/api/email-templates/${template.id}`);
      let fullDetail = template;
      if (res.ok) {
        fullDetail = await res.json();
      }

      setEditingId(null); // Save as new template
      setFormName(`Copy of ${fullDetail.name}`);
      setFormEnvelopeSender(fullDetail.envelope_sender || fullDetail.envelopeSender || "");
      setFormSubject(fullDetail.subject || "");
      setFormText(fullDetail.text || "");
      setIsTextManuallyEdited(!!(fullDetail.text && fullDetail.text.trim()));
      const initialHtml = fullDetail.html || "";
      setFormHtml(initialHtml);
      setFormAddTrackingImage(
        initialHtml.includes("{{.Tracker}}") ||
        initialHtml.includes("{{.TrackingUrl}}") ||
        initialHtml.includes("{{.TrackingURL}}")
      );
      setFormAttachments(
        fullDetail.attachments
          ? fullDetail.attachments.map((a) => ({
              name: a.name,
              type: a.type,
              content: a.content || "",
              size: a.size || (a.content ? Math.round(a.content.length * 0.75) : 0),
            }))
          : []
      );
      setActiveTab(initialHtml ? "html" : "text");
      setPreviewTabOverride(null);
      setMobileTab("editor");
      setModalError(null);
      setModalOpen(true);
    } catch (err) {
      console.error("Failed to copy template:", err);
      showFlash("Gagal menduplikasi template.", "error");
    }
  };
  // Quick insertion tags into active editor tab
  const insertTag = (tag: string) => {
    if (activeTab === "text") {
      const el = textRef.current;
      if (!el) {
        setFormText((prev) => prev + tag);
        return;
      }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = el.value.substring(0, start) + tag + el.value.substring(end);
      setFormText(next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      const el = htmlRef.current;
      if (!el) {
        setFormHtml((prev) => prev + tag);
        return;
      }
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = el.value.substring(0, start) + tag + el.value.substring(end);
      setFormHtml(next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    }
  };
  // Attachment upload handler via FileReader Base64 encoding
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip data:mime;base64, prefix if present
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        const type = file.type || "application/octet-stream";
        setFormAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            type,
            size: file.size,
            content: base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  const handleRemoveAttachment = (index: number) => {
    setFormAttachments((prev) => prev.filter((_, i) => i !== index));
  };
  // Import Email via /api/import/email
  const handleImportEmail = async () => {
    if (!importContent.trim()) {
      setImportError("No Content Specified!");
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const res = await fetch("/api/import/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: importContent,
          convert_links: convertLinks,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Failed to import email");
      }

      if (data.subject) {
        setFormSubject(data.subject);
      }
      if (data.text) {
        setFormText(data.text);
        setIsTextManuallyEdited(true);
      } else if (data.html) {
        setFormText(htmlToPlainText(data.html));
        setIsTextManuallyEdited(false);
      }
      if (data.html) {
        setFormHtml(data.html);
        setActiveTab("html");
      }

      setImportModalOpen(false);
      setImportContent("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal mengimpor email";
      setImportError(message);
    } finally {
      setImporting(false);
    }
  };
  // Save Template (POST or PUT)
  const handleSaveTemplate = async () => {
    if (!formName.trim()) {
      setModalError("Template name not specified");
      return;
    }
    if (!formText.trim() && !formHtml.trim()) {
      setModalError("Need to specify at least plaintext or HTML content");
      return;
    }

    setSaving(true);
    setModalError(null);

    try {
      let processedHtml = formHtml;
      // 1. WYSIWYG URL scheme sanitization: http://{{.URL}} -> {{.URL}}
      processedHtml = processedHtml.replace(/https?:\/\/{{\.URL}}/gi, "{{.URL}}");

      // 2. Add Tracking Image logic (GoPhish parity)
      if (formAddTrackingImage && processedHtml.trim()) {
        if (
          !processedHtml.includes("{{.Tracker}}") &&
          !processedHtml.includes("{{.TrackingUrl}}") &&
          !processedHtml.includes("{{.TrackingURL}}")
        ) {
          if (processedHtml.includes("</body>")) {
            processedHtml = processedHtml.replace("</body>", "{{.Tracker}}</body>");
          } else {
            processedHtml = processedHtml + "{{.Tracker}}";
          }
        }
      } else if (!formAddTrackingImage) {
        processedHtml = processedHtml.replace("{{.Tracker}}</body>", "</body>");
        processedHtml = processedHtml.replace(/\{\{\.Tracker\}\}/g, "");
      }

      const finalPayloadText = formText.trim()
        ? formText
        : (processedHtml.trim() ? htmlToPlainText(processedHtml) : "");

      const payload = {
        name: formName.trim(),
        envelope_sender: formEnvelopeSender.trim() || undefined,
        subject: formSubject.trim() || undefined,
        text: finalPayloadText,
        html: processedHtml,
        use_tracker: formAddTrackingImage,
        attachments: formAttachments.map((a) => ({
          name: a.name,
          type: a.type,
          content: a.content,
        })),
      };
      const url = editingId ? `/api/email-templates/${editingId}` : "/api/email-templates";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Gagal menyimpan email template");
      }

      setModalOpen(false);
      showFlash(editingId ? "Template berhasil diperbarui!" : "Template berhasil ditambahkan!");
      fetchTemplates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan email template";
      setModalError(message);
    } finally {
      setSaving(false);
    }
  };
  // Delete Template
  const handleDeleteTemplate = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/email-templates/${deleteConfirm.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Gagal menghapus template");
      }

      showFlash("Template email berhasil dihapus!");
      setDeleteConfirm(null);
      fetchTemplates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gagal menghapus template";
      showFlash(message, "error");
    } finally {
      setDeleting(false);
    }
  };
  // Helper formatting functions
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
      });
    } catch {
      return dateStr;
    }
  };
  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "0 B";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };
  const getMimeIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("pdf")) return FileText;
    if (t.includes("sheet") || t.includes("excel") || t.includes("csv")) return FileSpreadsheet;
    if (t.includes("word") || t.includes("document") || t.includes("text")) return FileText;
    if (t.includes("image")) return ImageIcon;
    if (t.includes("zip") || t.includes("tar") || t.includes("archive") || t.includes("compressed")) return FileArchive;
    return Paperclip;
  };
  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.subject && t.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.envelope_sender && t.envelope_sender.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.envelopeSender && t.envelopeSender.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-5 max-w-[1440px] pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg border border-teal-100">
              <Mail size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Email Templates
              </h1>
              <p className="text-xs text-muted">
                Kelola template email phishing dan skenario pesan simulasi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted bg-gray-50 border border-border px-3 py-1.5 rounded-md">
            <span className="font-semibold text-foreground">{templates.length}</span> Templates
          </div>

          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-btn-primary hover:bg-gray-800 text-white text-xs font-semibold rounded-md transition-all shadow-xs cursor-pointer w-full sm:w-auto"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Flash Alert Banner */}
      {flashMessage && (
        <div
          className={`p-3 text-xs rounded-md border flex items-center justify-between animate-in fade-in ${
            flashMessage.type === "success"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {flashMessage.type === "success" ? (
              <CheckCircle2 size={15} className="text-green-600" />
            ) : (
              <AlertCircle size={15} className="text-red-600" />
            )}
            <span>{flashMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFlashMessage(null)}
            className="text-muted hover:text-foreground p-0.5"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
        {/* Table Filter Bar */}
        <div className="p-3 border-b border-border bg-gray-50/50 flex items-center justify-between gap-3">
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <span className="text-xs text-muted shrink-0">
            {filteredTemplates.length} {filteredTemplates.length === 1 ? "template" : "templates"}
          </span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[750px] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-gray-50 font-semibold text-muted uppercase tracking-wider text-[11px]">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Attachments</th>
                <th className="px-4 py-3">Modified Date</th>
                <th className="px-4 py-3 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">
                    <Loader2 size={24} className="animate-spin text-muted mx-auto mb-2" />
                    <span>Loading templates...</span>
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3 border border-teal-100">
                      <Mail size={22} />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">
                      No templates yet. Let&apos;s create one!
                    </p>
                    <p className="text-xs text-muted max-w-sm mx-auto mb-4">
                      Belum ada email template untuk simulasi phishing. Buat template pertama Anda sekarang.
                    </p>
                    <button
                      type="button"
                      onClick={openNewModal}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-btn-primary hover:bg-gray-800 text-white text-xs font-semibold rounded-md transition-all shadow-sm cursor-pointer"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                      <span>New Template</span>
                    </button>
                  </td>
                </tr>
              ) : filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Tidak ada template yang sesuai dengan &quot;{searchQuery}&quot;
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((template) => {
                  const modDate = template.modified_date || template.modifiedDate;
                  const dateStr = formatDate(modDate);
                  const attCount = template.attachments?.length || 0;

                  return (
                    <tr key={template.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3 text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-[11px] shrink-0 border border-teal-100">
                            {template.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block">{template.name}</span>
                            <span className="text-[11px] text-muted font-mono">ID #{template.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted truncate max-w-xs">
                        {template.subject || <span className="italic text-muted/60">(No Subject)</span>}
                      </td>
                      <td className="px-4 py-3">
                        {attCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            <Paperclip size={11} />
                            {attCount} {attCount === 1 ? "file" : "files"}
                          </span>
                        ) : (
                          <span className="text-muted/60 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Calendar size={13} className="text-muted/70 shrink-0" />
                          <span>{dateStr}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(template)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-colors cursor-pointer"
                            title="Edit Template"
                            aria-label="Edit Template"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyTemplate(template)}
                            className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded border border-transparent hover:border-emerald-200 transition-colors cursor-pointer"
                            title="Copy Template"
                            aria-label="Copy Template"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(template)}
                            className="p-1.5 text-slate-600 hover:text-red-700 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                            title="Delete Template"
                            aria-label="Delete Template"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== NEW / EDIT TEMPLATE DUAL MODALS ===================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="flex flex-col lg:flex-row gap-5 w-full max-w-[1560px] h-[92vh] max-h-[92vh] items-stretch animate-in zoom-in-95 duration-150">
            {/* Modal Window 1: Template Editor */}
            <div
              className={`w-full lg:w-1/2 bg-white border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden min-w-0 h-full ${
                mobileTab === "preview" ? "hidden lg:flex" : "flex"
              }`}
            >
              {/* Window 1 Header */}
              <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-b border-border bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Mail size={16} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-foreground">
                      {editingId === null ? "New Template" : "Edit Template"}
                    </h2>
                    <p className="text-xs text-muted">
                      Konfigurasi template email phishing & envelope
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mobile View Toggle */}
                  <div className="flex lg:hidden items-center p-1 bg-zinc-100 rounded-lg border border-zinc-200 gap-1 mr-1">
                    <button
                      type="button"
                      onClick={() => setMobileTab("editor")}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        mobileTab === "editor"
                          ? "bg-white text-zinc-900 shadow-2xs"
                          : "text-zinc-500 hover:text-zinc-900"
                      }`}
                    >
                      Editor
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileTab("preview")}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        mobileTab === "preview"
                          ? "bg-white text-zinc-900 shadow-2xs"
                          : "text-zinc-500 hover:text-zinc-900"
                      }`}
                    >
                      Gmail View
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setImportModalOpen(true);
                      setImportError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-white hover:bg-zinc-50 text-foreground transition-all shadow-2xs hover:border-zinc-400 cursor-pointer"
                  >
                    <Mail size={13} className="text-zinc-600" />
                    <span>Import Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                    aria-label="Close modal"
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Window 1 Body */}
              <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5 bg-white text-xs">
                {modalError && (
                  <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-red-600" />
                    <span>{modalError}</span>
                  </div>
                )}

                {/* Form Grid: Name & Envelope Sender */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                  <div className="sm:col-span-7 space-y-1.5">
                    <label htmlFor="template-name" className="text-xs font-semibold text-foreground block">
                      Name:
                    </label>
                    <input
                      id="template-name"
                      type="text"
                      placeholder="Template name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-border rounded-lg bg-white text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground transition-all"
                    />
                  </div>

                  <div className="sm:col-span-5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="template-envelope-sender" className="text-xs font-semibold text-foreground block">
                        Envelope Sender:
                      </label>
                      <div className="relative group">
                        <HelpCircle size={13} className="text-muted cursor-help" />
                        <div className="absolute bottom-full right-0 mb-1.5 hidden group-hover:block w-72 p-2.5 bg-zinc-900 text-white text-[11px] rounded-lg shadow-xl z-20 pointer-events-none leading-relaxed">
                          Overrides SMTP From address (e.g. First Last &lt;user@example.com&gt;). Digunakan oleh email client sebagai alamat pengirim amplop.
                        </div>
                      </div>
                    </div>
                    <input
                      id="template-envelope-sender"
                      type="text"
                      placeholder="First Last <user@example.com>"
                      value={formEnvelopeSender}
                      onChange={(e) => setFormEnvelopeSender(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-border rounded-lg bg-white text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground transition-all font-mono text-[11px]"
                    />
                    <p className="text-[10px] text-muted leading-tight">
                      Overrides SMTP From address (e.g. First Last &lt;user@example.com&gt;)
                    </p>
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <label htmlFor="template-subject" className="text-xs font-semibold text-foreground block">
                    Subject:
                  </label>
                  <input
                    id="template-subject"
                    type="text"
                    placeholder="Email Subject"
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-border rounded-lg bg-white text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground transition-all"
                  />
                </div>

                {/* Variables Toolbar */}
                <div className="p-3 bg-zinc-50/70 border border-zinc-200/80 rounded-xl space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-zinc-700 mr-1 flex items-center gap-1">
                      <Code size={13} className="text-zinc-500" />
                      Insert Tag:
                    </span>
                    {[
                      "{{.URL}}",
                      "{{.Tracker}}",
                      "{{.FirstName}}",
                      "{{.LastName}}",
                      "{{.Email}}",
                      "{{.Position}}",
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertTag(tag)}
                        className="px-2.5 py-1 text-[11px] font-mono font-medium bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-md transition-all cursor-pointer shadow-2xs active:scale-95 hover:border-zinc-400"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tabbed Editor Container */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    {/* Segmented Control */}
                    <div className="inline-flex p-1 bg-zinc-100 rounded-xl border border-zinc-200/70 gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("text");
                          setPreviewTabOverride(null);
                          if ((!isTextManuallyEdited || !formText.trim()) && formHtml.trim()) {
                            setFormText(htmlToPlainText(formHtml));
                          }
                        }}
                        className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                          activeTab === "text"
                            ? "bg-white text-zinc-900 shadow-xs"
                            : "text-zinc-500 hover:text-zinc-900"
                        }`}
                      >
                        Text
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("html");
                          setPreviewTabOverride(null);
                        }}
                        className={`px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                          activeTab === "html"
                            ? "bg-white text-zinc-900 shadow-xs"
                            : "text-zinc-500 hover:text-zinc-900"
                        }`}
                      >
                        HTML
                      </button>
                    </div>

                    <div className="text-[11px] text-muted font-mono">
                      {activeTab === "html" && (formHtml ? `${(formHtml.length / 1024).toFixed(1)} KB` : "0 KB")}
                      {activeTab === "text" && (formText ? `${(formText.length / 1024).toFixed(1)} KB` : "0 KB")}
                    </div>
                  </div>

                  {/* Editor Surfaces */}
                  {activeTab === "text" && (
                    <div className="border border-border rounded-xl overflow-hidden bg-white shadow-2xs">
                      <div className="bg-zinc-50/80 px-4 py-2 border-b border-border flex items-center justify-between text-[11px] text-muted font-mono">
                        <span className="font-medium text-foreground">email_body.txt</span>
                        <div className="flex items-center gap-2">
                          {formHtml.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormText(htmlToPlainText(formHtml));
                                setIsTextManuallyEdited(false);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-sans font-medium text-zinc-700 hover:text-black bg-white hover:bg-zinc-100 border border-zinc-200 rounded transition-all cursor-pointer shadow-2xs hover:border-zinc-400"
                              title="Sync plaintext content from HTML"
                            >
                              <RefreshCw size={11} className="text-zinc-500" />
                              <span>Sync from HTML</span>
                            </button>
                          )}
                          <span>UTF-8 | Plaintext</span>
                        </div>
                      </div>
                      <textarea
                        ref={textRef}
                        value={formText}
                        onChange={(e) => {
                          setIsTextManuallyEdited(true);
                          setFormText(e.target.value);
                        }}
                        placeholder="Plaintext version of the email..."
                        className="w-full min-h-[280px] max-h-[460px] p-4 font-mono text-xs bg-white text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-y leading-relaxed"
                      />
                    </div>
                  )}

                  {activeTab === "html" && (
                    <div className="border border-border rounded-xl overflow-hidden bg-white shadow-2xs">
                      <div className="bg-zinc-50/80 px-4 py-2 border-b border-border flex items-center justify-between text-[11px] text-muted font-mono">
                        <span className="font-medium text-foreground">email_template.html</span>
                        <span>UTF-8 | HTML5 Source</span>
                      </div>
                      <textarea
                        ref={htmlRef}
                        value={formHtml}
                        onChange={(e) => setFormHtml(e.target.value)}
                        placeholder="<html><body><h1>Phishing Email</h1>...</body></html>"
                        className="w-full min-h-[280px] max-h-[460px] p-4 font-mono text-xs bg-white text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-y leading-relaxed"
                      />
                    </div>
                  )}
                </div>

                {/* Add Tracking Image Card */}
                <div>
                  <label className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-zinc-50/70 hover:bg-zinc-50 transition-colors cursor-pointer select-none">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white text-zinc-800 flex items-center justify-center shrink-0 border border-zinc-200 shadow-2xs">
                        <Radio size={15} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">Add Tracking Image</span>
                          <span title="Menyisipkan beacon pelacak {{.Tracker}} di akhir tag </body> untuk mencatat email opens">
                            <HelpCircle size={13} className="text-muted" />
                          </span>
                        </div>
                        <p className="text-[11px] text-muted">
                          Menyisipkan beacon pelacak (<code className="font-mono text-[10px] bg-zinc-200/60 px-1 py-0.5 rounded">{"{{.Tracker}}"}</code>) otomatis untuk memantau open-rate target.
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formAddTrackingImage}
                      onChange={(e) => setFormAddTrackingImage(e.target.checked)}
                      className="w-4 h-4 cursor-pointer accent-black rounded"
                    />
                  </label>
                </div>

                {/* File Attachments Section */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center shrink-0">
                        <Paperclip size={14} />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-foreground">Attachments:</span>
                        <span className="text-[11px] text-muted ml-1.5">({formAttachments.length} files)</span>
                      </div>
                    </div>
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-black text-white text-xs font-medium rounded-lg transition-all cursor-pointer shadow-xs"
                      >
                        <Plus size={13} strokeWidth={2.5} />
                        <span>Add Files</span>
                      </button>
                    </div>
                  </div>

                  {formAttachments.length > 0 ? (
                    <div className="border border-border rounded-lg overflow-hidden bg-white divide-y divide-border/60">
                      {formAttachments.map((att, idx) => {
                        const IconComponent = getMimeIcon(att.type);
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3.5 py-2.5 text-xs hover:bg-zinc-50 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                              <IconComponent size={15} className="text-zinc-500 shrink-0" />
                              <span className="font-medium text-foreground truncate">{att.name}</span>
                              <span className="text-[11px] text-muted shrink-0 font-mono">
                                ({formatFileSize(att.size || (att.content ? Math.round(att.content.length * 0.75) : 0))})
                              </span>
                              <span className="text-[10px] text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 shrink-0 hidden sm:inline font-mono">
                                {att.type}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(idx)}
                              className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Remove Attachment"
                              aria-label="Remove Attachment"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 text-center border border-dashed border-zinc-200 rounded-lg text-muted text-[11px]">
                      Belum ada lampiran berkas. Klik <b>Add Files</b> untuk menambahkan payload phishing (PDF, Office, Zip, dll).
                    </div>
                  )}
                </div>
              </div>

              {/* Window 1 Footer */}
              <div className="flex-shrink-0 px-6 py-3.5 border-t border-border bg-zinc-50/90 flex items-center justify-between">
                <p className="text-[11px] text-muted hidden sm:block">
                  💡 Seluruh variabel <code className="font-mono text-zinc-700 bg-zinc-200/60 px-1 py-0.5 rounded">{"{{.URL}}"}</code> otomatis tersinkronisasi dengan Landing Page.
                </p>
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium border border-border rounded-lg hover:bg-zinc-100 text-foreground transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={saving}
                    className="px-5 py-2 text-xs font-medium bg-black hover:bg-zinc-800 text-white rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    <span>{saving ? "Saving..." : "Save Template"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Window 2: Dedicated Gmail Live Preview */}
            <div
              className={`w-full lg:w-1/2 bg-white border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden min-w-0 h-full ${
                mobileTab === "editor" ? "hidden lg:flex" : "flex"
              }`}
            >
              {/* Window 2 Chrome / Title Bar */}
              <div className="flex-shrink-0 px-4 py-3 bg-[#f6f8fc] border-b border-[#e0e3e7] flex items-center justify-between gap-3 select-none">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-400 border border-red-500/20" />
                    <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500/20" />
                    <span className="w-3 h-3 rounded-full bg-emerald-400 border border-emerald-500/20" />
                  </div>
                  <div className="h-4 w-px bg-[#c4c7c5] mx-1" />
                  <span className="text-xs font-semibold text-[#1f1f1f] flex items-center gap-1.5">
                    <Mail size={14} className="text-red-500" />
                    <span>Gmail — Live Preview</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mode switcher in preview titlebar */}
                  <div className="inline-flex p-0.5 bg-zinc-200/80 rounded-lg text-[10px] sm:text-[11px] font-medium border border-zinc-300/70">
                    <button
                      type="button"
                      onClick={() => setPreviewTabOverride("html")}
                      className={`px-2 sm:px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                        effectivePreviewMode === "html"
                          ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTabOverride("text")}
                      className={`px-2 sm:px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                        effectivePreviewMode === "text"
                          ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      Plaintext
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMobileTab("editor")}
                    className="lg:hidden px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-border text-zinc-700 shadow-2xs"
                  >
                    Back to Editor
                  </button>
                  <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live Synced</span>
                  </div>
                </div>
              </div>

              {/* Gmail Action Toolbar */}
              <div className="flex-shrink-0 px-4 py-2 bg-[#f6f8fc] border-b border-[#e0e3e7] flex items-center justify-between gap-2 select-none">
                <div className="flex items-center gap-0.5 sm:gap-1 text-[#444746]">
                  <button
                    type="button"
                    title="Back to inbox"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="h-4 w-px bg-[#c4c7c5] mx-1" />
                  <button
                    type="button"
                    title="Archive"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <Archive size={16} />
                  </button>
                  <button
                    type="button"
                    title="Report spam"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <OctagonAlert size={16} />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="h-4 w-px bg-[#c4c7c5] mx-1" />
                  <button
                    type="button"
                    title="Mark as unread"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <Mail size={16} />
                  </button>
                  <button
                    type="button"
                    title="Snooze"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <Clock size={16} />
                  </button>
                  <button
                    type="button"
                    title="Add to tasks"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                  <div className="h-4 w-px bg-[#c4c7c5] mx-1" />
                  <button
                    type="button"
                    title="Move to"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <FolderInput size={16} />
                  </button>
                  <button
                    type="button"
                    title="Labels"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <Tag size={16} />
                  </button>
                  <button
                    type="button"
                    title="More options"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-0.5 text-[#444746]">
                  <button
                    type="button"
                    title="Print all"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <Printer size={15} />
                  </button>
                  <button
                    type="button"
                    title="In new window"
                    className="p-1.5 rounded-full hover:bg-[#e9eef6] transition-colors cursor-pointer"
                  >
                    <ExternalLink size={15} />
                  </button>
                </div>
              </div>

              {/* Gmail Email Viewing Body */}
              <div className="flex-1 overflow-y-auto bg-white p-5 sm:p-7 space-y-4">
                {/* Subject Line Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#e0e3e7]">
                  <div className="flex items-center flex-wrap gap-2.5">
                    <h3 className="text-xl font-semibold text-[#1f1f1f] leading-snug break-words">
                      {deferredSubject.trim() || "(no subject)"}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#e8eaed] text-[#444746]">
                      Inbox
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-[#747775]">
                    <button
                      type="button"
                      title="Not starred"
                      className="p-1 rounded-full hover:bg-zinc-100 cursor-pointer"
                    >
                      <Star size={17} />
                    </button>
                    <button
                      type="button"
                      title="Important"
                      className="p-1 rounded-full hover:bg-zinc-100 cursor-pointer text-[#e37400]"
                    >
                      <Bookmark size={17} className="fill-[#e37400]/20" />
                    </button>
                  </div>
                </div>

                {/* Sender Information Row */}
                <div className="flex items-start justify-between gap-3 pt-1">
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Circular Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-base shadow-xs shrink-0 select-none"
                      style={{ backgroundColor: parsedSender.color }}
                    >
                      {parsedSender.initial}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-baseline flex-wrap gap-1.5 leading-tight">
                        <span className="font-bold text-sm text-[#1f1f1f] truncate">
                          {parsedSender.name}
                        </span>
                        <span className="text-xs text-[#5e5e5e] font-normal truncate">
                          &lt;{parsedSender.email}&gt;
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[#5e5e5e] mt-1">
                        <span>to me</span>
                        <span className="hidden sm:inline text-[11px] text-[#747775]">
                          &lt;target@company.com&gt;
                        </span>
                        <ChevronDown size={13} className="text-[#747775] cursor-pointer hover:text-[#1f1f1f]" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 text-[#5e5e5e]">
                    <span className="text-xs text-[#5e5e5e] whitespace-nowrap">
                      10:45 AM (just now)
                    </span>
                    <button
                      type="button"
                      title="Star"
                      className="p-1 rounded-full hover:bg-zinc-100 cursor-pointer text-[#747775] hidden sm:block"
                    >
                      <Star size={16} />
                    </button>
                    <button
                      type="button"
                      title="Reply"
                      className="p-1 rounded-full hover:bg-zinc-100 cursor-pointer text-[#747775]"
                    >
                      <Reply size={16} />
                    </button>
                    <button
                      type="button"
                      title="More options"
                      className="p-1 rounded-full hover:bg-zinc-100 cursor-pointer text-[#747775]"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>

                {/* Sandboxed Live Email Canvas */}
                <div className="w-full min-h-[340px] relative overflow-hidden bg-white mt-2">
                  <iframe
                    title="Gmail Live Preview Canvas"
                    srcDoc={gmailPreviewDoc}
                    className="w-full min-h-[340px] border-0"
                    sandbox="allow-same-origin allow-scripts"
                  />
                </div>

                {/* Gmail Attachment Chips */}
                {formAttachments.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-[#e0e3e7]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-[#444746] flex items-center gap-1.5">
                        <Paperclip size={13} className="text-[#5e5e5e]" />
                        {formAttachments.length} Attachment{formAttachments.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {formAttachments.map((att, idx) => {
                        const ext = att.name.includes(".") ? att.name.split(".").pop()?.toUpperCase() : "FILE";
                        const IconComp = getMimeIcon(att.type);
                        const isPdf = att.type.includes("pdf") || ext === "PDF";
                        const isSheet =
                          att.type.includes("sheet") ||
                          att.type.includes("excel") ||
                          ext === "XLSX" ||
                          ext === "CSV";
                        const isZip = att.type.includes("zip") || att.type.includes("archive") || ext === "ZIP";
                        const isImg = att.type.includes("image") || ["PNG", "JPG", "JPEG"].includes(ext || "");

                        const badgeColor = isPdf
                          ? "bg-red-50 text-red-600 border-red-200"
                          : isSheet
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : isZip
                          ? "bg-amber-50 text-amber-600 border-amber-200"
                          : isImg
                          ? "bg-purple-50 text-purple-600 border-purple-200"
                          : "bg-blue-50 text-blue-600 border-blue-200";

                        return (
                          <div
                            key={idx}
                            className="border border-[#c4c7c5] hover:border-[#747775] rounded-xl overflow-hidden bg-[#f8fafd] hover:bg-white hover:shadow-md transition-all group flex flex-col w-52 shrink-0 select-none"
                          >
                            <div className="h-24 bg-[#edf2fa] flex flex-col items-center justify-center relative p-3 border-b border-[#e0e3e7]">
                              <div className="p-2.5 bg-white rounded-lg shadow-2xs border border-[#e0e3e7] text-[#444746] group-hover:scale-105 transition-transform">
                                <IconComp size={22} />
                              </div>
                              <span
                                className={`absolute top-2 left-2 px-1.5 py-0.5 text-[9px] font-bold font-mono rounded border ${badgeColor}`}
                              >
                                {ext}
                              </span>
                            </div>
                            <div className="p-3 bg-white flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-[#1f1f1f] truncate" title={att.name}>
                                  {att.name}
                                </p>
                                <p className="text-[11px] text-[#5e5e5e] font-mono mt-0.5">
                                  {formatFileSize(
                                    att.size || (att.content ? Math.round(att.content.length * 0.75) : 0)
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div
                                  className="p-1.5 rounded-full hover:bg-zinc-100 text-[#444746] cursor-pointer"
                                  title="Download"
                                >
                                  <Download size={14} />
                                </div>
                                <div
                                  className="p-1.5 rounded-full hover:bg-zinc-100 text-[#444746] cursor-pointer"
                                  title="Save to Drive"
                                >
                                  <HardDrive size={14} />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bottom Action Bar */}
                <div className="mt-6 pt-4 pb-2 flex items-center gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#747775] text-[#1f1f1f] text-sm font-medium hover:bg-[#f2f6fc] hover:border-[#1f1f1f] transition-all cursor-pointer shadow-2xs"
                  >
                    <Reply size={16} className="text-[#444746]" />
                    <span>Reply</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[#747775] text-[#1f1f1f] text-sm font-medium hover:bg-[#f2f6fc] hover:border-[#1f1f1f] transition-all cursor-pointer shadow-2xs"
                  >
                    <Forward size={16} className="text-[#444746]" />
                    <span>Forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== IMPORT EMAIL SUB-MODAL ===================== */}
      {importModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                  <Mail size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Import Email</h3>
                  <p className="text-[11px] text-muted">Impor email dari berkas mentah RFC 822 / MIME / EML.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setImportError(null);
                }}
                className="text-muted hover:text-foreground p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                aria-label="Close import modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {importError && (
                <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0 text-red-600" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="raw-email-source" className="text-xs font-semibold text-foreground block">
                  Raw Email Source (MIME/EML):
                </label>
                <div className="border border-border rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="bg-zinc-50/80 px-4 py-2 border-b border-border flex items-center justify-between text-[11px] text-muted font-mono">
                    <span className="font-medium text-foreground">raw_email.eml</span>
                    <span>RFC 822 / MIME</span>
                  </div>
                  <textarea
                    id="raw-email-source"
                    rows={11}
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    placeholder="Paste raw RFC 822 / MIME email headers and body here..."
                    className="w-full p-3.5 font-mono text-xs bg-white text-foreground placeholder:text-muted focus:outline-none leading-relaxed resize-y"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-zinc-50/70 hover:bg-zinc-50 transition-colors cursor-pointer select-none">
                  <div>
                    <span className="text-xs font-semibold text-foreground block">Change Links to Point to Landing Page</span>
                    <span className="text-[11px] text-muted">
                      Mengonversi seluruh tautan <code className="font-mono text-[10px] bg-zinc-200/60 px-1 py-0.5 rounded">&lt;a href=&quot;...&quot;&gt;</code> menjadi <code className="font-mono text-[10px] bg-zinc-200/60 px-1 py-0.5 rounded">{"{{.URL}}"}</code>.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={convertLinks}
                    onChange={(e) => setConvertLinks(e.target.checked)}
                    className="w-4 h-4 cursor-pointer accent-black rounded shrink-0 ml-3"
                  />
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-zinc-50/90">
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setImportError(null);
                }}
                className="px-4 py-2 text-xs font-medium border border-border rounded-lg hover:bg-zinc-100 text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportEmail}
                disabled={importing}
                className="px-5 py-2 text-xs font-medium bg-black hover:bg-zinc-800 text-white rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {importing && <Loader2 size={13} className="animate-spin" />}
                <span>{importing ? "Importing..." : "Import"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CUSTOM DELETE CONFIRMATION DIALOG ===================== */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Hapus Email Template?</h3>
                <p className="text-xs text-muted">
                  Tindakan ini permanen dan tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl text-xs text-red-900 space-y-1">
              <p>
                Anda akan menghapus template: <b className="font-semibold">{deleteConfirm.name}</b>
              </p>
              <p className="text-[11px] text-red-700">
                This will delete the template. This can&apos;t be undone!
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-xs font-medium border border-border rounded-lg hover:bg-zinc-100 text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteTemplate}
                disabled={deleting}
                className="px-4 py-2 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                <span>{deleting ? "Deleting..." : "Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
