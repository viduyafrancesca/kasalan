"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { BottomNav } from "@/components/shared/BottomNav";
import { formatPHP } from "@/lib/utils";
import Link from "next/link";
import { type VendorCategory, CATEGORY_LABELS, getActiveCategories } from "@/lib/categories";

type Lineup = { id: string; name: string };
type PickRow = { lineup_id: string; category: string; vendor_id: string };
type Vendor = { id: string; name: string; price_range_min: string | null; price_range_max: string | null };

export default function SupplierLineupComparePage() {
  const [loading, setLoading] = useState(true);
  const [activeCategories, setActiveCategories] = useState<VendorCategory[]>([]);
  const [lineups, setLineups] = useState<Lineup[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;

    const hidden = (w.hidden_vendor_categories ?? []) as VendorCategory[];
    setActiveCategories(getActiveCategories(hidden));

    const { data: lineupsData } = await supabase
      .from("supplier_lineups")
      .select("id, name")
      .eq("wedding_id", w.id)
      .order("created_at", { ascending: false });
    const ls = (lineupsData ?? []) as Lineup[];
    setLineups(ls);

    const { data: vendorsData } = await supabase
      .from("vendors")
      .select("id, name, price_range_min, price_range_max")
      .eq("wedding_id", w.id);
    setVendors((vendorsData ?? []) as Vendor[]);

    if (ls.length === 0) {
      setPicks([]);
      setLoading(false);
      return;
    }

    const { data: picksData } = await supabase
      .from("supplier_lineup_picks")
      .select("lineup_id, category, vendor_id")
      .in("lineup_id", ls.map((l) => l.id));
    setPicks((picksData ?? []) as PickRow[]);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const pickMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const p of picks) {
      const inner = map.get(p.lineup_id) ?? new Map<string, string>();
      map.set(p.lineup_id, inner);
      inner.set(p.category, p.vendor_id);
    }
    return map;
  }, [picks]);

  function totalLabel(lineupId: string) {
    const categoryMap = pickMap.get(lineupId);
    if (!categoryMap) return "—";
    let min = 0, max = 0, hasPrice = false;
    const seen = new Set<string>();
    for (const vendorId of categoryMap.values()) {
      if (seen.has(vendorId)) continue;
      seen.add(vendorId);
      const v = vendorMap.get(vendorId);
      if (!v) continue;
      if (v.price_range_min) { min += Number(v.price_range_min); hasPrice = true; }
      if (v.price_range_max) { max += Number(v.price_range_max); hasPrice = true; }
    }
    return hasPrice ? `${formatPHP(min)} – ${formatPHP(max)}` : "—";
  }

  function cellLabel(lineupId: string, cat: VendorCategory) {
    const vendorId = pickMap.get(lineupId)?.get(cat);
    if (!vendorId) return "—";
    const v = vendorMap.get(vendorId);
    return v ? v.name : "—";
  }

  return (
    <div className="flex flex-col min-h-screen max-w-2xl lg:max-w-5xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">

        <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10 flex items-center gap-3">
          <Link href="/more/supplier-lineup" className="text-accent text-sm">← Lineups</Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl">Compare Lineups</h1>
          </div>
        </div>

        <div className="px-4 py-4">
          {loading ? (
            <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
          ) : lineups.length < 2 ? (
            <div className="rounded-xl border border-dashed border-border py-8 text-center px-4">
              <p className="text-sm text-muted-fg mb-2">Create at least 2 lineups to compare.</p>
              <Link href="/more/supplier-lineup" className="text-xs text-accent hover:underline">
                Go to Supplier Lineup →
              </Link>
            </div>
          ) : (
            <>
              <div className="flex gap-3 overflow-x-auto pb-1 mb-3">
                <div className="w-28 flex-shrink-0" />
                {lineups.map((l) => (
                  <div key={l.id} className="min-w-40 flex-shrink-0 bg-terra-100 rounded-xl px-4 py-3">
                    <Link href={`/more/supplier-lineup/${l.id}`} className="text-sm font-semibold text-accent hover:underline">
                      {l.name}
                    </Link>
                    <p className="text-base font-bold mt-0.5">{totalLabel(l.id)}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="min-w-full text-sm border-collapse">
                  <tbody>
                    {activeCategories.map((cat) => (
                      <tr key={cat}>
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-semibold text-muted-fg border-b border-border">
                          {CATEGORY_LABELS[cat]}
                        </td>
                        {lineups.map((l) => (
                          <td key={l.id} className="px-3 py-2 border-b border-border border-l border-border whitespace-nowrap">
                            {cellLabel(l.id, cat)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
