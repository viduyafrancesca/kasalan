import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChecklistGroup } from "@/components/checklist/ChecklistGroup";
import { BottomNav } from "@/components/shared/BottomNav";
import { groupByTimeline } from "@/lib/checklist/generateChecklist";
import type { ChecklistItem } from "@/lib/db/schema";

export default async function ChecklistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: wedding } = await supabase
    .from("weddings")
    .select("id, couple_name_1, couple_name_2, wedding_date")
    .or(`owner_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!wedding) redirect("/setup");

  const { data: items } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("wedding_id", wedding.id)
    .order("months_before", { ascending: false });

  const allItems = (items ?? []) as ChecklistItem[];
  const done = allItems.filter((i) => i.completed).length;

  const grouped = groupByTimeline(allItems, wedding.wedding_date);

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <div className="flex-1 pb-20">
        <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10">
          <h1 className="font-display text-2xl">Checklist</h1>
          <p className="text-sm text-muted-fg mt-0.5">{done} of {allItems.length} tasks complete</p>
        </div>
        <div className="px-4 py-4">
          {grouped.length === 0 ? (
            <p className="text-center text-muted-fg py-12">No tasks yet. Complete setup to generate your checklist.</p>
          ) : (
            grouped.map((group) => (
              <ChecklistGroup key={group.label} label={group.label} items={group.items} />
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
