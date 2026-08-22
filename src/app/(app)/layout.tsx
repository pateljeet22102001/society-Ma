import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, getPrimarySociety } from "@/lib/society";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [user, society] = await Promise.all([getCurrentUser(), getPrimarySociety()]);

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

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
