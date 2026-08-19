import { Inbox } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-3 py-6 text-center sm:px-4 sm:py-10">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 sm:mb-4 sm:h-12 sm:w-12">
        <Inbox className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-xs text-slate-500 sm:text-sm">{description}</p> : null}
      {action ? <div className="mt-3 sm:mt-4">{action}</div> : null}
    </div>
  );
}
