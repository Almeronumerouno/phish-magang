"use client";

import { Search, Bell, Settings, HelpCircle, Menu } from "lucide-react";
import { getEmailPrefix, getInitials, useAuth } from "@/lib/auth-context";

interface TopAppBarProps {
  onMenuToggle?: () => void;
}

export function TopAppBar({ onMenuToggle }: TopAppBarProps) {
  const { user } = useAuth();
  const displayName = user ? getEmailPrefix(user.username) : "Operator";
  const initials = getInitials(user?.username ?? "?");
  return (
    <header className="h-16 min-h-[64px] bg-header-bg border-b border-border flex items-center justify-between px-4 sm:px-6 gap-2 sm:gap-4">
      {/* Left: Mobile Menu Toggle + Search */}
      <div className="flex items-center gap-2 flex-1 max-w-[500px]">
        <button
          type="button"
          onClick={onMenuToggle}
          className="md:hidden p-2 -ml-1 text-foreground hover:bg-black/5 rounded-md transition-colors cursor-pointer shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu size={20} strokeWidth={2} />
        </button>

        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            strokeWidth={1.8}
          />
          <input
            type="text"
            placeholder="Search targets, campaigns..."
            className="w-full h-[38px] pl-9 sm:pl-10 pr-3 sm:pr-4 rounded-md bg-input-bg border border-border text-xs sm:text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-border transition-all"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        {/* Notification Bell */}
        <button
          type="button"
          className="relative p-2 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Bell size={19} strokeWidth={1.8} className="text-body" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-notification rounded-full" />
        </button>

        {/* Settings (hidden on very small screens) */}
        <button
          type="button"
          className="hidden sm:flex p-2 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
          aria-label="Settings"
        >
          <Settings size={19} strokeWidth={1.8} className="text-body" />
        </button>

        {/* Help (hidden on mobile) */}
        <button
          type="button"
          className="hidden md:flex p-2 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
          aria-label="Help"
        >
          <HelpCircle size={19} strokeWidth={1.8} className="text-body" />
        </button>

        {/* Divider */}
        <div className="hidden sm:block w-px h-7 bg-border mx-0.5 sm:mx-1" />

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-1">
          <div className="w-8 h-8 rounded-full bg-gray-300 ring-1 ring-black/5 overflow-hidden flex items-center justify-center shrink-0">
            <span className="text-gray-700 text-[11px] font-bold">{initials}</span>
          </div>
          <span className="text-xs font-bold text-foreground hidden sm:inline-block">
            {displayName}
          </span>
        </div>
      </div>
    </header>
  );
}
