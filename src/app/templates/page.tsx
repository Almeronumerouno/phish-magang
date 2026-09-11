"use client";

import { useState, useEffect } from "react";
import {
  Globe,
  Copy,
  Plus,
  SlidersHorizontal,
  LayoutGrid,
  Image as ImageIcon,
  X,
  Trash2,
  Loader2,
} from "lucide-react";

interface LandingPage {
  id: number;
  userId: number | null;
  name: string;
  html: string | null;
  modifiedDate: string;
  captureCredentials: boolean;
  capturePasswords: boolean;
  redirectUrl: string | null;
}

export default function TemplatesPage() {
  const [showCloneWindow, setShowCloneWindow] = useState(false);
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [cloneUrl, setCloneUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/pages");
      if (res.ok) {
        const data = await res.json();
        setPages(data);
      }
    } catch (error) {
      console.error("Error fetching pages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerCloneAndShowTemplates = async (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();

    const inputVal = cloneUrl.trim();
    if (inputVal) {
      setIsSubmitting(true);
      const cleanName = inputVal
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0];

      const newPageData = {
        name: cleanName.toUpperCase() + " (Cloned)",
        redirectUrl: inputVal.includes(".") ? cleanName : `${cleanName}.com`,
        html: "",
        captureCredentials: true,
        capturePasswords: true,
      };

      try {
        const res = await fetch("/api/pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newPageData),
        });

        if (res.ok) {
          await fetchPages();
        }
      } catch (error) {
        console.error("Error creating cloned page:", error);
      } finally {
        setIsSubmitting(false);
      }
    }

    setShowCloneWindow(false);
    setCloneUrl("");
  };

  return (
    <div className="space-y-6 max-w-[1440px] pb-6">
      {/* ===================== PAGE HEADER ===================== */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl lg:text-[36px] font-bold leading-tight sm:leading-[44px] tracking-tight text-foreground">
            Landing Page
          </h1>
          <p className="text-xs sm:text-sm text-body">
            Manage simulation recipients and organizational segments.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => {
            setShowCloneWindow((prev) => !prev);
          }}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 text-xs font-medium rounded-md shadow-[0_1px_3px_rgba(15,23,42,0.08)] transition-all cursor-pointer w-full sm:w-auto ${
            showCloneWindow
              ? "bg-gray-200 text-foreground hover:bg-gray-300"
              : "bg-btn-primary text-btn-primary-text hover:bg-gray-800 active:scale-95"
          }`}
        >
          {showCloneWindow ? (
            <>
              <X size={12} strokeWidth={2.5} />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus size={12} strokeWidth={2.5} />
              <span>New Page</span>
            </>
          )}
        </button>
      </div>

      {/* ===================== FLOATING WINDOW: CLONE WEBSITE ===================== */}
      {showCloneWindow && (
        <div className="w-full bg-white rounded-2xl border border-border shadow-sm p-4 sm:p-7 animate-in fade-in duration-150">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-[20px] font-bold tracking-tight text-foreground">
                Clone Website
              </h2>
              <p className="text-xs sm:text-[14px] text-body">
                Enter a URL to clone a website for your simulation templates.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCloneWindow(false)}
              className="text-muted hover:text-foreground p-1.5 rounded-md hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              aria-label="Close window"
            >
              <X size={18} />
            </button>
          </div>

          {/* Input Form Row */}
          <form onSubmit={triggerCloneAndShowTemplates} className="mt-4 sm:mt-5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Input field dengan globe icon */}
              <div className="flex-1 flex items-center gap-3 bg-input-bg border border-border rounded-lg px-3.5 sm:px-4 h-[44px] sm:h-[46px] focus-within:border-foreground focus-within:ring-1 focus-within:ring-foreground transition-all">
                <Globe size={18} className="text-muted shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      triggerCloneAndShowTemplates(e);
                    }
                  }}
                  disabled={isSubmitting}
                  placeholder="Enter URL to clone (e.g. https://example.com)"
                  className="flex-1 bg-transparent text-xs sm:text-[14px] text-foreground placeholder:text-muted focus:outline-none h-full min-w-0 disabled:opacity-50"
                />
              </div>

              {/* Black Clone CTA Button */}
              <button
                type="submit"
                disabled={isSubmitting || !cloneUrl.trim()}
                className="flex items-center justify-center gap-2 px-5 h-[44px] sm:h-[46px] bg-btn-primary text-btn-primary-text text-xs sm:text-[14px] font-medium rounded-lg hover:bg-gray-800 active:scale-95 transition-all shrink-0 cursor-pointer shadow-sm w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Copy size={16} strokeWidth={2} />
                )}
                <span>{isSubmitting ? "Cloning..." : "Clone"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================== LOADING STATE ===================== */}
      {isLoading && (
        <div className="flex items-center justify-center min-h-[350px] sm:min-h-[460px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted" />
        </div>
      )}

      {/* ===================== KONDISI AWAL (EMPTY STATE) ===================== */}
      {!isLoading && pages.length === 0 && (
        <div className="flex items-center justify-center min-h-[350px] sm:min-h-[460px]">
          <p className="text-sm sm:text-base text-empty select-none">Belum ada landing page.</p>
        </div>
      )}

      {/* ===================== TEMPLATE LIBRARY ===================== */}
      {!isLoading && pages.length > 0 && (
        <div className="space-y-4 pt-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-semibold text-foreground">
                Template Library
              </h2>
              <span className="text-[11px] sm:text-xs bg-gray-100 text-muted px-2 py-0.5 rounded-full font-medium">
                {pages.length} templates
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-muted">
              <button
                type="button"
                className="p-1.5 hover:text-foreground transition-colors cursor-pointer"
                aria-label="Filter templates"
              >
                <SlidersHorizontal size={16} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                className="p-1.5 hover:text-foreground transition-colors cursor-pointer"
                aria-label="Grid view"
              >
                <LayoutGrid size={16} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {pages.map((page) => (
              <div
                key={page.id}
                className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Thumbnail */}
                <div className="h-[140px] w-full bg-[#ECECF0] relative overflow-hidden flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1 text-muted/60">
                    <ImageIcon size={36} strokeWidth={1.2} />
                  </div>
                  {page.name.includes("(Cloned)") && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-black/80 text-white text-[10px] font-semibold rounded">
                      CLONED
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground leading-snug">
                      {page.name}
                    </h3>
                    <p className="text-xs text-body/80 truncate mt-0.5 font-mono">
                      {page.redirectUrl || "No redirect URL"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => alert(`Edit ${page.name}`)}
                      className="flex-1 px-3 py-1.5 text-xs font-medium border border-border bg-white text-foreground rounded hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => alert(`Using template: ${page.name}`)}
                      className="flex-1 px-3 py-1.5 text-xs font-medium bg-btn-primary text-btn-primary-text rounded hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      Use
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
