import { PageHeader } from "@/components/ui/page-header";
import { SettingsForms } from "@/components/settings/settings-forms";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();

  const { data: maintenance } = society
    ? await supabase
        .from("maintenance_settings")
        .select("*")
        .eq("society_id", society.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure society profile and default maintenance rules."
      />
      <SettingsForms society={society} maintenance={maintenance} />
    </div>
  );
}
