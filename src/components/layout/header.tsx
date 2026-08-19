"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/utils";
import { Breadcrumb } from "./breadcrumb";
import { GlobalSearch } from "./global-search";

interface HeaderProps {
  userEmail?: string | null;
  userName?: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
}

export function Header({
  userEmail,
  userName,
  collapsed,
  onToggleCollapse,
  onOpenMobile,
}: HeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      localStorage.removeItem("society:session-started");
      localStorage.removeItem("society:last-activity");
      toast.success("Logged out successfully");
      router.push("/login");
      router.refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to logout"));
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onOpenMobile}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={onToggleCollapse}
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>
          <div className="hidden min-w-0 max-w-[180px] lg:block xl:max-w-xs">
            <Breadcrumb />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <GlobalSearch />
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex max-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:bg-slate-50 sm:max-w-xs"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium text-slate-800">
                {userName || "Admin"}
              </p>
              <p className="truncate text-xs text-slate-500">{userEmail}</p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>

          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close profile menu"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <div className="border-b border-slate-100 px-3 py-2 sm:hidden">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {userName || "Admin"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{userEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
