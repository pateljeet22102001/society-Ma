"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const IDLE_LIMIT_MS = 30 * 60 * 1000;
const WARNING_MS = 2 * 60 * 1000;
const MAX_SESSION_MS = 8 * 60 * 60 * 1000;
const LAST_ACTIVITY_KEY = "society:last-activity";
const SESSION_STARTED_KEY = "society:session-started";

export function SessionGuard() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const loggingOut = useRef(false);

  const logout = useCallback(async (reason: "idle" | "maximum") => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(SESSION_STARTED_KEY);
    localStorage.setItem("society:logout-message", reason === "idle" ? "Session expired after 30 minutes of inactivity." : "Please sign in again after 8 hours.");
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }, [router]);

  useEffect(() => {
    const now = Date.now();
    if (!localStorage.getItem(SESSION_STARTED_KEY)) localStorage.setItem(SESSION_STARTED_KEY, String(now));
    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) localStorage.setItem(LAST_ACTIVITY_KEY, String(now));

    let lastWrite = 0;
    const recordActivity = () => {
      const current = Date.now();
      if (current - lastWrite < 1000) return;
      lastWrite = current;
      localStorage.setItem(LAST_ACTIVITY_KEY, String(current));
      setSecondsLeft(null);
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));

    const timer = window.setInterval(() => {
      const current = Date.now();
      const started = Number(localStorage.getItem(SESSION_STARTED_KEY) || current);
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || current);
      if (current - started >= MAX_SESSION_MS) void logout("maximum");
      else if (current - lastActivity >= IDLE_LIMIT_MS) void logout("idle");
      else {
        const remaining = IDLE_LIMIT_MS - (current - lastActivity);
        setSecondsLeft(remaining <= WARNING_MS ? Math.ceil(remaining / 1000) : null);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, recordActivity));
    };
  }, [logout]);

  if (secondsLeft === null) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-amber-200 bg-white p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="font-semibold text-slate-900">Session expiring soon</p>
          <p className="mt-1 text-sm text-slate-600">You will be logged out in {Math.ceil(secondsLeft / 60)} minute(s) due to inactivity.</p>
          <Button className="mt-3" size="sm" onClick={() => {
            localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
            setSecondsLeft(null);
          }}>Continue session</Button>
        </div>
      </div>
    </div>
  );
}
