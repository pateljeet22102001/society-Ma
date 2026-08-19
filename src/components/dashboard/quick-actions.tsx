import Link from "next/link";
import { Building2, Home, PlusCircle, TrendingDown, TrendingUp, Wallet } from "lucide-react";

const actions = [
  { href: "/income?new=1", label: "Add Income", icon: TrendingUp },
  { href: "/expenses?new=1", label: "Add Expense", icon: TrendingDown },
  { href: "/maintenance?pay=1", label: "Add Maintenance Payment", icon: Wallet },
  { href: "/society/wings?new=1", label: "Add Wing", icon: Building2 },
  { href: "/society/flats?new=1", label: "Add Flat", icon: Home },
];

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-soft transition hover:border-primary/30 hover:bg-primary/5 sm:px-4 sm:py-3"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-sm font-medium text-slate-800">{action.label}</span>
            <PlusCircle className="ml-auto h-4 w-4 text-slate-300" />
          </Link>
        );
      })}
    </div>
  );
}
