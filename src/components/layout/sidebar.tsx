"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  FileBarChart,
  Home,
  Layers,
  LayoutDashboard,
  Settings,
  TrendingDown,
  TrendingUp,
  Wallet,
  CalendarHeart,
  X,
} from "lucide-react";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const icons = {
  LayoutDashboard,
  Building2,
  Layers,
  Home,
  TrendingUp,
  TrendingDown,
  Wallet,
  CalendarHeart,
  FileBarChart,
  Settings,
};

interface SidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  societyName?: string;
}

export function Sidebar({ open, collapsed, onClose, societyName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "lg:w-[88px]" : "lg:w-[260px]",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-3 border-b border-slate-100 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm">
              SM
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{APP_NAME}</p>
                <p className="truncate text-xs text-slate-500">
                  {societyName || "Society Admin"}
                </p>
              </div>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = icons[item.icon];
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  collapsed && "lg:justify-center lg:px-2",
                )}
                title={item.label}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
