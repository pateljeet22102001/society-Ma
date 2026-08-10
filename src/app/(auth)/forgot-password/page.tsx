import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { APP_NAME } from "@/lib/constants";

export const metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return (
    <div className="relative min-h-screen bg-[linear-gradient(180deg,#f8fbff,#eef4ff)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-white">
              SM
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Reset Password</h1>
            <p className="mt-2 text-sm text-slate-500">
              Enter your email to receive a reset link for {APP_NAME}.
            </p>
          </div>
          <ForgotPasswordForm />
          <p className="mt-6 text-center text-sm text-slate-500">
            Remembered your password?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
