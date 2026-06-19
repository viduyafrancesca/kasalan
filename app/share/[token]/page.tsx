import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { notFound } from "next/navigation";
import { daysUntil } from "@/lib/utils";
import { monthLabel, MONTH_BUCKETS } from "@/lib/checklist/generateChecklist";
import { type GuestRsvpLike, countAttendingPlusOnes } from "@/lib/guests";
import { type SponsorRole, ROLE_LABELS } from "@/lib/sponsorRoles";
import { Badge } from "@/components/ui/badge";

type PersonStatus = "attending" | "pending" | "declined";

type PersonRow = {
  id: string;
  name: string;
  roleLabel: string;
  status: PersonStatus;
};

const STATUS_VARIANT: Record<PersonStatus, "success" | "destructive" | "secondary"> = {
  attending: "success",
  declined:  "destructive",
  pending:   "secondary",
};

export default async function ShareViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createServiceRoleClient();

  const { data: shareToken } = await supabase
    .from("share_tokens")
    .select("wedding_id, expires_at")
    .eq("token", token)
    .single();

  if (!shareToken) notFound();
  if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) notFound();

  const weddingId = shareToken.wedding_id;

  const [
    { data: wedding },
    { data: items },
    { data: guests },
    { data: sponsors },
  ] = await Promise.all([
    supabase.from("weddings").select("*").eq("id", weddingId).single(),
    supabase.from("checklist_items").select("*").eq("wedding_id", weddingId).order("months_before", { ascending: false }),
    supabase.from("guests").select("id, name, rsvp_status, plus_one").eq("wedding_id", weddingId),
    supabase.from("sponsors").select("id, name, role, confirmed").eq("wedding_id", weddingId),
  ]);

  if (!wedding) notFound();

  const days = wedding.wedding_date ? daysUntil(wedding.wedding_date) : null;
  const allItems = items ?? [];
  const done = allItems.filter((i) => i.completed).length;
  const totalGuests =
    (guests ?? []).filter((g) => g.rsvp_status !== "declined").length +
    countAttendingPlusOnes((guests ?? []) as GuestRsvpLike[]) +
    (sponsors ?? []).length;
  const attending = (guests ?? []).filter((g) => g.rsvp_status === "attending").length;

  const guestRows: PersonRow[] = (guests ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    roleLabel: "Guest",
    status: g.rsvp_status as PersonStatus,
  }));

  const sponsorRows: PersonRow[] = (sponsors ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    roleLabel: ROLE_LABELS[s.role as SponsorRole],
    status: s.confirmed ? "attending" : "pending",
  }));

  const people = [...guestRows, ...sponsorRows].sort((a, b) => a.name.localeCompare(b.name));

  const grouped = MONTH_BUCKETS.map((m) => ({
    label: monthLabel(m),
    items: allItems.filter((i) => Number(i.months_before) === m),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="min-h-screen max-w-lg mx-auto">
      <div className="bg-accent px-5 py-5 text-accent-fg">
        <p className="text-[10px] uppercase tracking-widest opacity-75">
          {wedding.couple_name_1} &amp; {wedding.couple_name_2}
        </p>
        <p className="font-display text-2xl mt-1">
          {days !== null && days > 0 ? `${days} days to go 🤍` : "Wedding Day! 🎉"}
        </p>
        <p className="text-xs opacity-60 mt-1">View-only — shared with you by the couple</p>
      </div>

      <div className="px-4 py-4 grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="font-display text-xl text-accent">{done}/{allItems.length}</div>
          <div className="text-[10px] text-muted-fg uppercase tracking-wide">Tasks</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="font-display text-xl text-accent">{totalGuests}</div>
          <div className="text-[10px] text-muted-fg uppercase tracking-wide">Total Guests</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-3 text-center">
          <div className="font-display text-xl text-accent">{attending}</div>
          <div className="text-[10px] text-muted-fg uppercase tracking-wide">RSVPs</div>
        </div>
      </div>

      <div className="px-4 pb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-lg">Guests &amp; Entourage</h2>
          <span className="text-xs text-muted-fg">{people.length}</span>
        </div>
        {people.length === 0 ? (
          <p className="text-sm text-muted-fg">No guests added yet.</p>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {people.map((person) => (
              <div key={person.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                <span className="text-sm flex-1 min-w-0 truncate">{person.name}</span>
                <span className="text-xs text-muted-fg w-20 flex-shrink-0 truncate">{person.roleLabel}</span>
                <Badge variant={STATUS_VARIANT[person.status]}>{person.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-8">
        <h2 className="font-display text-lg mb-3">Planning Progress</h2>
        {grouped.map((group) => {
          const groupDone = group.items.filter((i) => i.completed).length;
          return (
            <div key={group.label} className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="uppercase tracking-widest text-accent font-medium">{group.label}</span>
                <span className="text-muted-fg">{groupDone}/{group.items.length}</span>
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {group.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0">
                    <span className={item.completed ? "text-accent" : "text-muted-fg"}>
                      {item.completed ? "✓" : "○"}
                    </span>
                    <span className={`text-sm ${item.completed ? "line-through text-muted-fg" : ""}`}>
                      {item.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
