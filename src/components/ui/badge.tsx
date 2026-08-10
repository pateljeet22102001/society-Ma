import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-sky-50 text-sky-700",
  primary: "bg-primary/10 text-primary",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: keyof typeof styles;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize",
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusBadgeVariant(status: string) {
  switch (status) {
    case "active":
    case "paid":
      return "success" as const;
    case "pending":
    case "partially_paid":
      return "warning" as const;
    case "inactive":
    case "overdue":
      return "danger" as const;
    case "vacant":
      return "default" as const;
    default:
      return "info" as const;
  }
}
