"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Globe,
  Mail,
  Send,
  Users,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Trash2,
  Flag,
  Search,
  MousePointerClick,
  Lock,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Info,
  X,
  Radio,
} from "lucide-react";

interface CampaignDetail {
  id: number;
  name: string;
  createdDate: string;
  launchDate: string | null;
  completedDate: string | null;
  status: string;
  url: string | null;
  template?: {
    id: number;
    name: string;
    subject: string | null;
    envelopeSender: string | null;
    text: string | null;
    html: string | null;
  };
  page?: {
    id: number;
    name: string;
    redirectUrl: string | null;
    captureCredentials: boolean;
    capturePasswords: boolean;
  };
  profile?: {
    id: number;
    name: string;
    fromAddress: string | null;
    host: string | null;
    interfaceType: string | null;
  };
  group?: {
    id: number;
    name: string;
    _count?: { targets: number };
  };
  results: Array<{
    id: number;
    rId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    position: string | null;
    status: string;
    sendDate: string | null;
    ip: string | null;
    reported: boolean;
    modifiedDate: string;
  }>;
  events: Array<{
    id: number;
    email: string | null;
    time: string;
    message: string | null;
    details: string | null;
  }>;
  stats: {
    total: number;
    scheduled: number;
    sent: number;
    opened: number;
    clicked: number;
    submitted: number;
    reported: number;
    error: number;
    sentRate: number;
    openRate: number;
    clickRate: number;
    submitRate: number;
    reportRate: number;
  };
}

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTarget, setSearchTarget] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedTarget, setSelectedTarget] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchCampaign = async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Campaign tidak ditemukan.");
        } else {
          setError("Gagal memuat campaign.");
        }
        return;
      }
      const data = await res.json();
      setCampaign(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Terjadi kesalahan jaringan saat memuat campaign.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (campaignId) {
      fetchCampaign();
    }
  }, [campaignId]);

  const handleCompleteCampaign = async () => {
    if (!campaign) return;
    if (!confirm(`Apakah Anda yakin ingin menyelesaikan campaign "${campaign.name}"?`)) return;

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      if (res.ok) {
        showToast("Campaign berhasil ditandai sebagai Selesai.");
        fetchCampaign();
      } else {
        showToast("Gagal menyelesaikan campaign.");
      }
    } catch {
      showToast("Terjadi kesalahan saat memperbarui campaign.");
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    if (!confirm(`Hapus campaign "${campaign.name}" beserta seluruh hasilnya secara permanen?`)) return;

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Campaign berhasil dihapus.");
        router.push("/campaigns");
      } else {
        showToast("Gagal menghapus campaign.");
      }
    } catch {
      showToast("Terjadi kesalahan saat menghapus campaign.");
    }
  };

  const handleExportCSV = (type: "results" | "events") => {
    if (!campaign) return;
    setIsExportOpen(false);

    if (type === "results") {
      const headers = ["Result ID", "First Name", "Last Name", "Email", "Position", "Status", "Reported", "Send Date", "IP"];
      const rows = campaign.results.map((r) => [
        `"${r.rId}"`,
        `"${r.firstName || ""}"`,
        `"${r.lastName || ""}"`,
        `"${r.email}"`,
        `"${r.position || ""}"`,
        `"${r.status}"`,
        r.reported ? "true" : "false",
        `"${r.sendDate ? new Date(r.sendDate).toISOString() : ""}"`,
        `"${r.ip || ""}"`,
      ]);
      const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campaign_${campaign.id}_results.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("CSV Hasil Target berhasil diekspor.");
    } else {
      const headers = ["Event ID", "Email", "Time", "Message", "Details"];
      const rows = campaign.events.map((e) => [
        `"${e.id}"`,
        `"${e.email || ""}"`,
        `"${new Date(e.time).toISOString()}"`,
        `"${e.message || ""}"`,
        `"${(e.details || "").replace(/"/g, '""')}"`,
      ]);
      const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `campaign_${campaign.id}_raw_events.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("CSV Log Aktivitas Mentah berhasil diekspor.");
    }
  };

  const filteredResults = useMemo(() => {
    if (!campaign?.results) return [];
    return campaign.results.filter((r) => {
      const matchesSearch =
        searchTarget === "" ||
        r.email.toLowerCase().includes(searchTarget.toLowerCase()) ||
        (r.firstName && r.firstName.toLowerCase().includes(searchTarget.toLowerCase())) ||
        (r.lastName && r.lastName.toLowerCase().includes(searchTarget.toLowerCase())) ||
        (r.position && r.position.toLowerCase().includes(searchTarget.toLowerCase())) ||
        r.rId.toLowerCase().includes(searchTarget.toLowerCase());

      const s = r.status.toLowerCase();
      let matchesStatus = true;
      if (statusFilter === "Scheduled") matchesStatus = s === "scheduled";
      else if (statusFilter === "Sent") matchesStatus = s.includes("sent");
      else if (statusFilter === "Opened") matchesStatus = s.includes("open");
      else if (statusFilter === "Clicked") matchesStatus = s.includes("click");
      else if (statusFilter === "Submitted") matchesStatus = s.includes("submit");
      else if (statusFilter === "Reported") matchesStatus = r.reported;
      else if (statusFilter === "Error") matchesStatus = s.includes("error") || s.includes("gagal");

      return matchesSearch && matchesStatus;
    });
  }, [campaign?.results, searchTarget, statusFilter]);

  const targetEvents = useMemo(() => {
    if (!selectedTarget || !campaign?.events) return [];
    return campaign.events.filter(
      (e) => e.email && e.email.toLowerCase() === selectedTarget.email.toLowerCase()
    );
  }, [selectedTarget, campaign?.events]);

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("complete")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Selesai
        </span>
      );
    }
    if (s.includes("progress") || s.includes("active")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Sedang Berjalan
        </span>
      );
    }
    if (s.includes("sched")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Terjadwal
        </span>
      );
    }
    if (s.includes("pause")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
          Dijeda
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200">
        {status}
      </span>
    );
  };

  const getTargetStatusBadge = (status: string, reported: boolean) => {
    const s = status.toLowerCase();
    if (reported) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck size={12} className="text-emerald-600" /> Dilaporkan
        </span>
      );
    }
    if (s.includes("submit")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
          <KeyRound size={12} className="text-red-500" /> Data Dikirim
        </span>
      );
    }
    if (s.includes("click")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <MousePointerClick size={12} className="text-amber-600" /> Tautan Diklik
        </span>
      );
    }
    if (s.includes("open")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Lock size={12} className="text-blue-600" /> Email Dibuka
        </span>
      );
    }
    if (s.includes("sent")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
          <Send size={12} className="text-zinc-500" /> Email Terkirim
        </span>
      );
    }
    if (s.includes("sched")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
          <Clock size={12} className="text-purple-600" /> Dijadwalkan
        </span>
      );
    }
    if (s.includes("error") || s.includes("gagal")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle size={12} className="text-rose-600" /> Gagal Terkirim (Error)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-50 text-gray-600 border border-gray-200">
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-border border-t-foreground animate-spin" />
        <p className="text-xs text-muted">Memuat telemetri campaign...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="space-y-4 max-w-[900px] mx-auto py-12 text-center">
        <AlertTriangle size={36} className="mx-auto text-red-500" />
        <h2 className="text-xl font-bold text-foreground">{error || "Campaign tidak ditemukan"}</h2>
        <p className="text-xs text-body">ID campaign yang diminta tidak dapat ditemukan di database.</p>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-white rounded-md text-xs font-medium hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={14} /> Kembali ke Campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1440px] pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-foreground text-white px-4 py-3 rounded-lg shadow-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 border border-white/10 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===================== TOP HEADER & ACTIONS ===================== */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Link
              href="/campaigns"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground transition-colors p-1 -ml-1 rounded hover:bg-gray-100"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Campaigns</span>
            </Link>
            <span className="text-muted">/</span>
            <span className="text-xs text-muted font-mono">Campaign #{campaign.id}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {campaign.name}
            </h1>
            {getStatusBadge(campaign.status)}
          </div>
          <p className="text-xs text-body">
            Telemetri simulasi real-time, funnel konversi korban, dan riwayat audit target.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchCampaign(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border text-xs font-medium text-foreground rounded-md shadow-xs hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
            title="Segarkan data campaign"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-muted" : "text-muted"} />
            <span>{refreshing ? "Menyegarkan..." : "Segarkan"}</span>
          </button>

          {/* Export CSV Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border text-xs font-medium text-foreground rounded-md shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Download size={13} className="text-muted" />
              <span>Ekspor CSV</span>
            </button>
            {isExportOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-card border border-border rounded-lg shadow-xl z-30 py-1 text-xs animate-in fade-in">
                <button
                  type="button"
                  onClick={() => handleExportCSV("results")}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-50 text-foreground font-medium flex items-center justify-between cursor-pointer"
                >
                  <span>CSV Hasil Target</span>
                  <ChevronRight size={12} className="text-muted" />
                </button>
                <button
                  type="button"
                  onClick={() => handleExportCSV("events")}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-50 text-foreground font-medium flex items-center justify-between cursor-pointer"
                >
                  <span>CSV Log Aktivitas Mentah</span>
                  <ChevronRight size={12} className="text-muted" />
                </button>
              </div>
            )}
          </div>

          {/* Complete Campaign Button */}
          {campaign.status !== "Completed" && (
            <button
              type="button"
              onClick={handleCompleteCampaign}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-md shadow-xs hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              <Flag size={13} />
              <span>Tandai Selesai</span>
            </button>
          )}

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDeleteCampaign}
            className="flex items-center gap-1.5 px-3 py-2 bg-card border border-red-200 text-red-600 text-xs font-medium rounded-md shadow-xs hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Hapus</span>
          </button>
        </div>
      </div>

      {/* ===================== CAMPAIGN CONFIGURATION OVERVIEW ===================== */}
      <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">
          Konfigurasi Simulasi
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-muted font-medium flex items-center gap-1.5">
              <Mail size={13} className="text-zinc-500" /> Email Template
            </span>
            <p className="font-semibold text-foreground truncate">
              {campaign.template?.name || "Tidak ada"}
            </p>
            {campaign.template?.subject && (
              <p className="text-[11px] text-body truncate">
                Subjek: {campaign.template.subject}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-muted font-medium flex items-center gap-1.5">
              <Globe size={13} className="text-zinc-500" /> Landing Page
            </span>
            <p className="font-semibold text-foreground truncate">
              {campaign.page?.name || "Tidak ada"}
            </p>
            {campaign.page?.redirectUrl && (
              <p className="text-[11px] text-body truncate">
                Pengalihan: {campaign.page.redirectUrl}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-muted font-medium flex items-center gap-1.5">
              <Send size={13} className="text-zinc-500" /> Sending Profile
            </span>
            <p className="font-semibold text-foreground truncate">
              {campaign.profile?.name || "Tidak ada"}
            </p>
            {campaign.profile?.fromAddress && (
              <p className="text-[11px] text-body truncate">
                Dari: {campaign.profile.fromAddress}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-muted font-medium flex items-center gap-1.5">
              <Users size={13} className="text-zinc-500" /> Target Audiens
            </span>
            <p className="font-semibold text-foreground truncate">
              {campaign.group?.name || "Tidak ada"} ({campaign.results.length} target)
            </p>
            {campaign.url && (
              <p className="text-[11px] text-body truncate flex items-center gap-1">
                URL: <span className="font-mono text-zinc-600">{campaign.url}</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar size={13} />
              Dibuat: <strong className="text-foreground">{new Date(campaign.createdDate).toLocaleString("id-ID")}</strong>
            </span>
            {campaign.launchDate && (
              <span className="flex items-center gap-1.5">
                <Clock size={13} />
                Diluncurkan: <strong className="text-foreground">{new Date(campaign.launchDate).toLocaleString("id-ID")}</strong>
              </span>
            )}
            {campaign.completedDate && (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 size={13} />
                Selesai: <strong>{new Date(campaign.completedDate).toLocaleString("id-ID")}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ===================== TELEMETRY FUNNEL CARDS ===================== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            Telemetri & Funnel Konversi
          </h2>
          {(campaign.stats?.error || 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              <AlertTriangle size={12} className="text-rose-600" />
              {campaign.stats.error} Target Gagal Terkirim
            </span>
          )}
        </div>

        {(campaign.stats?.error || 0) > 0 && (
          <div className="mb-3.5 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs text-rose-800">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <span>
                <strong>Perhatian:</strong> Terdapat <strong>{campaign.stats.error}</strong> target dengan status <strong>Gagal Terkirim (Error)</strong>. Periksa linimasa aktivitas atau klik filter untuk meninjau rincian error SMTP.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter("Error")}
              className="px-2.5 py-1 text-[11px] font-medium bg-rose-100 hover:bg-rose-200 text-rose-900 rounded border border-rose-300 transition-colors cursor-pointer shrink-0 ml-3"
            >
              Filter Target Gagal
            </button>
          </div>
        )}

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${(campaign.stats?.error || 0) > 0 ? "lg:grid-cols-3 xl:grid-cols-6" : "lg:grid-cols-5"} gap-3.5`}>
          {/* Card 1: Emails Sent */}
          <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Email Terkirim</span>
              <div className="w-6 h-6 rounded-md bg-zinc-100 text-zinc-700 flex items-center justify-center">
                <Send size={12} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {campaign.stats.sent}
                </span>
                <span className="text-xs text-muted">/ {campaign.stats.total}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-zinc-700 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${campaign.stats.sentRate}%` }}
                />
              </div>
              <span className="text-[10px] text-muted mt-1 block">
                {campaign.stats.sentRate}% terkirim
              </span>
            </div>
          </div>

          {/* Card 2: Email Opened */}
          <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Dibuka</span>
              <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                <Lock size={12} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {campaign.stats.opened}
                </span>
                <span className="text-xs font-semibold text-blue-600">
                  {campaign.stats.openRate}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${campaign.stats.openRate}%` }}
                />
              </div>
              <span className="text-[10px] text-muted mt-1 block">
                Pemicu pixel pelacak
              </span>
            </div>
          </div>

          {/* Card 3: Clicked Link */}
          <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Tautan Diklik</span>
              <div className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                <MousePointerClick size={12} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {campaign.stats.clicked}
                </span>
                <span className="text-xs font-semibold text-amber-600">
                  {campaign.stats.clickRate}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${campaign.stats.clickRate}%` }}
                />
              </div>
              <span className="text-[10px] text-muted mt-1 block">
                URL phishing dikunjungi
              </span>
            </div>
          </div>

          {/* Card 4: Submitted Data */}
          <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Data Dikirim</span>
              <div className="w-6 h-6 rounded-md bg-red-50 text-red-600 flex items-center justify-center">
                <KeyRound size={12} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {campaign.stats.submitted}
                </span>
                <span className="text-xs font-semibold text-red-600">
                  {campaign.stats.submitRate}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${campaign.stats.submitRate}%` }}
                />
              </div>
              <span className="text-[10px] text-muted mt-1 block">
                Kredensial dikirimkan
              </span>
            </div>
          </div>

          {/* Card 5: Reported Email */}
          <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Dilaporkan</span>
              <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck size={12} />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {campaign.stats.reported}
                </span>
                <span className="text-xs font-semibold text-emerald-600">
                  {campaign.stats.reportRate}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${campaign.stats.reportRate}%` }}
                />
              </div>
              <span className="text-[10px] text-muted mt-1 block">
                Dilaporkan oleh target
              </span>
            </div>
          </div>

          {/* Card 6: Delivery Errors (if any) */}
          {(campaign.stats?.error || 0) > 0 && (
            <div className="bg-rose-50/60 rounded-lg border border-rose-200 p-4 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-rose-700 font-medium">Gagal Terkirim</span>
                <div className="w-6 h-6 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center">
                  <AlertTriangle size={12} />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-rose-700">
                    {campaign.stats.error}
                  </span>
                  <span className="text-xs text-rose-600">/ {campaign.stats.total}</span>
                </div>
                <div className="w-full bg-rose-200/60 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-rose-500 h-1.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((campaign.stats.error / (campaign.stats.total || 1)) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-rose-600 mt-1 block">
                  {Math.round((campaign.stats.error / (campaign.stats.total || 1)) * 100)}% SMTP gagal
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================== TARGET RESULTS TABLE ===================== */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-foreground">
              Hasil Target ({filteredResults.length} / {campaign.results.length})
            </h2>
            <p className="text-xs text-muted">
              Progres masing-masing korban dan log aksi kesadaran keamanan.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-[34px] px-2.5 text-xs bg-input-bg border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="All">Filter: Semua Status</option>
              <option value="Scheduled">Dijadwalkan</option>
              <option value="Sent">Email Terkirim</option>
              <option value="Opened">Email Dibuka</option>
              <option value="Clicked">Tautan Diklik</option>
              <option value="Submitted">Data Dikirim</option>
              <option value="Reported">Dilaporkan</option>
              <option value="Error">Gagal Terkirim (Error)</option>
            </select>

            {/* Search Box */}
            <div className="relative w-full sm:w-56">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                type="text"
                placeholder="Cari email/nama target..."
                value={searchTarget}
                onChange={(e) => setSearchTarget(e.target.value)}
                className="w-full h-[34px] pl-8 pr-3 rounded-md bg-input-bg border border-border text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Nama Target
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Email
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Posisi / Dept
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Tanggal Kirim
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs text-empty">
                    Tidak ada target yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-xs font-semibold text-foreground whitespace-nowrap">
                      {r.firstName || r.lastName
                        ? `${r.firstName || ""} ${r.lastName || ""}`.trim()
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-body font-mono whitespace-nowrap">
                      {r.email}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-body whitespace-nowrap">
                      {r.position || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                      {getTargetStatusBadge(r.status, r.reported)}
                    </td>
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                      {r.status.toLowerCase().includes("error") || r.status.toLowerCase().includes("gagal") ? (
                        r.sendDate ? (
                          <span className="text-rose-600 font-medium">
                            {new Date(r.sendDate).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (Gagal)
                          </span>
                        ) : (
                          <span className="text-rose-600 font-medium">Gagal</span>
                        )
                      ) : r.sendDate ? (
                        <span className="text-muted">
                          {new Date(r.sendDate).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-muted">Menunggu</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedTarget(r)}
                        className="px-2.5 py-1 text-[11px] font-medium border border-border rounded hover:bg-gray-100 text-foreground transition-colors cursor-pointer"
                      >
                        Linimasa
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================== SIMULATION ACTIVITY LOG (TIMELINE) ===================== */}
      <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Linimasa Aktivitas ({campaign.events.length} aktivitas tercatat)
        </h2>
        <p className="text-xs text-muted mb-4">
          Aliran aktivitas simulasi kronologis yang ditangkap oleh listener campaign.
        </p>

        {campaign.events.length === 0 ? (
          <div className="py-8 text-center text-xs text-empty">
            Belum ada aktivitas yang tercatat untuk campaign ini.
          </div>
        ) : (
          <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
            {campaign.events.map((ev) => {
              const msg = (ev.message || "").toLowerCase();
              let icon = <Info size={12} className="text-zinc-600" />;
              let dotColor = "bg-zinc-500";
              const isError = msg.includes("error") || msg.includes("gagal");

              if (isError) {
                icon = <AlertTriangle size={12} className="text-rose-600" />;
                dotColor = "bg-rose-500";
              } else if (msg.includes("create")) {
                icon = <Radio size={12} className="text-blue-600" />;
                dotColor = "bg-blue-500";
              } else if (msg.includes("sent")) {
                icon = <Send size={12} className="text-zinc-700" />;
                dotColor = "bg-zinc-600";
              } else if (msg.includes("open")) {
                icon = <Lock size={12} className="text-blue-600" />;
                dotColor = "bg-blue-500";
              } else if (msg.includes("click")) {
                icon = <MousePointerClick size={12} className="text-amber-600" />;
                dotColor = "bg-amber-500";
              } else if (msg.includes("submit")) {
                icon = <KeyRound size={12} className="text-red-600" />;
                dotColor = "bg-red-500";
              } else if (msg.includes("complete")) {
                icon = <CheckCircle2 size={12} className="text-emerald-600" />;
                dotColor = "bg-emerald-500";
              }

              return (
                <div key={ev.id} className="relative flex items-start gap-3 text-xs">
                  <span
                    className={`absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${dotColor}`}
                  />
                  <div
                    className={`flex-1 rounded-md p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 border ${
                      isError
                        ? "border-rose-200 bg-rose-50/50"
                        : "bg-gray-50/70 border-border/70"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {icon}
                        <span className={`font-semibold ${isError ? "text-rose-900" : "text-foreground"} mr-2`}>
                          {ev.message}
                        </span>
                        {ev.email && (
                          <span className="text-body font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-border mr-2">
                            {ev.email}
                          </span>
                        )}
                      </div>
                      {ev.details && (
                        isError ? (
                          <div className="p-2 rounded bg-rose-100/70 text-rose-900 border border-rose-200 font-mono text-[11px] break-all">
                            {ev.details}
                          </div>
                        ) : (
                          <span className="text-muted text-[11px] block">
                            {ev.details}
                          </span>
                        )
                      )}
                    </div>
                    <span className="text-[11px] text-muted font-mono shrink-0">
                      {new Date(ev.time).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== TARGET DETAIL MODAL ===================== */}
      {selectedTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-[550px] max-h-[85vh] overflow-y-auto p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Detail Target: {selectedTarget.email}
                </h3>
                <p className="text-xs text-muted">
                  Token Pelacakan (rId): <strong className="font-mono text-foreground">{selectedTarget.rId}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTarget(null)}
                className="p-1 rounded text-muted hover:text-foreground hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Alert Banner if Target Failed */}
            {((selectedTarget.status || "").toLowerCase().includes("error") ||
              (selectedTarget.status || "").toLowerCase().includes("gagal") ||
              targetEvents.some((e) => (e.message || "").toLowerCase().includes("error") || (e.message || "").toLowerCase().includes("gagal"))) && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
                <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <span className="font-semibold block text-rose-900">Pengiriman Email Gagal (SMTP Delivery Error)</span>
                  <p className="text-[11px] text-rose-700">
                    Transporter SMTP mengalami kendala saat mengirimkan email phishing ke target ini:
                  </p>
                  <div className="p-2 rounded bg-rose-100/70 text-rose-900 border border-rose-200 font-mono text-[11px] break-all mt-1">
                    {targetEvents.find((e) => (e.message || "").toLowerCase().includes("error") || (e.message || "").toLowerCase().includes("gagal"))?.details ||
                      "Koneksi SMTP ditolak, autentikasi gagal, atau alamat penerima ditolak oleh mail server."}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-gray-50 rounded border border-border">
                <span className="text-muted block text-[10px] uppercase font-bold">Nama</span>
                <span className="font-medium text-foreground">
                  {selectedTarget.firstName || selectedTarget.lastName
                    ? `${selectedTarget.firstName || ""} ${selectedTarget.lastName || ""}`.trim()
                    : "Tidak ditentukan"}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded border border-border">
                <span className="text-muted block text-[10px] uppercase font-bold">Posisi</span>
                <span className="font-medium text-foreground">
                  {selectedTarget.position || "Tidak ditentukan"}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded border border-border">
                <span className="text-muted block text-[10px] uppercase font-bold">Status Saat Ini</span>
                <div className="mt-1">
                  {getTargetStatusBadge(selectedTarget.status, selectedTarget.reported)}
                </div>
              </div>
              <div className="p-2.5 bg-gray-50 rounded border border-border">
                <span className="text-muted block text-[10px] uppercase font-bold">Melaporkan Phishing</span>
                <span className="font-medium text-foreground">
                  {selectedTarget.reported ? "Ya" : "Tidak"}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Aktivitas Linimasa Target Ini
              </h4>
              {targetEvents.length === 0 ? (
                <p className="text-xs text-empty py-4 text-center">
                  Tidak ada catatan aktivitas individual yang ditemukan untuk penerima ini.
                </p>
              ) : (
                <div className="space-y-2">
                  {targetEvents.map((e) => {
                    const isEvError = (e.message || "").toLowerCase().includes("error") || (e.message || "").toLowerCase().includes("gagal");
                    return (
                      <div
                        key={e.id}
                        className={`p-2.5 rounded text-xs flex items-start justify-between gap-2 border ${
                          isEvError
                            ? "bg-rose-50/60 border-rose-200"
                            : "bg-gray-50 border-border"
                        }`}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5">
                            {isEvError && <AlertTriangle size={12} className="text-rose-600 shrink-0" />}
                            <span className={`font-medium block ${isEvError ? "text-rose-900 font-semibold" : "text-foreground"}`}>
                              {e.message}
                            </span>
                          </div>
                          {e.details && (
                            isEvError ? (
                              <div className="p-1.5 rounded bg-rose-100/80 text-rose-900 border border-rose-200 font-mono text-[11px] break-all">
                                {e.details}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted block">
                                {e.details}
                              </span>
                            )
                          )}
                        </div>
                        <span className="text-[10px] text-muted font-mono shrink-0">
                          {new Date(e.time).toLocaleTimeString("id-ID")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTarget(null)}
                className="px-4 py-1.5 text-xs font-medium border border-border rounded hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
