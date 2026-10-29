"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  Send,
  Lock,
  MousePointerClick,
  KeyRound,
  X,
  Radio,
  Trash2,
  Play,
  Pause,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Eye,
  Flag,
  Globe,
  Mail,
  Users,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

interface CampaignItem {
  id: number;
  name: string;
  createdDate: string;
  launchDate: string | null;
  completedDate: string | null;
  status: string;
  url: string | null;
  template?: { id: number; name: string; subject: string | null };
  page?: { id: number; name: string };
  profile?: { id: number; name: string; fromAddress: string | null };
  group?: { id: number; name: string; _count?: { targets: number } };
  results?: any[];
  stats?: {
    total: number;
    sent: number;
    opened: number;
    clicked: number;
    submitted: number;
    reported: number;
    openRate: number;
    clickRate: number;
    submitRate: number;
  };
}

interface DependencyItem {
  id: number;
  name: string;
  subject?: string | null;
  fromAddress?: string | null;
  from_address?: string | null;
  _count?: { targets: number };
}

interface NetworkPreset {
  id: string;
  label: string;
  url: string;
  description: string;
  isRecommended: boolean;
}

interface NetworkInfo {
  lanIp: string;
  listenerPort: number;
  isListenerActive: boolean;
  presets: NetworkPreset[];
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic Dependencies for Form
  const [templates, setTemplates] = useState<DependencyItem[]>([]);
  const [landingPages, setLandingPages] = useState<DependencyItem[]>([]);
  const [sendingProfiles, setSendingProfiles] = useState<DependencyItem[]>([]);
  const [targetGroups, setTargetGroups] = useState<DependencyItem[]>([]);
  const [dependenciesLoaded, setDependenciesLoaded] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    templateId: "",
    pageId: "",
    smtpId: "",
    groupId: "",
    url: "http://127.0.0.1:8080",
    dispatchTiming: "immediate" as "immediate" | "scheduled",
    launchDate: "",
    sendByDate: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [networkMode, setNetworkMode] = useState<"same_wifi" | "different_wifi">("same_wifi");
  const [tunnelInfo, setTunnelInfo] = useState<{ active: boolean; url: string | null } | null>(null);
  const [checkingTunnel, setCheckingTunnel] = useState(false);

  const checkTunnelStatus = async () => {
    setCheckingTunnel(true);
    try {
      const res = await fetch("/api/system/tunnel");
      if (res.ok) {
        const data = await res.json();
        setTunnelInfo(data);
        if (data.active && data.url) {
          return data.url;
        }
      }
    } catch (e) {
      console.error("Failed to check tunnel", e);
    } finally {
      setCheckingTunnel(false);
    }
    return null;
  };

  // Template Preview Sub-modal State
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch real campaigns from API
  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (err) {
      console.error("Failed to fetch campaigns", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch dependencies for New Campaign form
  const fetchDependencies = async () => {
    try {
      const [tmplRes, pageRes, smtpRes, grpRes, netRes] = await Promise.all([
        fetch("/api/email-templates"),
        fetch("/api/landing-pages"),
        fetch("/api/sending-profiles"),
        fetch("/api/groups"),
        fetch("/api/system/network"),
      ]);

      if (tmplRes.ok) {
        const tmpls = await tmplRes.json();
        setTemplates(tmpls);
      }
      if (pageRes.ok) {
        const pgs = await pageRes.json();
        setLandingPages(pgs);
      } else {
        // Fallback to /api/pages if /api/landing-pages has issues
        const altPageRes = await fetch("/api/pages");
        if (altPageRes.ok) setLandingPages(await altPageRes.json());
      }
      if (smtpRes.ok) {
        const smtps = await smtpRes.json();
        setSendingProfiles(smtps);
      }
      if (grpRes.ok) {
        const grps = await grpRes.json();
        setTargetGroups(grps);
      }
      if (netRes.ok) {
        const netData: NetworkInfo = await netRes.json();
        setNetworkInfo(netData);
      }
      setDependenciesLoaded(true);
    } catch (e) {
      console.error("Failed to load campaign dependencies", e);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleOpenModal = async () => {
    if (!dependenciesLoaded) {
      await fetchDependencies();
    }

    let defaultUrl = "http://127.0.0.1:8080";
    try {
      const netRes = await fetch("/api/system/network");
      if (netRes.ok) {
        const netData: NetworkInfo = await netRes.json();
        setNetworkInfo(netData);
        const rec = netData.presets.find((p) => p.isRecommended);
        if (rec) defaultUrl = rec.url;
      }
    } catch {}

    // Check tunnel status upon opening modal
    checkTunnelStatus();

    // Set default values if dependencies exist
    setFormData((prev) => ({
      ...prev,
      templateId: templates[0]?.id ? String(templates[0].id) : prev.templateId,
      pageId: landingPages[0]?.id ? String(landingPages[0].id) : prev.pageId,
      smtpId: sendingProfiles[0]?.id ? String(sendingProfiles[0].id) : prev.smtpId,
      groupId: targetGroups[0]?.id ? String(targetGroups[0].id) : prev.groupId,
      url: prev.url && prev.url !== "http://localhost:3000" && prev.url !== "http://127.0.0.1:8080" ? prev.url : defaultUrl,
    }));
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Template Preview Modal
  const handleOpenTemplatePreview = async (templateId: string) => {
    if (!templateId) return;
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/email-templates/${templateId}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewTemplate(data);
      } else {
        showToast("Gagal memuat pratinjau template.");
      }
    } catch {
      showToast("Terjadi kesalahan saat mengambil pratinjau template.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError("Nama Campaign wajib diisi.");
      return;
    }
    if (!formData.templateId) {
      setFormError("Silakan pilih Email Template.");
      return;
    }
    if (!formData.pageId) {
      setFormError("Silakan pilih Landing Page.");
      return;
    }
    if (!formData.smtpId) {
      setFormError("Silakan pilih Sending Profile.");
      return;
    }
    if (!formData.groupId) {
      setFormError("Silakan pilih Target Group.");
      return;
    }
    if (!formData.url.trim() || !formData.url.startsWith("http")) {
      setFormError("URL phishing HTTP atau HTTPS yang valid wajib diisi.");
      return;
    }

    setSubmitting(true);

    const payload = {
      name: formData.name.trim(),
      templateId: parseInt(formData.templateId),
      pageId: parseInt(formData.pageId),
      smtpId: parseInt(formData.smtpId),
      groupId: parseInt(formData.groupId),
      url: formData.url.trim(),
      launchDate:
        formData.dispatchTiming === "scheduled" && formData.launchDate
          ? new Date(formData.launchDate).toISOString()
          : new Date().toISOString(),
      sendByDate: formData.sendByDate
        ? new Date(formData.sendByDate).toISOString()
        : null,
    };

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const created = await res.json();
        showToast(`Campaign "${created.name}" berhasil diluncurkan.`);
        setIsModalOpen(false);
        setFormData({
          name: "",
          templateId: "",
          pageId: "",
          smtpId: "",
          groupId: "",
          url: networkInfo?.presets.find((p) => p.isRecommended)?.url || "http://127.0.0.1:8080",
          dispatchTiming: "immediate",
          launchDate: "",
          sendByDate: "",
        });
        fetchCampaigns();
      } else {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error || "Gagal membuat campaign.");
      }
    } catch (e) {
      console.error(e);
      setFormError("Terjadi kesalahan jaringan saat meluncurkan campaign.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCampaign = async (id: number, name: string) => {
    if (confirm(`Hapus campaign "${name}" secara permanen?`)) {
      try {
        const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
        if (res.ok) {
          setCampaigns((prev) => prev.filter((c) => c.id !== id));
          showToast(`Campaign "${name}" berhasil dihapus.`);
        } else {
          showToast("Gagal menghapus campaign.");
        }
      } catch {
        showToast("Terjadi kesalahan jaringan saat menghapus campaign.");
      }
    }
  };

  const handleToggleStatus = async (cmp: CampaignItem) => {
    const isCompleted = cmp.status === "Completed";
    const nextStatus =
      cmp.status === "Active" || cmp.status === "In_Progress"
        ? "Paused"
        : cmp.status === "Paused"
        ? "Active"
        : "Completed";

    if (isCompleted) {
      showToast("Campaign yang telah selesai tidak dapat dilanjutkan kembali.");
      return;
    }

    try {
      const res = await fetch(`/api/campaigns/${cmp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        showToast(
          `Status campaign "${cmp.name}" kini ${
            nextStatus === "Active" ? "Aktif" : nextStatus === "Paused" ? "Dijeda" : "Selesai"
          }.`
        );
        fetchCampaigns();
      } else {
        showToast("Gagal memperbarui status campaign.");
      }
    } catch {
      showToast("Terjadi kesalahan saat memperbarui status.");
    }
  };

  const handleCompleteCampaign = async (cmp: CampaignItem) => {
    if (!confirm(`Tandai campaign "${cmp.name}" sebagai Selesai?`)) return;
    try {
      const res = await fetch(`/api/campaigns/${cmp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      if (res.ok) {
        showToast(`Campaign "${cmp.name}" berhasil ditandai sebagai Selesai.`);
        fetchCampaigns();
      }
    } catch {
      showToast("Terjadi kesalahan saat menyelesaikan campaign.");
    }
  };

  // Aggregate Metrics derived from real database campaigns
  const aggregateMetrics = useMemo(() => {
    const totalCampaigns = campaigns.length;
    let totalSent = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    let totalSubmitted = 0;
    let totalReported = 0;

    for (const c of campaigns) {
      if (c.stats) {
        totalSent += c.stats.sent;
        totalOpened += c.stats.opened;
        totalClicked += c.stats.clicked;
        totalSubmitted += c.stats.submitted;
        totalReported += c.stats.reported;
      } else if (c.results) {
        for (const r of c.results) {
          const s = (r.status || "").toLowerCase();
          if (s !== "scheduled") totalSent++;
          if (s.includes("open") || s.includes("click") || s.includes("submit")) totalOpened++;
          if (s.includes("click") || s.includes("submit")) totalClicked++;
          if (s.includes("submit")) totalSubmitted++;
          if (r.reported) totalReported++;
        }
      }
    }

    const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0.0";
    const clickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0.0";
    const submitRate = totalSent > 0 ? ((totalSubmitted / totalSent) * 100).toFixed(1) : "0.0";
    const reportRate = totalSent > 0 ? ((totalReported / totalSent) * 100).toFixed(1) : "0.0";

    return {
      totalCampaigns,
      totalSent,
      totalOpened,
      totalClicked,
      totalSubmitted,
      totalReported,
      openRate,
      clickRate,
      submitRate,
      reportRate,
    };
  }, [campaigns]);

  // Filtered rows for Campaign table
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((row) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        q === "" ||
        row.name.toLowerCase().includes(q) ||
        (row.template?.name && row.template.name.toLowerCase().includes(q)) ||
        (row.group?.name && row.group.name.toLowerCase().includes(q)) ||
        row.createdDate.includes(q);

      const s = (row.status || "").toLowerCase();
      let matchesStatus = true;
      if (statusFilter === "Active") matchesStatus = s.includes("active") || s.includes("progress");
      else if (statusFilter === "Completed") matchesStatus = s.includes("complete");
      else if (statusFilter === "Scheduled") matchesStatus = s.includes("sched");
      else if (statusFilter === "Paused") matchesStatus = s.includes("pause");

      return matchesSearch && matchesStatus;
    });
  }, [campaigns, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / pageSize));
  const paginatedCampaigns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCampaigns.slice(start, start + pageSize);
  }, [filteredCampaigns, currentPage, pageSize]);

  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s.includes("complete")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Selesai
        </span>
      );
    }
    if (s.includes("progress") || s.includes("active")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Sedang Berjalan
        </span>
      );
    }
    if (s.includes("sched")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Terjadwal
        </span>
      );
    }
    if (s.includes("pause")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
          Dijeda
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-[1440px] pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-foreground text-white px-4 py-3 rounded-lg shadow-xl text-xs sm:text-sm font-medium flex items-center gap-2.5 border border-white/10 animate-in fade-in slide-in-from-bottom-3">
          <Sparkles size={16} className="text-yellow-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ===================== PAGE HEADER ===================== */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl lg:text-[36px] font-bold leading-tight sm:leading-[44px] tracking-tight text-foreground">
            Campaigns
          </h1>
          <p className="text-xs sm:text-sm text-body">
            Kelola siklus simulasi red team, jadwalkan pengiriman, dan pantau telemetri secara real-time.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* New Campaign Button */}
          <button
            type="button"
            onClick={handleOpenModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 bg-btn-primary text-btn-primary-text text-xs font-medium rounded-md shadow-xs hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Campaign Baru</span>
          </button>

          {/* Refresh Data Button */}
          <button
            type="button"
            onClick={fetchCampaigns}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-card border border-border text-xs font-medium text-foreground rounded-md shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
            title="Segarkan data campaign"
          >
            <RefreshCw size={13} className="text-muted" />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* ===================== 4 REAL TELEMETRY STAT CARDS ===================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Campaigns Run */}
        <div className="bg-card rounded-lg border border-border p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-xs text-muted font-medium">Total Campaign Dijalankan</span>
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Radio size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-foreground tracking-tight">
              {aggregateMetrics.totalCampaigns}
            </span>
            <p className="text-xs font-medium text-zinc-500 mt-1 flex items-center gap-1">
              <span>{aggregateMetrics.totalSent} total email dikirim</span>
            </p>
          </div>
        </div>

        {/* Card 2: Overall Open Rate */}
        <div className="bg-card rounded-lg border border-border p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-xs text-muted font-medium">Rasio Buka Keseluruhan</span>
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Lock size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-foreground tracking-tight">
              {aggregateMetrics.openRate}%
            </span>
            <p className="text-xs font-medium text-blue-600 mt-1 flex items-center gap-1">
              <span>{aggregateMetrics.totalOpened} dibuka dari {aggregateMetrics.totalSent}</span>
            </p>
          </div>
        </div>

        {/* Card 3: Overall Click Rate */}
        <div className="bg-card rounded-lg border border-border p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-xs text-muted font-medium">Rasio Klik Keseluruhan</span>
            <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <MousePointerClick size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-foreground tracking-tight">
              {aggregateMetrics.clickRate}%
            </span>
            <p className="text-xs font-medium text-amber-600 mt-1 flex items-center gap-1">
              <span>{aggregateMetrics.totalClicked} mengklik tautan simulasi</span>
            </p>
          </div>
        </div>

        {/* Card 4: Cred Submission Rate */}
        <div className="bg-card rounded-lg border border-border p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-xs text-muted font-medium">Rasio Submit Kredensial</span>
            <div className="w-7 h-7 rounded-md bg-red-50 text-red-600 flex items-center justify-center">
              <KeyRound size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-foreground tracking-tight">
              {aggregateMetrics.submitRate}%
            </span>
            <p className="text-xs font-medium text-red-600 mt-1 flex items-center gap-1">
              <span>{aggregateMetrics.totalSubmitted} kredensial terkompromi</span>
            </p>
          </div>
        </div>
      </div>

      {/* ===================== CAMPAIGN STATUS SUMMARY BAR ===================== */}
      <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted uppercase tracking-wider">Filter Campaign:</span>
          <div className="flex items-center gap-1">
            {[
              { key: "All", label: "Semua" },
              { key: "Active", label: "Aktif" },
              { key: "Completed", label: "Selesai" },
              { key: "Scheduled", label: "Terjadwal" },
              { key: "Paused", label: "Dijeda" },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setStatusFilter(key);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === key
                    ? "bg-foreground text-white"
                    : "text-body hover:bg-gray-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted">
          <span>Total: <strong className="text-foreground">{campaigns.length}</strong></span>
          <span>•</span>
          <span>Aktif: <strong className="text-amber-600">{campaigns.filter((c) => c.status === "Active" || c.status === "In_Progress").length}</strong></span>
          <span>•</span>
          <span>Selesai: <strong className="text-emerald-600">{campaigns.filter((c) => c.status === "Completed").length}</strong></span>
        </div>
      </div>

      {/* ===================== DETAILED CAMPAIGN RESULTS TABLE ===================== */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
        {/* Table Header: Title + Search Input */}
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-foreground">
              Campaign Simulasi ({filteredCampaigns.length})
            </h2>
            <p className="text-xs text-muted">
              Log audit simulasi langsung dengan telemetri berbasis database.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Cari campaign, template, grup..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-[34px] pl-8 pr-3 rounded-md bg-input-bg border border-border text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Nama Campaign
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Template & Audiens
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Tanggal Dibuat
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Penerima
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Dibuka
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Diklik
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-xs text-muted">
                    <div className="inline-block w-5 h-5 border-2 border-border border-t-foreground rounded-full animate-spin mr-2" />
                    Memuat data campaign...
                  </td>
                </tr>
              ) : paginatedCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-xs text-empty">
                    {searchQuery || statusFilter !== "All"
                      ? "Tidak ada campaign yang cocok dengan pencarian atau filter."
                      : "Belum ada campaign yang terdaftar."}
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((row) => {
                  const recipients = row.stats?.total ?? row.results?.length ?? 0;
                  const opens = row.stats?.opened ?? 0;
                  const openRate = row.stats?.openRate ?? 0;
                  const clicks = row.stats?.clicked ?? 0;
                  const clickRate = row.stats?.clickRate ?? 0;

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                        <Link
                          href={`/campaigns/${row.id}`}
                          className="font-semibold text-foreground hover:text-blue-600 hover:underline transition-colors block"
                        >
                          {row.name}
                        </Link>
                        {row.url && (
                          <span className="text-[10px] text-muted font-mono truncate max-w-[200px] block">
                            {row.url}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-body whitespace-nowrap">
                        <div className="font-medium text-foreground truncate max-w-[200px]">
                          {row.template?.name || "Tanpa Template"}
                        </div>
                        <div className="text-[11px] text-muted truncate max-w-[200px]">
                          Target: {row.group?.name || "Tanpa Grup"}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted whitespace-nowrap">
                        {new Date(row.createdDate).toLocaleDateString("id-ID")}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-body text-right font-medium whitespace-nowrap">
                        {recipients}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-body text-right whitespace-nowrap">
                        <span className="font-semibold text-foreground">{opens}</span>{" "}
                        <span className="text-muted text-[11px]">({openRate}%)</span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-right whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            clickRate > 20
                              ? "text-red-500"
                              : clickRate > 10
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {clicks}
                        </span>{" "}
                        <span className="text-muted text-[11px]">({clickRate}%)</span>
                      </td>
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {getStatusBadge(row.status)}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Detail Link */}
                          <Link
                            href={`/campaigns/${row.id}`}
                            className="p-1.5 hover:bg-gray-100 rounded text-muted hover:text-foreground transition-colors"
                            title="Lihat Detail & Telemetri Campaign"
                          >
                            <Eye size={14} />
                          </Link>

                          {/* Complete Campaign */}
                          {row.status !== "Completed" && (
                            <button
                              type="button"
                              onClick={() => handleCompleteCampaign(row)}
                              className="p-1.5 hover:bg-emerald-50 rounded text-muted hover:text-emerald-600 cursor-pointer transition-colors"
                              title="Tandai Selesai"
                            >
                              <Flag size={14} />
                            </button>
                          )}

                          {/* Pause / Resume */}
                          {row.status !== "Completed" && row.status !== "Scheduled" && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(row)}
                              className="p-1.5 hover:bg-gray-100 rounded text-muted hover:text-foreground cursor-pointer transition-colors"
                              title={row.status === "Active" || row.status === "In_Progress" ? "Jeda Campaign" : "Lanjutkan Campaign"}
                            >
                              {row.status === "Active" || row.status === "In_Progress" ? (
                                <Pause size={14} />
                              ) : (
                                <Play size={14} className="text-green-600" />
                              )}
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDeleteCampaign(row.id, row.name)}
                            className="p-1.5 hover:bg-red-50 rounded text-muted hover:text-red-600 cursor-pointer transition-colors"
                            title="Hapus Campaign"
                          >
                            <Trash2 size={14} />
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

        {/* Table Footer: Pagination & Counts */}
        <div className="px-5 py-3.5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted">
          <span>
            Menampilkan {filteredCampaigns.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} hingga{" "}
            {Math.min(currentPage * pageSize, filteredCampaigns.length)} dari {filteredCampaigns.length} campaign
          </span>

          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded text-xs font-medium cursor-pointer transition-colors ${
                  currentPage === page
                    ? "bg-foreground text-white"
                    : "text-body hover:bg-gray-100"
                }`}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ===================== MODAL: NEW CAMPAIGN (GOPHISH WORKFLOW) ===================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-[620px] max-h-[92vh] overflow-y-auto p-5 sm:p-7 space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center">
                    <Radio size={15} />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    Campaign Baru
                  </h2>
                </div>
                <p className="text-xs text-body">
                  Konfigurasikan target simulasi, umpan email, landing page tiruan, dan parameter pengiriman.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-muted hover:text-foreground rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Banner */}
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-center gap-2 animate-in fade-in">
                <AlertTriangle size={15} className="shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleLaunchCampaign} className="space-y-4">
              {/* Campaign Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Nama Campaign <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="cth. Evaluasi Kesadaran Keamanan Eksekutif Q4"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>

              {/* Email Template Selection + Preview Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-foreground">
                    Email Template <span className="text-red-500">*</span>
                  </label>
                  {formData.templateId && (
                    <button
                      type="button"
                      onClick={() => handleOpenTemplatePreview(formData.templateId)}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>Pratinjau Template Terpilih</span>
                    </button>
                  )}
                </div>
                <select
                  required
                  value={formData.templateId}
                  onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                >
                  <option value="">Pilih Email Template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.subject ? `— (${t.subject})` : ""}
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    Template tidak ditemukan. Buat template terlebih dahulu di menu <Link href="/email-templates" className="underline">Email Templates</Link>.
                  </p>
                )}
              </div>

              {/* Landing Page */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Landing Page <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.pageId}
                  onChange={(e) => setFormData({ ...formData, pageId: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                >
                  <option value="">Pilih Landing Page...</option>
                  {landingPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* URL Field with 2 Network Reachability Modes */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    URL <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-muted font-medium">Jangkauan Target:</span>
                </div>

                {/* 2-Option Selector */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNetworkMode("same_wifi");
                      const ip = networkInfo?.lanIp || "192.168.18.148";
                      const port = networkInfo?.listenerPort || 8080;
                      setFormData((prev) => ({
                        ...prev,
                        url: `http://${ip}:${port}`,
                      }));
                    }}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      networkMode === "same_wifi"
                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                        : "border-border bg-white hover:bg-zinc-50 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          networkMode === "same_wifi" ? "bg-emerald-400" : "bg-emerald-500"
                        }`}
                      />
                      <span>1. Jaringan Lokal (LAN)</span>
                    </div>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        networkMode === "same_wifi" ? "text-zinc-300" : "text-muted"
                      }`}
                    >
                      Target berada dalam jaringan LAN/Wi-Fi yang sama
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setNetworkMode("different_wifi");
                      const activeUrl = await checkTunnelStatus();
                      if (activeUrl) {
                        setFormData((prev) => ({ ...prev, url: activeUrl }));
                      } else {
                        if (
                          formData.url.includes("192.168") ||
                          formData.url.includes("127.0.0.1") ||
                          formData.url.includes("localhost")
                        ) {
                          setFormData((prev) => ({ ...prev, url: "" }));
                        }
                      }
                    }}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                      networkMode === "different_wifi"
                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                        : "border-border bg-white hover:bg-zinc-50 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          networkMode === "different_wifi" ? "bg-sky-400" : "bg-sky-500"
                        }`}
                      />
                      <span>2. Jaringan Publik (Internet)</span>
                    </div>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        networkMode === "different_wifi" ? "text-zinc-300" : "text-muted"
                      }`}
                    >
                      Target mengakses melalui internet atau jaringan eksternal
                    </span>
                  </button>
                </div>

                {/* URL Input: Locked for both Option 1 (LAN) and Option 2 (Tunnel) */}
                {networkMode === "same_wifi" ? (
                  <div className="relative">
                    <input
                      type="text"
                      required
                      readOnly
                      value={formData.url || `http://${networkInfo?.lanIp || "192.168.18.148"}:${networkInfo?.listenerPort || 8080}`}
                      className="w-full pl-8 pr-8 py-2 text-xs sm:text-sm border border-border rounded-md bg-zinc-100 text-foreground font-mono focus:outline-none cursor-not-allowed select-all"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
                      <Lock size={13} />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/system/network");
                          if (res.ok) {
                            const data = await res.json();
                            setNetworkInfo(data);
                            const ip = data.lanIp || "192.168.18.148";
                            const port = data.listenerPort || 8080;
                            setFormData((prev) => ({ ...prev, url: `http://${ip}:${port}` }));
                            showToast("IP LAN diperbarui");
                          }
                        } catch {
                          showToast("Gagal memperbarui IP");
                        }
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
                      title="Segarkan IP LAN"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                ) : tunnelInfo?.active && tunnelInfo.url ? (
                  <div className="relative">
                    <input
                      type="text"
                      required
                      readOnly
                      value={tunnelInfo.url}
                      className="w-full pl-8 pr-8 py-2 text-xs sm:text-sm border border-border rounded-md bg-zinc-100 text-foreground font-mono focus:outline-none cursor-not-allowed select-all"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
                      <Lock size={13} />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const u = await checkTunnelStatus();
                        if (u) showToast("Tunnel URL disinkronkan");
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
                      title="Segarkan status tunnel"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="https://your-tunnel.loca.lt"
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground font-mono"
                    />
                    <div className="mt-2 p-2.5 rounded-md bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-700 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground">
                          Dapat diakses target dari jaringan eksternal atau internet.
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            const activeUrl = await checkTunnelStatus();
                            if (activeUrl) {
                              setFormData((prev) => ({ ...prev, url: activeUrl }));
                              showToast(`Tunnel aktif terdeteksi: ${activeUrl}`);
                            } else {
                              showToast("Tunnel belum aktif. Silakan jalankan perintah tunnel terlebih dahulu.");
                            }
                          }}
                          disabled={checkingTunnel}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-medium underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw size={11} className={checkingTunnel ? "animate-spin" : ""} />
                          <span>{checkingTunnel ? "Mengecek..." : "Cek Tunnel Aktif"}</span>
                        </button>
                      </div>
                      <p className="text-muted leading-relaxed">
                        Jalankan perintah berikut pada terminal untuk mengaktifkan URL:
                      </p>
                      <div className="bg-white border border-border px-2.5 py-1.5 rounded font-mono text-[11px] text-zinc-800 select-all flex items-center justify-between">
                        <code>npx localtunnel --port 8080</code>
                        <span className="text-[10px] text-muted">atau: npm run tunnel</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sending Profile & Target Group */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Sending Profile (SMTP) <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.smtpId}
                    onChange={(e) => setFormData({ ...formData, smtpId: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="">Pilih Sending Profile...</option>
                    {sendingProfiles.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.from_address || s.fromAddress ? `(${s.from_address || s.fromAddress})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Target Group <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.groupId}
                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="">Pilih Target Group...</option>
                    {targetGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g._count?.targets ?? 0} target)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dispatch Timing */}
              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block text-xs font-semibold text-foreground">
                  Jadwal Pengiriman
                </label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dispatchTiming"
                      value="immediate"
                      checked={formData.dispatchTiming === "immediate"}
                      onChange={() => setFormData({ ...formData, dispatchTiming: "immediate" })}
                    />
                    <span>Luncurkan Segera</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dispatchTiming"
                      value="scheduled"
                      checked={formData.dispatchTiming === "scheduled"}
                      onChange={() => setFormData({ ...formData, dispatchTiming: "scheduled" })}
                    />
                    <span>Jadwalkan Nanti</span>
                  </label>
                </div>

                {formData.dispatchTiming === "scheduled" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-medium text-muted mb-1">
                        Tanggal & Waktu Peluncuran
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.launchDate}
                        onChange={(e) => setFormData({ ...formData, launchDate: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-border rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-muted mb-1">
                        Batas Waktu Pengiriman Email (Opsional)
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.sendByDate}
                        onChange={(e) => setFormData({ ...formData, sendByDate: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-border rounded bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Operational Security Notice */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-[11px] leading-relaxed">
                <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Simulasi ini membuat token pelacakan penerima aktif (<code className="font-mono bg-white/70 px-1 rounded">rId</code>) untuk seluruh target dalam grup yang dipilih. Pengiriman hanya ditujukan untuk pelatihan simulasi berwenang.
                </span>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium border border-border rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-btn-primary text-btn-primary-text text-xs font-medium rounded-md hover:bg-gray-800 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Meluncurkan..." : "Luncurkan Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== TEMPLATE PREVIEW SUB-MODAL ===================== */}
      {previewTemplate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Pratinjau Template: {previewTemplate.name}
                </h3>
                <p className="text-xs text-muted">
                  Subjek: <strong className="text-foreground">{previewTemplate.subject || "(tanpa subjek)"}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="p-1 rounded text-muted hover:text-foreground hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 bg-gray-50 border-b border-border text-xs flex items-center justify-between">
              <span className="text-muted">
                Dari: <strong className="text-foreground">{previewTemplate.envelopeSender || previewTemplate.envelope_sender || "Tidak ditentukan"}</strong>
              </span>
              <span className="text-muted text-[11px]">
                Lampiran: {previewTemplate.attachments?.length ?? 0}
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto bg-white min-h-[300px]">
              {previewTemplate.html ? (
                <iframe
                  title="Pratinjau HTML Template"
                  srcDoc={previewTemplate.html}
                  className="w-full h-[320px] border border-border rounded bg-white"
                  sandbox="allow-same-origin"
                />
              ) : (
                <pre className="p-4 bg-gray-50 border border-border rounded text-xs font-mono whitespace-pre-wrap text-foreground">
                  {previewTemplate.text || "(konten kosong)"}
                </pre>
              )}
            </div>

            <div className="p-3 border-t border-border flex justify-end bg-gray-50">
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="px-4 py-1.5 text-xs font-medium bg-foreground text-white rounded hover:bg-gray-800"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
