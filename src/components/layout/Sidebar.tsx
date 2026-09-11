"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Flag,
  FileText,
  Users,
  Send,
  X,
  LogOut,
} from "lucide-react";
import { getEmailPrefix, getInitials, useAuth } from "@/lib/auth-context";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Campaigns", href: "/campaigns", icon: Flag },
  { label: "Templates", href: "/templates", icon: FileText },
  { label: "Targets", href: "/target-groups", icon: Users },
  { label: "Sending Profiles", href: "/sending-profiles", icon: Send },
];

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const displayName = user ? getEmailPrefix(user.username) : "Operator";
  const displayEmail = user?.username ?? "Not signed in";

  const handleLogout = async () => {
    await logout();
    onClose?.();
    router.push("/login");
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] md:w-[220px] md:min-w-[220px] md:static md:z-auto bg-sidebar-bg flex flex-col h-full select-none border-r border-black/20 shadow-2xl md:shadow-none transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="px-5 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-[15px] leading-tight tracking-tight">
              Red Team Simulation
            </h1>
            <p className="text-[11px] text-sidebar-text/80 font-normal mt-0.5">
              Enterprise Security
            </p>
          </div>

          {/* Close button for Mobile Drawer */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden text-sidebar-text hover:text-white p-1.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-2.5 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/templates" && pathname === "/clone-website") ||
                pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onClose?.()}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium transition-colors ${
                      isActive
                        ? "bg-white/10 text-sidebar-active shadow-sm"
                        : "text-sidebar-text hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer User Profile */}
        <div className="p-4 border-t border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden ring-1 ring-white/10 flex items-center justify-center shrink-0">
            <span className="text-white text-[11px] font-bold">
              {getInitials(user?.username ?? "?")}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-[12px] font-medium leading-none truncate">
              {displayName}
            </p>
            <p className="text-sidebar-text text-[10px] leading-tight mt-0.5 truncate">
              {displayEmail}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sidebar-text hover:text-white p-1.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}
