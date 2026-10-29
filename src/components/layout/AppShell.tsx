"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/lib/auth-context";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/campaigns",
  "/email-templates",
  "/templates",
  "/target-groups",
  "/sending-profiles",
  "/clone-website",
];

function AuthLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground"
        aria-label="Memuat..."
      />
    </div>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready } = useAuth();

  // If on public authentication routes, render full screen without dashboard chrome
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register/");

  const isProtectedRoute =
    pathname === "/" ||
    PROTECTED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
    );

  useEffect(() => {
    if (!ready) return;
    if (isAuthRoute && user) {
      router.replace("/dashboard");
    } else if (isProtectedRoute && !user) {
      router.replace("/login");
    }
  }, [ready, user, isAuthRoute, isProtectedRoute, router]);

  if (isAuthRoute) {
    if (user) return <AuthLoading />;
    return (
      <div className="h-full w-full overflow-y-auto bg-background">
        {children}
      </div>
    );
  }

  if (ready && isProtectedRoute && !user) {
    return <AuthLoading />;
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar with mobile drawer support */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Navigation Header */}
        <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 -ml-1 text-foreground hover:bg-black/5 rounded-md cursor-pointer"
            aria-label="Buka menu navigasi"
          >
            <Menu size={20} strokeWidth={2} />
          </button>
          <span className="text-xs font-semibold text-foreground">Red Team Simulation</span>
        </div>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background px-4 py-4 sm:px-6 sm:py-6 md:pt-6 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
