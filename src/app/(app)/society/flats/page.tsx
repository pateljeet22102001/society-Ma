import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { FlatsManager } from "@/components/society/flats-manager";
import { PageSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Flats" };

export default async function FlatsPage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();

  const [{ data: flats }, { data: wings }] = society
    ? await Promise.all([
        supabase
          .from("flats")
          .select("*, wing:wings(*)")
          .eq("society_id", society.id)
          .order("flat_number", { ascending: true }),
        supabase
          .from("wings")
          .select("*")
          .eq("society_id", society.id)
          .order("name", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flat Management"
        description="Manage owners, residents, occupancy, and flat status."
      />
      <Suspense fallback={<PageSkeleton />}>
        <FlatsManager flats={flats || []} wings={wings || []} />
      </Suspense>
    </div>
  );
}
