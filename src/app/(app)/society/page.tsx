import Link from "next/link";
import { Building2, Home, Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Society" };

export default async function SocietyPage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();

  const [{ count: wingsCount }, { count: flatsCount }, { count: activeFlats }] = await Promise.all([
    supabase.from("wings").select("*", { count: "exact", head: true }).eq("society_id", society?.id || ""),
    supabase.from("flats").select("*", { count: "exact", head: true }).eq("society_id", society?.id || ""),
    supabase
      .from("flats")
      .select("*", { count: "exact", head: true })
      .eq("society_id", society?.id || "")
      .eq("status", "active"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Society Setup"
        description="Manage society structure: wings and flats."
        actions={
          <Link href="/settings">
            <Button variant="outline">Society Settings</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">
            {society?.name || "Society not configured"}
          </h2>
          <p className="text-sm text-slate-500">
            {society
              ? [society.address, society.city, society.state, society.pin_code].filter(Boolean).join(", ") ||
                "Address not set"
              : "Go to Settings and create your society profile first."}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile icon={Layers} label="Wings" value={String(wingsCount || 0)} href="/society/wings" />
        <SummaryTile icon={Home} label="Total Flats" value={String(flatsCount || 0)} href="/society/flats" />
        <SummaryTile icon={Building2} label="Active Flats" value={String(activeFlats || 0)} href="/society/flats" />
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Home;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition hover:border-primary/30"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Link>
  );
}
