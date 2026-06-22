import { createClient } from "@/lib/supabase/server";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { redirect } from "next/navigation";
import { CountdownBanner } from "@/components/shared/CountdownBanner";
import { StatCard } from "@/components/shared/StatCard";
import { formatPHP } from "@/lib/utils";
import Link from "next/link";
import {
  type Reminder, type DueBudgetRow, type VendorRow,
  buildPaymentReminder, buildRsvpReminder, buildEntourageReminder, buildVendorGapReminder,
} from "@/lib/dashboardReminders";
import { type VendorCategory, getActiveCategories } from "@/lib/categories";
import { type BudgetItemLike, type VendorStatusLike, computeBudgetTotals } from "@/lib/budget";
import { type GuestRsvpLike, countAttendingPlusOnes } from "@/lib/guests";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const wedding = await getWeddingForUser(supabase, user.id);
  if (!wedding) redirect("/setup");

  const [
    { count: totalTasks },
    { count: doneTasks },
    { data: budgetItems },
    { data: dueBudgetItems },
    { count: attendingGuests },
    { count: pendingGuests },
    { data: allGuests },
    { count: totalSponsors },
    { data: unconfirmedSponsors },
    { data: vendors },
    { data: upNext },
    { data: legalItems },
  ] = await Promise.all([
    supabase.from("checklist_items").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("checklist_items").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("completed", true),
    supabase.from("budget_items").select("estimated_amount, paid_amount, vendor_id").eq("wedding_id", wedding.id),
    supabase.from("budget_items").select("label, due_date, estimated_amount, paid_amount, vendor_id").eq("wedding_id", wedding.id).not("due_date", "is", null),
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("rsvp_status", "attending"),
    supabase.from("guests").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id).eq("rsvp_status", "pending"),
    supabase.from("guests").select("rsvp_status, plus_one").eq("wedding_id", wedding.id),
    supabase.from("sponsors").select("*", { count: "exact", head: true }).eq("wedding_id", wedding.id),
    supabase.from("sponsors").select("name").eq("wedding_id", wedding.id).eq("confirmed", false),
    supabase.from("vendors").select("id, name, categories, status").eq("wedding_id", wedding.id),
    supabase.from("checklist_items")
      .select("id, title, category, months_before")
      .eq("wedding_id", wedding.id)
      .eq("completed", false)
      .neq("category", "Legal")
      .order("months_before", { ascending: true })
      .limit(4),
    supabase.from("checklist_items")
      .select("id, title, completed")
      .eq("wedding_id", wedding.id)
      .eq("category", "Legal")
      .order("months_before", { ascending: true }),
  ]);

  const totalBudget = Number(wedding.budget_total ?? 0);
  const budgetTotals = computeBudgetTotals(
    (budgetItems ?? []) as BudgetItemLike[],
    (vendors ?? []) as VendorStatusLike[],
    totalBudget
  );

  const activeCategories = getActiveCategories((wedding.hidden_vendor_categories ?? []) as VendorCategory[]);

  const totalGuests =
    (allGuests ?? []).length +
    countAttendingPlusOnes((allGuests ?? []) as GuestRsvpLike[]) +
    (totalSponsors ?? 0);

  const legalDone = (legalItems ?? []).filter((i) => i.completed).length;

  const reminders = [
    buildPaymentReminder((dueBudgetItems ?? []) as DueBudgetRow[], (vendors ?? []) as VendorRow[]),
    buildRsvpReminder(pendingGuests ?? 0),
    buildEntourageReminder((unconfirmedSponsors ?? []).map((s) => s.name)),
    buildVendorGapReminder((vendors ?? []) as VendorRow[], activeCategories),
  ].filter((r): r is Reminder => r !== null);

  return (
    <div>
      <CountdownBanner
        coupleName1={wedding.couple_name_1}
        coupleName2={wedding.couple_name_2}
        weddingDate={wedding.wedding_date}
        ceremonyVenue={wedding.ceremony_venue}
      />

      <div className="px-4 lg:px-6 py-4 lg:py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard value={`${doneTasks ?? 0}/${totalTasks ?? 0}`} label="Tasks Done" />
          <StatCard value={totalBudget > 0 ? formatPHP(budgetTotals.remaining) : "—"} label="Budget Left" />
          <StatCard value={attendingGuests ?? 0} label="RSVPs" />
          <StatCard value={totalGuests} label="Total Guests" />
        </div>

        {reminders.length > 0 && (
          <div>
            <h2 className="font-display text-lg mb-3">Reminders</h2>
            <div className="space-y-2">
              {reminders.map((r) => (
                <Link
                  key={r.key}
                  href={r.href}
                  className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <p className="text-sm font-medium">{r.text}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {(legalItems ?? []).length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-lg">Legal Requirements</h2>
              <span className="text-xs text-muted-fg">{legalDone}/{legalItems!.length}</span>
            </div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {legalItems!.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${item.completed ? "bg-accent border-accent" : "border-terra-400"}`}>
                    {item.completed && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <p className={`text-sm ${item.completed ? "line-through text-muted-fg" : ""}`}>{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg">Up Next</h2>
            <Link href="/checklist" className="text-xs text-accent">See all →</Link>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {(upNext ?? []).length === 0 ? (
              <p className="text-sm text-muted-fg text-center py-6 lg:col-span-2">All tasks complete! 🎉</p>
            ) : (
              (upNext ?? []).map((item) => (
                <div key={item.id} className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
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
