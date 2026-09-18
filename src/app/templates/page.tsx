"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Eye,
  Globe,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  Plus,
  X,
} from "lucide-react";

interface LandingPage {
  id: number;
  name: string;
  html: string | null;
  captureCredentials: boolean;
  capturePasswords: boolean;
  redirectUrl: string | null;
  modifiedDate: string;
}

function CardThumbnail({ page, onPreview }: { page: LandingPage; onPreview: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.28);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateScale = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        if (width > 0) {
          setScale(width / 1000);
        }
      }
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={onPreview}
      className="h-[150px] w-full bg-[#ECECF0] relative overflow-hidden flex items-center justify-center cursor-pointer group select-none border-b border-border"
      title="Klik untuk melihat preview"
    >
      {page.html ? (
        <>
          <div
            className="absolute top-0 left-0 origin-top-left pointer-events-none select-none bg-white"
            style={{
              width: "1000px",
              height: "600px",
              transform: `scale(${scale})`,
            }}
          >
            <iframe
              title={page.name}
              srcDoc={page.html}
              className="w-full h-full border-0 pointer-events-none select-none"
              tabIndex={-1}
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100 backdrop-blur-[1px]">
            <span className="px-3 py-1.5 rounded-full bg-black/80 text-white text-xs font-medium flex items-center gap-1.5 shadow-lg">
              <Eye size={13} />
              Preview Website
            </span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1.5 text-muted/60">
          <ImageIcon size={32} strokeWidth={1.2} />
          <span className="text-[11px]">No preview</span>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [html, setHtml] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [captureSubmitted, setCaptureSubmitted] = useState(false);
  const [capturePasswords, setCapturePasswords] = useState(false);
  const [activeTab, setActiveTab] = useState<"html" | "preview">("html");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Import Sub-modal states (GoPhish style)
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState<LandingPage | null>(null);

  const fetchPages = async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/landing-pages");
      if (res.status === 401) throw new Error("Silakan login untuk melihat landing page.");
      if (!res.ok) throw new Error("Gagal memuat landing page.");
      setPages(await res.json());
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Gagal memuat landing page.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPages();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const resetModal = () => {
    setEditingId(null);
    setName("");
    setHtml("");
    setRedirectUrl("");
    setCaptureSubmitted(false);
    setCapturePasswords(false);
    setActiveTab("html");
    setFormError(null);
    setImportOpen(false);
    setImportUrl("");
    setImportError(null);
  };

  const openNew = () => {
    resetModal();
    setModalOpen(true);
  };

  const handleImport = async () => {
    const target = importUrl.trim();
    if (!target) {
      setImportError("Masukkan URL website yang ingin di-clone.");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/landing-pages/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Gagal meng-clone website.");
      setHtml(data.html);
      if (data.redirectUrl) {
        setRedirectUrl(data.redirectUrl);
      }
      if (!name.trim()) {
        try {
          const u = new URL(target);
          const domain = u.hostname.replace(/^www\./, "");
          const title = domain.split(".")[0];
          setName(`${title.charAt(0).toUpperCase() + title.slice(1)} Login`);
        } catch {
          // ignore
        }
      }
      setImportOpen(false);
      setImportUrl("");
      setActiveTab("html");
      setToast("Website berhasil di-clone persis seperti aslinya!");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Gagal meng-clone website.");
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setFormError("Page name is required.");
      return;
    }
    if (!html.trim()) {
      setFormError("HTML content is required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: name.trim(),
        html: html.trim(),
        redirectUrl: redirectUrl.trim() || null,
        captureCredentials: captureSubmitted,
        capturePasswords: captureSubmitted && capturePasswords,
      };
      const res =
        editingId === null
          ? await fetch("/api/landing-pages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/landing-pages/${editingId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Gagal menyimpan halaman.");
      setModalOpen(false);
      resetModal();
      await fetchPages();
      setToast("Landing page tersimpan.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan halaman.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (page: LandingPage) => {
    if (!confirm(`Hapus "${page.name}"?`)) return;
    try {
      const res = await fetch(`/api/landing-pages/${page.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus halaman.");
      await fetchPages();
      setToast("Landing page dihapus.");
    } catch {
      setToast("Gagal menghapus halaman.");
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl lg:text-[36px] font-bold leading-tight sm:leading-[44px] tracking-tight text-foreground">
            Landing Page
          </h1>
          <p className="text-xs sm:text-sm text-body">
            Manage simulation recipients and organizational segments.
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-xs font-medium rounded-md shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition-all cursor-pointer w-full sm:w-auto bg-btn-primary text-btn-primary-text hover:bg-gray-800 active:scale-95"
        >
          <Plus size={12} strokeWidth={2.5} />
          <span>New Page</span>
        </button>
      </div>

      {/* ===================== GOPHISH STYLE MODAL: NEW / EDIT LANDING PAGE ===================== */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-xl text-foreground shadow-2xl w-full max-w-[760px] max-h-[92vh] overflow-y-auto flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-card sticky top-0 z-10">
              <h2 className="text-xl font-bold text-foreground">
                {editingId === null ? "New Landing Page" : "Edit Landing Page"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
                className="text-muted hover:text-foreground transition-colors p-1"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {formError && (
                <div className="px-3.5 py-2.5 text-xs text-white bg-red-500 rounded-md font-medium">
                  {formError}
                </div>
              )}

              {/* Name field */}
              <div className="space-y-1.5">
                <label htmlFor="lp-name" className="text-sm font-semibold text-foreground">
                  Name:
                </label>
                <input
                  id="lp-name"
                  type="text"
                  placeholder="Page name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-sm"
                />
              </div>

              {/* Import Site Trigger Button */}
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setImportOpen(true);
                    setImportError(null);
                  }}
                  className="flex items-center gap-2 bg-[#d9534f] hover:bg-[#c9302c] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm"
                >
                  <Globe size={16} />
                  <span>Import Site</span>
                </button>
              </div>

              {/* Tabs: HTML (Code) & Preview */}
              <div className="border border-border rounded-md overflow-hidden bg-card">
                <div className="flex items-center justify-between border-b border-border bg-gray-50/70">
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() => setActiveTab("html")}
                      className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-r border-border ${
                        activeTab === "html"
                          ? "bg-card text-foreground border-b-2 border-b-teal-500"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      HTML
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("preview")}
                      className={`px-5 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors border-r border-border ${
                        activeTab === "preview"
                          ? "bg-card text-foreground border-b-2 border-b-teal-500"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                  {activeTab === "html" && (
                    <span className="text-[11px] text-muted px-4 font-mono">
                      {html ? `${(html.length / 1024).toFixed(1)} KB` : "0 KB"}
                    </span>
                  )}
                </div>

                {activeTab === "html" ? (
                  <textarea
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    placeholder="Masukkan HTML di sini, atau klik 'Import Site' di atas untuk meng-clone website otomatis..."
                    className="w-full min-h-[300px] max-h-[460px] p-4 font-mono text-xs bg-card focus:outline-none focus:ring-1 focus:ring-teal-500/40 resize-y leading-relaxed"
                  />
                ) : (
                  <div className="w-full h-[360px] bg-white relative overflow-hidden">
                    <iframe
                      title="Live Preview"
                      srcDoc={
                        html ||
                        "<div style='display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-family:sans-serif;'>Belum ada HTML untuk di-preview. Silakan masukkan HTML atau klik 'Import Site'.</div>"
                      }
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin allow-scripts allow-forms"
                    />
                  </div>
                )}
              </div>

              {/* Capture Checkboxes */}
              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={captureSubmitted}
                    onChange={(e) => {
                      setCaptureSubmitted(e.target.checked);
                      if (!e.target.checked) setCapturePasswords(false);
                    }}
                    className="w-4 h-4 cursor-pointer accent-teal-600 rounded"
                  />
                  <span>Capture Submitted Data</span>
                  <HelpCircle
                    size={14}
                    className="text-muted"
                    title="If the landing page contains a form, submitted input will be captured."
                  />
                </label>

                {captureSubmitted && (
                  <div className="pl-6 space-y-2 animate-in fade-in duration-150">
                    <label className="flex items-center gap-2 text-sm font-medium select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={capturePasswords}
                        onChange={(e) => setCapturePasswords(e.target.checked)}
                        className="w-4 h-4 cursor-pointer accent-teal-600 rounded"
                      />
                      <span>Capture Passwords</span>
                    </label>
                    <div className="p-2.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md">
                      ⚠️ <b>Perhatian:</b> Data kredensial disimpan untuk keperluan evaluasi simulasi keamanan.
                    </div>
                  </div>
                )}
              </div>

              {/* Redirect URL input (GoPhish standard) */}
              <div className="space-y-1.5 pt-1">
                <label htmlFor="lp-redirect" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <span>Redirect to:</span>
                  <HelpCircle
                    size={14}
                    className="text-muted"
                    title="Opsi ini mengalihkan user ke website asli setelah submit data"
                  />
                </label>
                <input
                  id="lp-redirect"
                  type="url"
                  placeholder="https://example.com"
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  className="w-full px-3.5 py-2 border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-sm"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-gray-50/50">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-md bg-[#1ABB9C] hover:bg-[#16a085] text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 shadow-sm"
              >
                {saving ? "Saving..." : "Save Page"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== GOPHISH STYLE: IMPORT SITE SUB-MODAL ===================== */}
      {importOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border rounded-xl text-foreground shadow-2xl w-full max-w-[500px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-border bg-card">
              <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
                <Globe size={18} className="text-[#d9534f]" />
                <span>Import Site</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  setImportError(null);
                }}
                className="text-muted hover:text-foreground transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  URL:
                </label>
                <input
                  type="url"
                  autoFocus
                  placeholder="https://shopee.co.id/buyer/login"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleImport();
                    }
                  }}
                  className="w-full px-3.5 py-2.5 border border-border rounded-md bg-card focus:outline-none focus:ring-2 focus:ring-teal-500/40 text-sm font-mono"
                />
              </div>

              <p className="text-xs text-muted leading-relaxed">
                Masukkan link website apapun (termasuk SPA modern seperti Shopee, BCA, dll). Sistem akan merender DOM dan menginjeksi base URL secara otomatis agar tampilannya persis.
              </p>

              {importError && (
                <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {importError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-border bg-gray-50/50">
              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  setImportError(null);
                }}
                disabled={importing}
                className="px-4 py-2 text-xs font-medium border border-border rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || !importUrl.trim()}
                className="px-5 py-2 text-xs font-medium bg-btn-primary text-btn-primary-text rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
              >
                {importing && <Loader2 size={14} className="animate-spin" />}
                <span>{importing ? "Meng-clone..." : "Import"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== LISTINGS / TEMPLATE LIBRARY ===================== */}
      {isLoading && (
        <div className="flex items-center justify-center min-h-[350px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted" />
        </div>
      )}

      {listError && (
        <div className="flex flex-col items-center justify-center min-h-[250px] gap-3">
          <p className="text-sm text-red-500">{listError}</p>
          <button
            type="button"
            onClick={fetchPages}
            className="px-4 py-2 text-xs font-medium border border-border rounded-md hover:bg-gray-50 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !listError && pages.length === 0 && (
        <div className="flex items-center justify-center min-h-[350px]">
          <p className="text-sm sm:text-base text-empty select-none">Halaman masih kosong</p>
        </div>
      )}

      {!isLoading && !listError && pages.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-semibold text-foreground">
                Template Library
              </h2>
              <span className="text-[11px] sm:text-xs bg-gray-100 text-muted px-2 py-0.5 rounded-full font-medium">
                {pages.length} templates
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {pages.map((page) => (
              <div
                key={page.id}
                className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                <CardThumbnail page={page} onPreview={() => setPreviewPage(page)} />
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground leading-snug">
                      {page.name}
                    </h3>
                    <p className="text-xs text-body/80 mt-0.5">
                      {new Date(page.modifiedDate).toLocaleDateString()}
                    </p>
                    {page.redirectUrl && (
                      <p className="text-[11px] text-muted truncate mt-0.5 font-mono" title={page.redirectUrl}>
                        {page.redirectUrl}
                      </p>
                    )}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {page.captureCredentials && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                          Submitted Data
                        </span>
                      )}
                      {page.capturePasswords && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          Passwords
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewPage(page)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-btn-primary text-btn-primary-text rounded hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(page)}
                      className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== PREVIEW MODAL ===================== */}
      {previewPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] overflow-hidden flex flex-col border border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
                  <Eye size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-foreground">
                      {previewPage.name}
                    </h2>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-muted">
                      Preview
                    </span>
                  </div>
                  <p className="text-xs text-muted truncate max-w-xs sm:max-w-md">
                    {previewPage.redirectUrl || "Simulated Landing Page"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([previewPage.html || ""], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-gray-100 transition-colors text-body cursor-pointer"
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">Buka Tab Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPage(null)}
                  className="p-1.5 text-gray-400 hover:text-foreground rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                  aria-label="Close preview"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Browser preview frame */}
            <div className="flex-1 bg-gray-100 relative overflow-hidden flex flex-col">
              <div className="bg-gray-200/80 px-4 py-1.5 flex items-center gap-2 border-b border-gray-300 text-xs text-muted">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 max-w-sm mx-auto bg-white/90 rounded px-3 py-0.5 text-[11px] text-gray-600 truncate text-center border border-gray-300/60 font-mono">
                  {previewPage.redirectUrl || `https://${previewPage.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`}
                </div>
              </div>
              <iframe
                title={previewPage.name}
                srcDoc={
                  previewPage.html
                    ? previewPage.html
                    : "<div style='display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#888;'>Tidak ada konten HTML pada template ini.</div>"
                }
                className="w-full flex-1 border-0 bg-white"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 text-sm text-white bg-black/85 rounded-md shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toast}
        </div>
      )}
    </div>
  );
}
