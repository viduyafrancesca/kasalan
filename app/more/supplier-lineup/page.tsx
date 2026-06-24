"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { BottomNav } from "@/components/shared/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPHP } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";

type Lineup = { id: string; name: string; created_at: string };
type Pick = { lineup_id: string; vendor_id: string };
type VendorPrice = { id: string; price_range_min: string | null; price_range_max: string | null };
type Total = { min: number; max: number; hasPrice: boolean };

export default function SupplierLineupListPage() {
  const router = useRouter();
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [totals, setTotals] = useState<Record<string, Total>>({});
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;
    setWeddingId(w.id);

    const { data: lineupsData } = await supabase
      .from("supplier_lineups")
      .select("id, name, created_at")
      .eq("wedding_id", w.id)
      .order("created_at", { ascending: false });
    const ls = (lineupsData ?? []) as Lineup[];
    setLineups(ls);

    if (ls.length === 0) {
      setTotals({});
      setLoading(false);
      return;
    }

    const { data: vendorsData } = await supabase
      .from("vendors")
      .select("id, price_range_min, price_range_max")
      .eq("wedding_id", w.id);
    const vendorMap = new Map((vendorsData ?? []).map((v: VendorPrice) => [v.id, v]));

    const { data: picksData } = await supabase
      .from("supplier_lineup_picks")
      .select("lineup_id, vendor_id")
      .in("lineup_id", ls.map((l) => l.id));
    const picks = (picksData ?? []) as Pick[];

    const next: Record<string, Total> = {};
    for (const l of ls) next[l.id] = { min: 0, max: 0, hasPrice: false };
    for (const p of picks) {
      const v = vendorMap.get(p.vendor_id);
      const entry = next[p.lineup_id];
      if (!v || !entry) continue;
      if (v.price_range_min) { entry.min += Number(v.price_range_min); entry.hasPrice = true; }
      if (v.price_range_max) { entry.max += Number(v.price_range_max); entry.hasPrice = true; }
    }
    setTotals(next);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function totalLabel(lineupId: string) {
    const t = totals[lineupId];
    if (!t || !t.hasPrice) return "No estimate yet";
    return `${formatPHP(t.min)} – ${formatPHP(t.max)}`;
  }

  function dateLabel(iso: string) {
    return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }

  async function createLineup() {
    if (!weddingId || !newName.trim()) return;
    setCreating(true);
    const { data } = await supabase
      .from("supplier_lineups")
      .insert({ wedding_id: weddingId, name: newName.trim() })
      .select()
      .single();
    setCreating(false);
    setOpen(false);
    setNewName("");
    if (data) router.push(`/more/supplier-lineup/${data.id}`);
  }

  async function deleteLineup(id: string) {
    if (!window.confirm("Delete this lineup? This cannot be undone.")) return;
    await supabase.from("supplier_lineups").delete().eq("id", id);
    load();
  }

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">

        <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10 flex items-center gap-3">
          <Link href="/more" className="text-accent text-sm">← More</Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl">Supplier Lineup</h1>
          </div>
        </div>

        <div className="px-4 py-4">
          {loading ? (
            <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
          ) : lineups.length === 0 ? (
            <p className="text-center text-muted-fg py-12 text-sm">
              No lineups yet — create one to start comparing a full wedding combination.
            </p>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {lineups.map((lineup) => (
                <div key={lineup.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                  <button
                    onClick={() => router.push(`/more/supplier-lineup/${lineup.id}`)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm font-medium">{lineup.name}</p>
                    <p className="text-xs text-muted-fg">{totalLabel(lineup.id)} · {dateLabel(lineup.created_at)}</p>
                  </button>
                  <button
                    onClick={() => deleteLineup(lineup.id)}
                    aria-label={`Delete ${lineup.name}`}
                    className="text-muted-fg hover:text-red-600 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New lineup</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Lineup name</Label>
              <Input
                placeholder="e.g. Budget option"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <Button className="w-full" disabled={!newName.trim() || creating} onClick={createLineup}>
              {creating ? "Creating..." : "Create lineup"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-50 w-12 h-12 rounded-full bg-accent text-accent-fg shadow-lg flex items-center justify-center hover:bg-terra-500 transition-colors"
        aria-label="New lineup"
      >
        <Plus className="w-5 h-5" />
      </button>

      <BottomNav />
    </div>
  );
}
