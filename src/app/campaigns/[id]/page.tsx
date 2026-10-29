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
          setError("Campaign not found.");
        } else {
          setError("Failed to load campaign.");
        }
        return;
      }
      const data = await res.json();
      setCampaign(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Network error loading campaign.");
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
    if (!confirm(`Are you sure you want to complete campaign "${campaign.name}"?`)) return;

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      if (res.ok) {
        showToast("Campaign marked as Completed.");
        fetchCampaign();
      } else {
        showToast("Failed to complete campaign.");
      }
    } catch {
      showToast("Error updating campaign.");
    }
  };

  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    if (!confirm(`Permanently delete campaign "${campaign.name}" and all results?`)) return;

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Campaign deleted.");
        router.push("/campaigns");
      } else {
        showToast("Failed to delete campaign.");
      }
    } catch {
      showToast("Error deleting campaign.");
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
      showToast("Results CSV exported.");
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
      showToast("Raw Events CSV exported.");
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
          Completed
        </span>
      );
    }
    if (s.includes("progress") || s.includes("active")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          In Progress
        </span>
      );
    }
    if (s.includes("sched")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Scheduled
        </span>
      );
    }
    if (s.includes("pause")) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
          Paused
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
          <ShieldCheck size={12} className="text-emerald-600" /> Reported
        </span>
      );
    }
    if (s.includes("submit")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
          <KeyRound size={12} className="text-red-500" /> Submitted Data
        </span>
      );
    }
    if (s.includes("click")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <MousePointerClick size={12} className="text-amber-600" /> Clicked Link
        </span>
      );
    }
    if (s.includes("open")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <Lock size={12} className="text-blue-600" /> Email Opened
        </span>
      );
    }
    if (s.includes("sent")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
          <Send size={12} className="text-zinc-500" /> Email Sent
        </span>
      );
    }
    if (s.includes("sched")) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
          <Clock size={12} className="text-purple-600" /> Scheduled
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
        <p className="text-xs text-muted">Loading campaign telemetry...</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="space-y-4 max-w-[900px] mx-auto py-12 text-center">
        <AlertTriangle size={36} className="mx-auto text-red-500" />
        <h2 className="text-xl font-bold text-foreground">{error || "Campaign not found"}</h2>
        <p className="text-xs text-body">The campaign ID requested could not be retrieved from the database.</p>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-white rounded-md text-xs font-medium hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Campaigns
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
              <span>Back to Campaigns</span>
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
            Real-time simulation telemetry, victim conversion funnel, and target audit stream.
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
            title="Refresh campaign data"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin text-muted" : "text-muted"} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          {/* Export CSV Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border text-xs font-medium text-foreground rounded-md shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Download size={13} className="text-muted" />
              <span>Export CSV</span>
            </button>
            {isExportOpen && (
              <div className="absolute right-0 mt-1.5 w-48 bg-card border border-border rounded-lg shadow-xl z-30 py-1 text-xs animate-in fade-in">
                <button
                  type="button"
                  onClick={() => handleExportCSV("results")}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-50 text-foreground font-medium flex items-center justify-between cursor-pointer"
                >
                  <span>Target Results CSV</span>
                  <ChevronRight size={12} className="text-muted" />
                </button>
                <button
                  type="button"
                  onClick={() => handleExportCSV("events")}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-50 text-foreground font-medium flex items-center justify-between cursor-pointer"
                >
                  <span>Raw Events Log CSV</span>
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
              <span>Complete</span>
            </button>
          )}

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDeleteCampaign}
            className="flex items-center gap-1.5 px-3 py-2 bg-card border border-red-200 text-red-600 text-xs font-medium rounded-md shadow-xs hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* ===================== CAMPAIGN CONFIGURATION OVERVIEW ===================== */}
      <div className="bg-card rounded-lg border border-border p-5 shadow-xs">
        <h2 className="text-xs font-bold text-muted uppercase tracking-wider mb-4">
          Simulation Configuration
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-muted font-medium flex items-center gap-1.5">
              <Mail size={13} className="text-zinc-500" /> Email Template
            </span>
            <p className="font-semibold text-foreground truncate">
              {campaign.template?.name || "None"}
            </p>
            {campaign.template?.subject && (
              <p className="text-[11px] text-body truncate">
                Subj: {campaign.template.subject}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-muted font-medium flex items-center gap-1.5">
              <Globe size={13} className="text-zinc-500" /> Landing Page
            </span>
            <p className="font-semibold text-foreground truncate">
              {campaign.page?.name || "None"}
            </p>
            {campaign.page?.redirectUrl && (
              <p className="text-[11px] text-body truncate">
                Redirect: {campaign.page.redirectUrl}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-muted font-medium flex items-center gap-1.5">
              <Send size={13} className="text-zinc-500" /> Sending Profile
            </span>
            <p className="font-semibold text-foreground truncate">
              {campaign.profile?.name || "None"}
            </p>
            {campaign.profile?.fromAddress && (
              <p className="text-[11px] text-body truncate">
                From: {campaign.profile.fromAddress}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-muted font-medium flex items-center gap-1.5">
              <Users size={13} className="text-zinc-500" /> Target Audience
            </span>
            <p className="font-semibold text-foreground truncate">
              {campaign.group?.name || "None"} ({campaign.results.length} targets)
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
              Created: <strong className="text-foreground">{new Date(campaign.createdDate).toLocaleString()}</strong>
            </span>
            {campaign.launchDate && (
              <span className="flex items-center gap-1.5">
                <Clock size={13} />
                Launched: <strong className="text-foreground">{new Date(campaign.launchDate).toLocaleString()}</strong>
              </span>
            )}
            {campaign.completedDate && (
              <span className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 size={13} />
                Completed: <strong>{new Date(campaign.completedDate).toLocaleString()}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ===================== 5 TELEMETRY FUNNEL CARDS ===================== */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          Telemetry & Conversion Funnel
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Emails Sent */}
          <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Emails Sent</span>
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
                {campaign.stats.sentRate}% dispatched
              </span>
            </div>
          </div>

          {/* Card 2: Email Opened */}
          <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Opened</span>
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
                Tracking pixel trigger
              </span>
            </div>
          </div>

          {/* Card 3: Clicked Link */}
          <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Clicked Link</span>
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
                Phishing URL visited
              </span>
            </div>
          </div>

          {/* Card 4: Submitted Data */}
          <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Submitted Data</span>
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
                Credentials submitted
              </span>
            </div>
          </div>

          {/* Card 5: Reported Email */}
          <div className="bg-card rounded-lg border border-border p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted font-medium">Reported</span>
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
                Reported by target
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== TARGET RESULTS TABLE ===================== */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-foreground">
              Target Results ({filteredResults.length} / {campaign.results.length})
            </h2>
            <p className="text-xs text-muted">
              Individual victim progression and security awareness action log.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-[34px] px-2.5 text-xs bg-input-bg border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              <option value="All">Filter: All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Sent">Email Sent</option>
              <option value="Opened">Email Opened</option>
              <option value="Clicked">Clicked Link</option>
              <option value="Submitted">Submitted Data</option>
              <option value="Reported">Reported</option>
            </select>

            {/* Search Box */}
            <div className="relative w-full sm:w-56">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search target email/name..."
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
                  Target Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Email
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Position / Dept
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  Send Date
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-xs text-empty">
                    No target results found matching your filter criteria.
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
                    <td className="px-5 py-3.5 text-xs text-muted whitespace-nowrap">
                      {r.sendDate ? new Date(r.sendDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Pending"}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedTarget(r)}
                        className="px-2.5 py-1 text-[11px] font-medium border border-border rounded hover:bg-gray-100 text-foreground transition-colors cursor-pointer"
                      >
                        Timeline
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
          Activity Timeline ({campaign.events.length} events logged)
        </h2>
        <p className="text-xs text-muted mb-4">
          Chronological simulation event stream captured by the campaign listener.
        </p>

        {campaign.events.length === 0 ? (
          <div className="py-8 text-center text-xs text-empty">
            No events logged yet for this campaign.
          </div>
        ) : (
          <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
            {campaign.events.map((ev) => {
              const msg = (ev.message || "").toLowerCase();
              let icon = <Info size={12} className="text-zinc-600" />;
              let dotColor = "bg-zinc-500";

              if (msg.includes("create")) {
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
                  <div className="flex-1 bg-gray-50/70 border border-border/70 rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      <span className="font-semibold text-foreground mr-2">
                        {ev.message}
                      </span>
                      {ev.email && (
                        <span className="text-body font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-border mr-2">
                          {ev.email}
                        </span>
                      )}
                      {ev.details && (
                        <span className="text-muted text-[11px]">
                          {ev.details}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted font-mono shrink-0">
                      {new Date(ev.time).toLocaleString()}
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
                  Target Detail: {selectedTarget.email}
                </h3>
                <p className="text-xs text-muted">
                  Tracking Token (rId): <strong className="font-mono text-foreground">{selectedTarget.rId}</strong>
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

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-gray-50 rounded border border-border">
                <span className="text-muted block text-[10px] uppercase font-bold">Name</span>
                <span className="font-medium text-foreground">
                  {selectedTarget.firstName || selectedTarget.lastName
                    ? `${selectedTarget.firstName || ""} ${selectedTarget.lastName || ""}`.trim()
                    : "Not specified"}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded border border-border">
                <span className="text-muted block text-[10px] uppercase font-bold">Position</span>
                <span className="font-medium text-foreground">
                  {selectedTarget.position || "Not specified"}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded border border-border">
                <span className="text-muted block text-[10px] uppercase font-bold">Current Status</span>
                <span className="font-medium text-foreground">
                  {selectedTarget.status}
                </span>
              </div>
              <div className="p-2.5 bg-gray-50 rounded border border-border">
                <span className="text-muted block text-[10px] uppercase font-bold">Reported Phish</span>
                <span className="font-medium text-foreground">
                  {selectedTarget.reported ? "Yes" : "No"}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Timeline Events for this Target
              </h4>
              {targetEvents.length === 0 ? (
                <p className="text-xs text-empty py-4 text-center">
                  No individual event entries found for this recipient.
                </p>
              ) : (
                <div className="space-y-2">
                  {targetEvents.map((e) => (
                    <div
                      key={e.id}
                      className="p-2.5 bg-gray-50 border border-border rounded text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-foreground block">
                          {e.message}
                        </span>
                        {e.details && (
                          <span className="text-[11px] text-muted block">
                            {e.details}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted font-mono shrink-0">
                        {new Date(e.time).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedTarget(null)}
                className="px-4 py-1.5 text-xs font-medium border border-border rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
