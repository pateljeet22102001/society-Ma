"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    const message = localStorage.getItem("society:logout-message");
    if (message) {
      localStorage.removeItem("society:logout-message");
      toast.info(message);
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        setServerError(error.message);
        return;
      }
      // This timestamp is intentionally captured after the user-triggered login succeeds.
      // eslint-disable-next-line react-hooks/purity
      const loginTime = Date.now();
      localStorage.setItem("society:session-started", String(loginTime));
      localStorage.setItem("society:last-activity", String(loginTime));
      toast.success("Login successful");
      const candidate = new URLSearchParams(window.location.search).get("redirectTo") || "";
      const redirectTo = candidate.startsWith("/") && !candidate.startsWith("//")
        ? candidate
        : "/dashboard";
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      setServerError(getErrorMessage(error, "Login failed"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input
        label="Email"
        type="email"
        placeholder="admin@society.com"
        autoComplete="email"
        leftIcon={<Mail className="h-4 w-4" />}
        error={errors.email?.message}
        {...register("email")}
      />

      <Input
        label="Password"
        type={showPassword ? "text" : "password"}
        placeholder="Enter your password"
        autoComplete="current-password"
        leftIcon={<Lock className="h-4 w-4" />}
        error={errors.password?.message}
        rightSlot={
          <button
            type="button"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        }
        {...register("password")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
            {...register("rememberMe")}
          />
          Remember Me
        </label>
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          Forgot Password?
        </Link>
      </div>

      {serverError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {serverError}
        </div>
      ) : null}

      <Button type="submit" className="w-full" loading={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Login"}
      </Button>
    </form>
  );
}
