import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CountdownBanner } from "@/components/shared/CountdownBanner";
import { StatCard } from "@/components/shared/StatCard";
import { formatPHP } from "@/lib/utils";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wedding } = await supabase
    .from("weddings")
    .select("*")
    .or(`owner_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!wedding) redirect("/setup");

  const [
    { count: totalTasks },
    { count: doneTasks },
    { data: budgetItems },
    { count: attendingGuests },
    { count: confirmedSponsors },
    { data: upNext },
  ] = await Promise.all([
    supabase.from("checklist_items").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("checklist_items").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("completed", true),
    supabase.from("budget_items").select("estimated_amount, paid_amount").eq("wedding_id", wedding.id),
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("rsvp_status", "attending"),
    supabase.from("sponsors").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("confirmed", true),
    supabase.from("checklist_items")
      .select("id, title, category, months_before")
      .eq("wedding_id", wedding.id)
      .eq("completed", false)
      .order("months_before", { ascending: true })
      .limit(4),
  ]);

  const totalBudget = Number(wedding.budget_total ?? 0);
  const totalSpent  = (budgetItems ?? []).reduce((s, b) => s + Number(b.paid_amount ?? 0), 0);
  const remaining   = totalBudget - totalSpent;

  return (
    <div>
      <CountdownBanner
        coupleName1={wedding.couple_name_1}
        coupleName2={wedding.couple_name_2}
        weddingDate={wedding.wedding_date}
        ceremonyVenue={wedding.ceremony_venue}
      />

      <div className="px-4 py-4 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={`${doneTasks ?? 0}/${totalTasks ?? 0}`} label="Tasks Done" />
          <StatCard value={totalBudget > 0 ? formatPHP(remaining) : "—"} label="Budget Left" />
          <StatCard value={attendingGuests ?? 0} label="RSVPs" />
          <StatCard value={confirmedSponsors ?? 0} label="Sponsors" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg">Up Next</h2>
            <Link href="/checklist" className="text-xs text-accent">See all →</Link>
          </div>
          <div className="space-y-2">
            {(upNext ?? []).length === 0 ? (
              <p className="text-sm text-muted-fg text-center py-6">All tasks complete! 🎉</p>
            ) : (
              (upNext ?? []).map((item) => (
                <div key={item.id} className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-fg">{item.category}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
