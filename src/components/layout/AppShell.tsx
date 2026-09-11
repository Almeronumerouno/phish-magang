"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopAppBar } from "@/components/layout/TopAppBar";
import { useAuth } from "@/lib/auth-context";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/campaigns",
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
        aria-label="Loading"
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

  if (!ready) {
    return <AuthLoading />;
  }

  if (isAuthRoute) {
    if (user) return <AuthLoading />;
    return (
      <div className="h-full w-full overflow-y-auto bg-background">
        {children}
      </div>
    );
  }

  if (isProtectedRoute && !user) {
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
        <TopAppBar onMenuToggle={() => setIsMobileMenuOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background px-4 py-4 sm:px-6 sm:py-6 md:pt-6 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
