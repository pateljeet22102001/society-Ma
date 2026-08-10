import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, society] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    getPrimarySociety(),
  ]);

  return (
    <AppShell
      userEmail={user.email}
      userName={profile?.full_name || user.email?.split("@")[0]}
      societyName={society?.name}
    >
      {children}
    </AppShell>
  );
}
