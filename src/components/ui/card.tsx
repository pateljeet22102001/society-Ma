import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/80 bg-white shadow-soft", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-slate-500 sm:mt-1 sm:text-sm">{description}</p> : null}
      </div>
      {action ? <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-3 sm:p-5", className)}>{children}</div>;
}
