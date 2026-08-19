import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { WingsManager } from "@/components/society/wings-manager";
import { PageSkeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Wings" };

export default async function WingsPage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();

  const { data: wings } = society
    ? await supabase
        .from("wings")
        .select("*")
        .eq("society_id", society.id)
        .order("name", { ascending: true })
    : { data: [] };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Wing Management"
        description="Create wings and auto-generate flats like A-01 to A-20."
      />
      <Suspense fallback={<PageSkeleton />}>
        <WingsManager wings={wings || []} />
      </Suspense>
    </div>
  );
}
