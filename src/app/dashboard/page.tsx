"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { MoreHorizontal, Loader2 } from "lucide-react";

type Campaign = {
  id: number;
  campaign: string;
  date: string;
  status: string;
  sent: number;
  opened: number;
  clicked: number;
};

type DashboardData = {
  activeCampaigns: number;
  totalEmailsSent: number;
  emailsOpened: number;
  clickRate: string;
  recentCampaigns: Campaign[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    );
  }

  const {
    activeCampaigns = 0,
    totalEmailsSent = 0,
    emailsOpened = 0,
    clickRate = "0.0%",
    recentCampaigns = [],
  } = data || {};

  return (
    <div className="space-y-6 max-w-[1440px] pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-[36px] font-bold leading-tight sm:leading-[44px] tracking-tight text-foreground">
            Security Awareness Overview
          </h1>
          <p className="text-xs sm:text-sm text-body mt-1">
            Real-time metrics and campaign performance tracking
          </p>
        </div>
        <button
          type="button"
          className="self-end sm:self-start p-2 rounded-md hover:bg-black/5 cursor-pointer"
          aria-label="More options"
        >
          <MoreHorizontal size={20} className="text-body" />
        </button>
      </div>

      {/* Stats Grid - 2 cols on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Active Campaigns" value={activeCampaigns} />
        <StatCard label="Total Emails Sent" value={totalEmailsSent.toLocaleString()} />
        <StatCard label="Emails Opened" value={emailsOpened.toLocaleString()} />
        <StatCard
          label="Click Rate"
          value={clickRate}
        />
      </div>

      {/* Chart Area */}
      <div className="bg-card rounded-lg border border-border p-4 sm:p-5 overflow-hidden">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-xs sm:text-sm font-semibold text-foreground">
            Emails Sent Over Time
          </h2>
          <div className="flex gap-1.5 sm:gap-2">
            <button className="px-2.5 sm:px-3 py-1 text-xs font-medium bg-foreground text-white rounded-md cursor-pointer">
              6M
            </button>
            <button className="px-2.5 sm:px-3 py-1 text-xs font-medium text-muted hover:bg-gray-100 rounded-md cursor-pointer">
              1Y
            </button>
          </div>
        </div>

        {/* Bar & Line Chart Container */}
        <div className="relative">
          <div className="h-[180px] sm:h-[200px] flex items-end gap-1 px-1 sm:px-4">
            {[30, 45, 35, 55, 40, 65, 50, 70, 60, 80, 75, 90, 85, 95, 88, 100, 92, 110, 105, 115, 108, 120].map(
              (h, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end h-full">
                  <div
                    className="bg-gray-200 hover:bg-gray-300 transition-colors rounded-t-xs w-full"
                    style={{ height: `${h}%` }}
                  />
                </div>
              )
            )}
          </div>
          {/* Overlay Line Chart */}
          <svg
            className="w-full h-[180px] sm:h-[200px] absolute inset-0 pointer-events-none"
            viewBox="0 0 800 200"
            preserveAspectRatio="none"
          >
            <polyline
              fill="none"
              stroke="#1B1B1D"
              strokeWidth="2"
              points="0,170 40,155 80,160 120,140 160,145 200,120 240,130 280,110 320,115 360,95 400,100 440,80 480,85 520,70 560,75 600,60 640,65 680,50 720,45 760,35 800,30"
            />
            <polyline
              fill="url(#grad)"
              stroke="none"
              points="0,170 40,155 80,160 120,140 160,145 200,120 240,130 280,110 320,115 360,95 400,100 440,80 480,85 520,70 560,75 600,60 640,65 680,50 720,45 760,35 800,30 800,200 0,200"
            />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1B1B1D" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#1B1B1D" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Recent Activity Table with Horizontal Scroll */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-border">
          <h2 className="text-xs sm:text-sm font-semibold text-foreground">
            Recent Activity
          </h2>
          <button className="text-xs text-muted hover:text-foreground cursor-pointer">
            View all
          </button>
        </div>
        
        {recentCampaigns.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No campaigns yet.
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[620px]">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    Campaign
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    Sent
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    Opened
                  </th>
                  <th className="px-4 sm:px-5 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap">
                    Clicked
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentCampaigns.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-b-0 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 sm:px-5 py-3 text-sm text-foreground font-medium whitespace-nowrap">
                      {row.campaign}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-body whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                          row.status === "Completed"
                            ? "bg-green-50 text-green-700"
                            : row.status === "In Progress" || row.status === "In_Progress" || row.status === "Active"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-body whitespace-nowrap">
                      {row.sent}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-body whitespace-nowrap">
                      {row.opened}
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-sm text-body whitespace-nowrap">
                      {row.clicked}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

