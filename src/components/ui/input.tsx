import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, leftIcon, rightSlot, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="w-full space-y-1.5">
        {label ? (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
            {label}
          </label>
        ) : null}
        <div className="relative">
          {leftIcon ? (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              {leftIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50",
              leftIcon && "pl-10",
              rightSlot && "pr-12",
              error && "border-rose-400 focus:border-rose-500 focus:ring-rose-200",
              className,
            )}
            {...props}
          />
          {rightSlot ? (
            <div className="absolute inset-y-0 right-2 flex items-center">{rightSlot}</div>
          ) : null}
        </div>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {!error && hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
    );
  },
);
Input.displayName = "Input";
