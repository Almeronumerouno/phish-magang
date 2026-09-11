"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Download,
  Calendar,
  ChevronDown,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Send,
  Lock,
  MousePointerClick,
  KeyRound,
  X,
  Radio,
  Shield,
  Trash2,
  Play,
  Pause,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

interface CampaignRow {
  id: string;
  name: string;
  date: string;
  recipients: string;
  opens: string;
  clicks: string;
  clickPercentage: number;
  riskLevel: "High" | "Medium" | "Low";
  status?: "Active" | "Paused" | "Completed" | "Scheduled";
}

const initialCampaigns: CampaignRow[] = [
  {
    id: "cmp-1",
    name: "Q3 Urgent Update: Payroll",
    date: "2023-10-12",
    recipients: "1,240",
    opens: "845 (68%)",
    clicks: "312 (25%)",
    clickPercentage: 25,
    riskLevel: "High",
    status: "Active",
  },
  {
    id: "cmp-2",
    name: "Mandatory IT Policy Review",
    date: "2023-09-28",
    recipients: "2,100",
    opens: "1,050 (50%)",
    clicks: "252 (12%)",
    clickPercentage: 12,
    riskLevel: "Medium",
    status: "Active",
  },
  {
    id: "cmp-3",
    name: "Benefits Enrollment Reminder",
    date: "2023-09-15",
    recipients: "1,450",
    opens: "2,890 (82%)",
    clicks: "104 (5%)",
    clickPercentage: 5,
    riskLevel: "Low",
    status: "Completed",
  },
  {
    id: "cmp-4",
    name: "CEO Q4 Strategy Update",
    date: "2023-08-30",
    recipients: "4,000",
    opens: "3,600 (90%)",
    clicks: "840 (21%)",
    clickPercentage: 21,
    riskLevel: "High",
    status: "Completed",
  },
  {
    id: "cmp-5",
    name: "New O365 Login Portal",
    date: "2023-08-12",
    recipients: "850",
    opens: "620 (73%)",
    clicks: "110 (13%)",
    clickPercentage: 13,
    riskLevel: "Medium",
    status: "Completed",
  },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>(initialCampaigns);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState("Last 30 Days");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal Form State
  const [formData, setFormData] = useState({
    name: "",
    template: "Corporate Login (Microsoft 365)",
    targetGroup: "Elevated & C-Suite",
    recipients: 1240,
    sendingProfile: "AWS SES East",
    dispatchTiming: "immediate" as "immediate" | "scheduled",
    scheduleDate: "2024-08-15T09:00",
    riskLevel: "High" as "High" | "Medium" | "Low",
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch("/api/campaigns");
        if (res.ok) {
          const data = await res.json();
          const mapped = data.map((cmp: any) => {
            const recipients = cmp._count?.results || 0;
            const opens = cmp.results?.filter((r: any) => ["Opened", "Clicked", "Submitted"].includes(r.status)).length || 0;
            const clicks = cmp.results?.filter((r: any) => ["Clicked", "Submitted"].includes(r.status)).length || 0;
            const clickPercentage = recipients > 0 ? Math.round((clicks / recipients) * 100) : 0;
            const openPercentage = recipients > 0 ? Math.round((opens / recipients) * 100) : 0;
            
            return {
              id: String(cmp.id),
              name: cmp.name,
              date: new Date(cmp.createdDate).toISOString().split("T")[0],
              recipients: recipients.toLocaleString(),
              opens: `${opens} (${openPercentage}%)`,
              clicks: `${clicks} (${clickPercentage}%)`,
              clickPercentage,
              riskLevel: clickPercentage > 20 ? "High" : clickPercentage > 10 ? "Medium" : "Low",
              status: cmp.status,
            };
          });
          setCampaigns([...mapped, ...initialCampaigns]);
        }
      } catch (err) {
        console.error("Failed to fetch campaigns", err);
      }
    }
    fetchCampaigns();
  }, []);

  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const newCmp = {
      name: formData.name.trim(),
      status: formData.dispatchTiming === "immediate" ? "Active" : "Scheduled",
      templateId: 1, // mapping mock to DB
      groupId: 1, // mapping mock to DB
      smtpId: 1, // mapping mock to DB
    };

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCmp)
      });
      if (res.ok) {
        const cmp = await res.json();
        const added: CampaignRow = {
          id: String(cmp.id),
          name: cmp.name,
          date: new Date(cmp.createdDate || Date.now()).toISOString().split("T")[0],
          recipients: "0",
          opens: "0 (0%)",
          clicks: "0 (0%)",
          clickPercentage: 0,
          riskLevel: "Low",
          status: cmp.status,
        };
        setCampaigns((prev) => [added, ...prev]);
        showToast(`Campaign "${cmp.name}" launched successfully!`);
      }
    } catch (e) {
      console.error(e);
      showToast("Error launching campaign");
    }

    setIsModalOpen(false);
    setFormData({
      name: "",
      template: "Corporate Login (Microsoft 365)",
      targetGroup: "Elevated & C-Suite",
      recipients: 1240,
      sendingProfile: "AWS SES East",
      dispatchTiming: "immediate",
      scheduleDate: "2024-08-15T09:00",
      riskLevel: "High",
    });
  };

  const handleDeleteCampaign = async (id: string, name: string) => {
    if (confirm(`Delete campaign "${name}"?`)) {
      if (!id.startsWith("cmp-")) {
        try {
          await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
        } catch (e) {
          console.error(e);
        }
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      showToast(`Campaign "${name}" removed.`);
    }
  };

  const togglePauseResume = async (id: string) => {
    const cmp = campaigns.find((c) => c.id === id);
    if (!cmp) return;
    
    const newStatus = cmp.status === "Active" ? "Paused" : "Active";
    
    if (!id.startsWith("cmp-")) {
      try {
        await fetch(`/api/campaigns/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
      } catch (e) {
        console.error(e);
      }
    }

    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        showToast(
          `Campaign "${c.name}" is now ${
            newStatus === "Paused" ? "paused" : "active"
          }.`
        );
        return { ...c, status: newStatus };
      })
    );
  };

  const filteredRows = campaigns.filter(
    (row) =>
      row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.date.includes(searchQuery) ||
      row.riskLevel.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRiskBadge = (level: "High" | "Medium" | "Low") => {
    switch (level) {
      case "High":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            High
          </span>
        );
      case "Medium":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Medium
          </span>
        );
      case "Low":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Low
          </span>
        );
    }
  };

  const departments = [
    { name: "Eng", height: 52 },
    { name: "HR", height: 66 },
    { name: "Sales", height: 38 },
    { name: "Finance", height: 76 },
    { name: "Exec", height: 32 },
  ];

  return (
    <div className="space-y-6 max-w-[1440px] pb-8">
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
            Analyze campaign performance and organizational security posture.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* New Campaign Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 bg-btn-primary text-btn-primary-text text-xs font-medium rounded-md shadow-xs hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New Campaign</span>
          </button>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={() => showToast("Exporting security posture PDF...")}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 bg-card border border-border text-xs font-medium text-foreground rounded-md shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <Download size={14} className="text-body" />
            <span>Export PDF</span>
          </button>

          {/* Date Range Filter Button */}
          <button
            type="button"
            onClick={() => {
              const ranges = ["Last 30 Days", "Last 90 Days", "Year to Date", "All Time"];
              const nextIndex = (ranges.indexOf(dateRange) + 1) % ranges.length;
              setDateRange(ranges[nextIndex]);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 bg-card border border-border text-xs font-medium text-foreground rounded-md shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <Calendar size={14} className="text-body" />
            <span>Filter: {dateRange}</span>
            <ChevronDown size={14} className="text-muted" />
          </button>
        </div>
      </div>

      {/* ===================== 4 STAT CARDS (FIGMA SPEC) ===================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Campaigns Run */}
        <div className="bg-card rounded-lg border border-border p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-xs text-muted font-medium">
              Total Campaigns Run
            </span>
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Send size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-foreground tracking-tight">
              {142 + (campaigns.length - initialCampaigns.length)}
            </span>
            <p className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1">
              <span>↗</span>
              <span>+12.4% vs last month</span>
            </p>
          </div>
        </div>

        {/* Card 2: Overall Open Rate */}
        <div className="bg-card rounded-lg border border-border p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-xs text-muted font-medium">
              Overall Open Rate
            </span>
            <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <Lock size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-foreground tracking-tight">
              48.2%
            </span>
            <p className="text-xs font-medium text-red-500 mt-1 flex items-center gap-1">
              <span>↗</span>
              <span>+4.1% vs last month</span>
            </p>
          </div>
        </div>

        {/* Card 3: Overall Click Rate */}
        <div className="bg-card rounded-lg border border-border p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-xs text-muted font-medium">
              Overall Click Rate
            </span>
            <div className="w-7 h-7 rounded-md bg-red-50 text-red-600 flex items-center justify-center">
              <MousePointerClick size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-foreground tracking-tight">
              22.7%
            </span>
            <p className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1">
              <span>↘</span>
              <span>-1.5% vs last month</span>
            </p>
          </div>
        </div>

        {/* Card 4: Cred Submission Rate */}
        <div className="bg-card rounded-lg border border-border p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-start justify-between">
            <span className="text-xs text-muted font-medium">
              Cred Submission Rate
            </span>
            <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
              <KeyRound size={14} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-foreground tracking-tight">
              8.3%
            </span>
            <p className="text-xs font-medium text-emerald-600 mt-1 flex items-center gap-1">
              <span>↘</span>
              <span>-0.7% vs last month</span>
            </p>
          </div>
        </div>
      </div>

      {/* ===================== CHARTS ROW ===================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Chart: Campaign Success by Department */}
        <div className="bg-card rounded-lg border border-border p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">
              Campaign Success by Department
            </h3>
            <button
              type="button"
              className="text-muted hover:text-foreground p-1 rounded hover:bg-gray-100 transition-colors"
              aria-label="Options"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>

          {/* Bar Chart Container with Y-Axis */}
          <div className="relative pt-2">
            {/* Horizontal Dashed Gridlines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pl-8 pr-2">
              {[100, 75, 50, 25, 0].map((val) => (
                <div key={val} className="w-full flex items-center gap-2">
                  <span className="text-[10px] text-muted w-6 text-right">
                    {val}
                  </span>
                  <div className="flex-1 border-b border-dashed border-gray-200" />
                </div>
              ))}
            </div>

            {/* Solid Dark Bars */}
            <div className="relative pl-10 pr-2 h-[200px] flex items-end justify-between gap-3 pb-8">
              {departments.map((dept) => (
                <div
                  key={dept.name}
                  className="flex-1 flex flex-col items-center justify-end h-full group"
                >
                  <div
                    className="w-full bg-[#111827] group-hover:bg-[#1f293d] transition-all rounded-t-xs relative cursor-pointer"
                    style={{ height: `${dept.height}%` }}
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-10">
                      {dept.height}% Success
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* X-Axis Labels */}
            <div className="pl-10 pr-2 flex justify-between gap-3 text-center -mt-6">
              {departments.map((dept) => (
                <div
                  key={dept.name}
                  className="flex-1 text-xs text-muted font-medium"
                >
                  {dept.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Chart: Reporting Rate vs Click Rate */}
        <div className="bg-card rounded-lg border border-border p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              Reporting Rate vs Click Rate
            </h3>
            {/* Legend */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted font-medium">Reporting</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-xs text-muted font-medium">Clicked</span>
              </div>
            </div>
          </div>

          {/* Spline Line Graphic */}
          <div className="relative pt-2">
            {/* Horizontal Guide lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pr-2">
              {[0, 1, 2, 3].map((_, i) => (
                <div
                  key={i}
                  className="w-full border-b border-dashed border-gray-200"
                />
              ))}
            </div>

            {/* SVG Splines with Dots matching Figma exact curves */}
            <div className="relative h-[200px] w-full pb-8">
              <svg
                className="w-full h-full"
                viewBox="0 0 500 160"
                preserveAspectRatio="none"
              >
                {/* Green Line: Reporting */}
                <path
                  d="M 10 90 C 70 88, 140 100, 200 80 C 260 60, 310 10, 370 25 C 410 35, 450 145, 490 60"
                  fill="none"
                  stroke="#059669"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Red Line: Clicked */}
                <path
                  d="M 10 135 C 70 120, 150 110, 230 115 C 310 120, 390 100, 430 70 C 460 45, 480 75, 490 90"
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Scatter Dots on Graphic matching screenshot */}
                <circle cx="270" cy="50" r="3.5" fill="#059669" />
                <circle cx="430" cy="80" r="3.5" fill="#059669" />
                <circle cx="490" cy="45" r="3.5" fill="#059669" />

                <circle cx="240" cy="115" r="3.5" fill="#EF4444" />
                <circle cx="440" cy="90" r="3.5" fill="#EF4444" />
                <circle cx="490" cy="80" r="3.5" fill="#EF4444" />
              </svg>
            </div>

            {/* X-Axis Quarters */}
            <div className="flex justify-between text-xs text-muted font-medium px-4 -mt-6">
              <span>Q1</span>
              <span>Q2</span>
              <span>Q3</span>
              <span>Q4</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== DETAILED CAMPAIGN RESULTS TABLE ===================== */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-xs">
        {/* Table Header: Title + Search Input */}
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">
            Detailed Campaign Results
          </h2>
          <div className="relative w-full sm:w-56">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[34px] pl-8 pr-3 rounded-md bg-input-bg border border-border text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full min-w-[780px]">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Campaign Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Date
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Recipients
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Opens
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Clicks
                </th>
                <th className="px-5 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Risk Level
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-empty"
                  >
                    No campaign results match your search.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm text-foreground font-medium whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-body whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-body text-right whitespace-nowrap">
                      {row.recipients}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-body text-right whitespace-nowrap">
                      {row.opens}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-right whitespace-nowrap">
                      <span
                        className={
                          row.clickPercentage > 20
                            ? "text-red-500 font-medium"
                            : row.clickPercentage > 10
                            ? "text-amber-600 font-medium"
                            : "text-emerald-600 font-medium"
                        }
                      >
                        {row.clicks}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      {getRiskBadge(row.riskLevel)}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {row.status && (
                          <button
                            type="button"
                            onClick={() => togglePauseResume(row.id)}
                            className="p-1 hover:bg-gray-100 rounded text-muted hover:text-foreground cursor-pointer transition-colors"
                            title={row.status === "Active" ? "Pause" : "Resume"}
                          >
                            {row.status === "Active" ? (
                              <Pause size={13} />
                            ) : (
                              <Play size={13} className="text-green-600" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteCampaign(row.id, row.name)}
                          className="p-1 hover:bg-red-50 rounded text-muted hover:text-red-600 cursor-pointer transition-colors"
                          title="Delete Campaign"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Pagination & Counts */}
        <div className="px-5 py-3.5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted">
          <span>Showing 1 to 5 of 182 entries</span>

          <div className="flex items-center gap-1 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            {[1, 2, 3].map((page) => (
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

            <span className="px-1 text-muted">...</span>

            <button
              type="button"
              onClick={() => setCurrentPage(7)}
              className={`w-7 h-7 rounded text-xs font-medium cursor-pointer transition-colors ${
                currentPage === 7
                  ? "bg-foreground text-white"
                  : "text-body hover:bg-gray-100"
              }`}
            >
              7
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(7, p + 1))}
              disabled={currentPage === 7}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ===================== MODAL: LAUNCH NEW SIMULATION ===================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-[580px] max-h-[90vh] overflow-y-auto p-5 sm:p-7 space-y-5">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center">
                    <Radio size={15} />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">
                    Launch New Simulation
                  </h2>
                </div>
                <p className="text-xs text-body">
                  Configure and schedule a controlled red team phishing campaign.
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

            <form onSubmit={handleLaunchCampaign} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Campaign Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Executive Security Awareness Assessment"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Landing Page Template
                  </label>
                  <select
                    value={formData.template}
                    onChange={(e) =>
                      setFormData({ ...formData, template: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="Corporate Login (Microsoft 365)">
                      Corporate Login (Microsoft 365)
                    </option>
                    <option value="Banking Portal (Chase)">
                      Banking Portal (Chase)
                    </option>
                    <option value="HR Dashboard (Workday)">
                      HR Dashboard (Workday)
                    </option>
                    <option value="Generic Webmail">Generic Webmail</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Target Group
                  </label>
                  <select
                    value={formData.targetGroup}
                    onChange={(e) => {
                      const val = e.target.value;
                      const counts: Record<string, number> = {
                        "Elevated & C-Suite": 1240,
                        "IT & Digital Operations": 2100,
                        "Finance & Accounting": 1450,
                        "All Employees": 4000,
                      };
                      setFormData({
                        ...formData,
                        targetGroup: val,
                        recipients: counts[val] || 1000,
                      });
                    }}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="Elevated & C-Suite">
                      Elevated & C-Suite (1,240 targets)
                    </option>
                    <option value="IT & Digital Operations">
                      IT & Digital Operations (2,100 targets)
                    </option>
                    <option value="Finance & Accounting">
                      Finance & Accounting (1,450 targets)
                    </option>
                    <option value="All Employees">
                      All Employees (4,000 targets)
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Risk Level Profile
                  </label>
                  <select
                    value={formData.riskLevel}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        riskLevel: e.target.value as "High" | "Medium" | "Low",
                      })
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="High">High (Spearphishing / C-Suite)</option>
                    <option value="Medium">Medium (General Corporate)</option>
                    <option value="Low">Low (Basic Awareness)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    SMTP Sending Relay
                  </label>
                  <select
                    value={formData.sendingProfile}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sendingProfile: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    <option value="AWS SES East">AWS SES East</option>
                    <option value="Default Mailer">Default Mailer (587)</option>
                    <option value="Internal Relay">Internal Relay</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 text-[11px] leading-relaxed">
                <AlertTriangle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                <span>
                  No employee credentials are stored in persistent storage. All events are logged strictly for educational assessment telemetry.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium border border-border rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-btn-primary text-btn-primary-text text-xs font-medium rounded-md hover:bg-gray-800 transition-all shadow-sm cursor-pointer"
                >
                  Launch Simulation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
