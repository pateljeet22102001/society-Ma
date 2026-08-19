"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const labels: Record<string, string> = {
  dashboard: "Dashboard",
  society: "Society",
  wings: "Wings",
  flats: "Flats",
  income: "Income",
  expenses: "Expenses",
  maintenance: "Maintenance",
  events: "Event Hisab",
  reports: "Reports",
  settings: "Settings",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function Breadcrumb() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  if (!parts.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      {parts.map((part, index) => {
        const href = "/" + parts.slice(0, index + 1).join("/");
        const isLast = index === parts.length - 1;
        const label = UUID_RE.test(part) ? "History" : labels[part] || part;

        return (
          <div key={href} className="flex min-w-0 items-center gap-1">
            {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" /> : null}
            {isLast ? (
              <span className="truncate font-medium text-slate-800">{label}</span>
            ) : (
              <Link href={href} className="truncate text-slate-500 hover:text-primary">
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
