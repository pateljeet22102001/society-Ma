import { PageHeader } from "@/components/ui/page-header";
import { EventManager } from "@/components/events/event-manager";
import { createClient } from "@/lib/supabase/server";
import { getPrimarySociety } from "@/lib/society";

export const metadata = { title: "Event Hisab" };
export default async function EventsPage() {
  const supabase = await createClient();
  const society = await getPrimarySociety();
  const [events, flatContributions, aavak, expenses] = society ? await Promise.all([
    supabase.from("events").select("*").eq("society_id", society.id).order("event_year", { ascending: false }),
    supabase.from("event_flat_contributions").select("*, flat:flats(*)").eq("society_id", society.id).order("created_at"),
    supabase.from("event_contributions").select("*").eq("society_id", society.id).order("contribution_date", { ascending: false }),
    supabase.from("event_expenses").select("*").eq("society_id", society.id).order("expense_date", { ascending: false }),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  return <div className="space-y-4 sm:space-y-6">
    <PageHeader title="Event Hisab" description="Manage flat contributions, money and item Aavak, expenses, and event balance." />
    <EventManager events={events.data || []} flatContributions={flatContributions.data || []} aavak={aavak.data || []} expenses={expenses.data || []} />
  </div>;
}
