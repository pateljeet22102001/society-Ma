import { LoginForm } from "@/components/auth/login-form";
import { APP_NAME } from "@/lib/constants";

export const metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_40%),radial-gradient(circle_at_bottom_right,#e0f2fe,transparent_35%),linear-gradient(180deg,#f8fbff,#eef4ff)]">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-size-[24px_24px]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-10 sm:px-6">
        <div className="w-full rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(29,78,216,0.12)] backdrop-blur sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white shadow-md">
              SM
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {APP_NAME}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to manage wings, flats, income, expenses, and maintenance.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
