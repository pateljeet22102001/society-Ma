import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { MaintenanceManager } from "@/components/maintenance/maintenance-manager";
import { PageSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Maintenance" };

export default async function MaintenancePage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();

  const [{ data: bills }, { data: flats }, { data: wings }, { data: settings }] = society
    ? await Promise.all([
        supabase
          .from("maintenance_bills")
          .select("*, flat:flats(*)")
          .eq("society_id", society.id)
          .order("bill_year", { ascending: false })
          .order("bill_month", { ascending: false }),
        supabase
          .from("flats")
          .select("*")
          .eq("society_id", society.id)
          .order("flat_number"),
        supabase
          .from("wings")
          .select("*")
          .eq("society_id", society.id)
          .order("name"),
        supabase
          .from("maintenance_settings")
          .select("*")
          .eq("society_id", society.id)
          .maybeSingle(),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: null },
      ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Generate flat-wise monthly bills, collect payments, and track dues."
      />
      <Suspense fallback={<PageSkeleton />}>
        <MaintenanceManager
          society={society}
          bills={bills || []}
          flats={flats || []}
          wings={wings || []}
          settings={settings}
        />
      </Suspense>
    </div>
  );
}
