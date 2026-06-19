"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { BottomNav } from "@/components/shared/BottomNav";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { type SponsorRole, ROLE_ORDER, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/sponsorRoles";

type Sponsor = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: SponsorRole;
  confirmed: boolean;
  notes: string | null;
};

const ROLE_GROUP_LABELS: Record<SponsorRole, string> = {
  ...ROLE_LABELS,
  principal: "Principal Sponsors",
  bridesmaid: "Bridesmaids",
  groomsman: "Groomsmen",
};

export default function EntouragePage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;
    const { data } = await supabase.from("sponsors").select("*").eq("wedding_id", w.id).order("role").order("name");
    setSponsors((data ?? []) as Sponsor[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirmed = sponsors.filter((s) => s.confirmed).length;
  const grouped = ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_GROUP_LABELS[role],
    desc: ROLE_DESCRIPTIONS[role],
    items: sponsors.filter((s) => s.role === role),
  }));

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">

        {/* Header */}
        <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10 flex items-center gap-3">
          <Link href="/more" className="text-accent text-sm">← More</Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl">Entourage</h1>
            {!loading && (
              <p className="text-xs text-muted-fg">{confirmed} of {sponsors.length} confirmed</p>
            )}
          </div>
        </div>

        <div className="px-4 py-4 space-y-6">
          {loading ? (
            <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
          ) : (
            grouped.map(({ role, label, desc, items }) => (
              <div key={role}>
                <div className="mb-1">
                  <h2 className="text-xs uppercase tracking-widest text-accent font-semibold">{label}</h2>
                  <p className="text-[11px] text-muted-fg mt-0.5">{desc}</p>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-4 text-center">
                    <p className="text-xs text-muted-fg">No one added yet</p>
                  </div>
                ) : (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {items.map((sponsor) => (
                      <div key={sponsor.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                          sponsor.confirmed ? "bg-accent text-accent-fg" : "bg-terra-100 text-terra-700"
                        )}>
                          {sponsor.confirmed ? "✓" : sponsor.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{sponsor.name}</p>
                          {sponsor.phone && <p className="text-xs text-muted-fg">{sponsor.phone}</p>}
                          {sponsor.notes && <p className="text-xs text-muted-fg italic truncate">{sponsor.notes}</p>}
                        </div>
                        <Badge variant={sponsor.confirmed ? "success" : "secondary"}>
                          {sponsor.confirmed ? "Confirmed" : "Pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
