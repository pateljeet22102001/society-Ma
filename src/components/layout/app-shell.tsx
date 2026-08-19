"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { SessionGuard } from "@/components/auth/session-guard";

interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
  userName?: string | null;
  societyName?: string;
}

export function AppShell({ children, userEmail, userName, societyName }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface text-slate-900">
      <SessionGuard />
      <Sidebar
        open={mobileOpen}
        collapsed={collapsed}
        onClose={() => setMobileOpen(false)}
        societyName={societyName}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          userEmail={userEmail}
          userName={userName}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-x-hidden px-3 py-3 pb-6 sm:px-5 sm:py-5 lg:px-8 lg:py-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
