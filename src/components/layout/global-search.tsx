"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarHeart, Loader2, Receipt, Search, TrendingDown, Wallet, X } from "lucide-react";
import { searchGlobalAction, type GlobalSearchHit, type GlobalSearchHitType } from "@/lib/actions/search";
import { cn } from "@/lib/utils";

const TYPE_META: Record<
  GlobalSearchHitType,
  { label: string; icon: typeof Search; className: string }
> = {
  flat: { label: "Flat", icon: Building2, className: "bg-sky-50 text-sky-700" },
  income: { label: "Income", icon: Receipt, className: "bg-emerald-50 text-emerald-700" },
  expense: { label: "Expense", icon: TrendingDown, className: "bg-rose-50 text-rose-700" },
  maintenance: { label: "Maintenance", icon: Wallet, className: "bg-amber-50 text-amber-700" },
  event: { label: "Event Hisab", icon: CalendarHeart, className: "bg-violet-50 text-violet-700" },
};

export function GlobalSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchHit[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runSearch = useEffectEvent((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setMessage(null);
      return;
    }

    startTransition(async () => {
      const result = await searchGlobalAction(trimmed);
      if (!result.success) {
        setResults([]);
        setMessage(result.message || "Search failed");
        return;
      }
      setMessage(null);
      setResults(result.results || []);
    });
  });

  useEffect(() => {
    const timer = window.setTimeout(() => runSearch(query), 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function goTo(hit: GlobalSearchHit) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(hit.href);
  }

  const showPanel = open && (query.trim().length > 0 || pending);

  return (
    <div ref={rootRef} className="relative w-full max-w-md flex-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search flats, owners, receipts, events…"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-16 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
          aria-label="Global search"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setMessage(null);
                inputRef.current?.focus();
              }}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
              Ctrl K
            </kbd>
          )}
        </div>
      </div>

      {showPanel ? (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl sm:left-auto sm:right-0 sm:w-[28rem]">
          {pending ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </div>
          ) : null}

          {!pending && message ? (
            <p className="px-3 py-4 text-sm text-rose-600">{message}</p>
          ) : null}

          {!pending && !message && query.trim() && results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">No matches for “{query.trim()}”.</p>
          ) : null}

          {!pending && results.length > 0 ? (
            <ul className="space-y-1">
              {results.map((hit) => {
                const meta = TYPE_META[hit.type];
                const Icon = meta.icon;
                return (
                  <li key={hit.id}>
                    <button
                      type="button"
                      onClick={() => goTo(hit)}
                      className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          meta.className,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900">{hit.title}</span>
                          {hit.amountLabel ? (
                            <span className="shrink-0 text-xs font-medium text-slate-600">{hit.amountLabel}</span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{hit.subtitle}</span>
                        <span className="mt-1 inline-flex text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {meta.label}
                          {hit.type === "flat" ? " • Past records" : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
