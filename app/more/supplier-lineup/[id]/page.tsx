"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { BottomNav } from "@/components/shared/BottomNav";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatPHP } from "@/lib/utils";
import { Plus, X, Printer } from "lucide-react";
import Link from "next/link";
import { type VendorCategory, CATEGORY_LABELS, getActiveCategories } from "@/lib/categories";

type VendorStatus = "interested" | "shortlisted" | "booked" | "declined";

type Vendor = {
  id: string;
  categories: VendorCategory[];
  name: string;
  contact: string | null;
  price_range_min: string | null;
  price_range_max: string | null;
  status: VendorStatus;
  notes: string | null;
  inclusions: string[];
};

type Lineup = { id: string; wedding_id: string; name: string; created_at: string };
type PickRow = { id: string; lineup_id: string; category: string; vendor_id: string };

const STATUS_LABELS: Record<VendorStatus, string> = {
  interested:  "Interested",
  shortlisted: "Shortlisted",
  booked:      "Booked",
  declined:    "Declined",
};

const STATUS_VARIANT: Record<VendorStatus, "default" | "success" | "secondary" | "destructive"> = {
  interested:  "secondary",
  shortlisted: "default",
  booked:      "success",
  declined:    "destructive",
};

export default function SupplierLineupBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [activeCategories, setActiveCategories] = useState<VendorCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [picks, setPicks] = useState<PickRow[]>([]);
  const [pickerCategory, setPickerCategory] = useState<VendorCategory | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;

    const { data: lineupRow } = await supabase
      .from("supplier_lineups")
      .select("*")
      .eq("id", id)
      .eq("wedding_id", w.id)
      .maybeSingle();

    if (!lineupRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLineup(lineupRow as Lineup);
    setNameInput((lineupRow as Lineup).name);

    const hidden = (w.hidden_vendor_categories ?? []) as VendorCategory[];
    setActiveCategories(getActiveCategories(hidden));

    const { data: vendorsData } = await supabase.from("vendors").select("*").eq("wedding_id", w.id);
    setVendors((vendorsData ?? []) as Vendor[]);

    const { data: picksData } = await supabase.from("supplier_lineup_picks").select("*").eq("lineup_id", id);
    setPicks((picksData ?? []) as PickRow[]);

    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const vendorMap = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors]);

  const picksByCategory = useMemo(() => {
    const map = new Map<string, { pickId: string; vendor: Vendor }>();
    for (const p of picks) {
      if (p.category === "other") continue;
      const vendor = vendorMap.get(p.vendor_id);
      if (vendor) map.set(p.category, { pickId: p.id, vendor });
    }
    return map;
  }, [picks, vendorMap]);

  const otherPicks = useMemo(() => {
    const result: { pickId: string; vendor: Vendor }[] = [];
    for (const p of picks) {
      if (p.category !== "other") continue;
      const vendor = vendorMap.get(p.vendor_id);
      if (vendor) result.push({ pickId: p.id, vendor });
    }
    return result;
  }, [picks, vendorMap]);

  const eligibleByCategory = useMemo(() => {
    const map = new Map<VendorCategory, Vendor[]>();
    const otherPickedIds = new Set(otherPicks.map((p) => p.vendor.id));
    for (const cat of activeCategories) {
      const base = vendors.filter((v) => v.categories.includes(cat) && v.status !== "declined");
      map.set(cat, cat === "other" ? base.filter((v) => !otherPickedIds.has(v.id)) : base);
    }
    return map;
  }, [activeCategories, vendors, otherPicks]);

  const { totalMin, totalMax, hasPrice } = useMemo(() => {
    let min = 0, max = 0, has = false;
    const countedVendorIds = new Set<string>();
    function addVendor(vendor: Vendor) {
      if (countedVendorIds.has(vendor.id)) return;
      countedVendorIds.add(vendor.id);
      if (vendor.price_range_min) { min += Number(vendor.price_range_min); has = true; }
      if (vendor.price_range_max) { max += Number(vendor.price_range_max); has = true; }
    }
    for (const cat of activeCategories) {
      if (cat === "other") continue;
      const pick = picksByCategory.get(cat);
      if (pick) addVendor(pick.vendor);
    }
    for (const p of otherPicks) addVendor(p.vendor);
    return { totalMin: min, totalMax: max, hasPrice: has };
  }, [activeCategories, picksByCategory, otherPicks]);

  const uniqueInclusionVendors = useMemo(() => {
    const seen = new Set<string>();
    const result: Vendor[] = [];
    for (const cat of activeCategories) {
      if (cat === "other") continue;
      const pick = picksByCategory.get(cat);
      if (!pick || seen.has(pick.vendor.id)) continue;
      seen.add(pick.vendor.id);
      if (pick.vendor.inclusions.length > 0) result.push(pick.vendor);
    }
    for (const p of otherPicks) {
      if (seen.has(p.vendor.id)) continue;
      seen.add(p.vendor.id);
      if (p.vendor.inclusions.length > 0) result.push(p.vendor);
    }
    return result;
  }, [activeCategories, picksByCategory, otherPicks]);

  function priceLabel(v: Vendor) {
    if (!v.price_range_min && !v.price_range_max) return "—";
    const min = v.price_range_min ? formatPHP(Number(v.price_range_min)) : "";
    const max = v.price_range_max ? formatPHP(Number(v.price_range_max)) : "";
    if (min && max) return `${min} – ${max}`;
    return min || max;
  }

  async function saveName() {
    if (!lineup) return;
    const trimmed = nameInput.trim() || lineup.name;
    setNameInput(trimmed);
    if (trimmed === lineup.name) return;
    await supabase.from("supplier_lineups").update({ name: trimmed }).eq("id", lineup.id);
    setLineup({ ...lineup, name: trimmed });
  }

  async function pickVendor(category: VendorCategory, vendor: Vendor) {
    if (!lineup) return;
    const existing = picksByCategory.get(category);
    if (existing) {
      await supabase.from("supplier_lineup_picks").delete().eq("id", existing.pickId);
    }
    const { data } = await supabase
      .from("supplier_lineup_picks")
      .insert({ lineup_id: lineup.id, category, vendor_id: vendor.id })
      .select()
      .single();
    if (data) {
      setPicks((prev) => [...prev.filter((p) => p.category !== category), data as PickRow]);
    }
    setPickerCategory(null);
  }

  async function clearPick(category: VendorCategory) {
    const existing = picksByCategory.get(category);
    if (!existing) return;
    await supabase.from("supplier_lineup_picks").delete().eq("id", existing.pickId);
    setPicks((prev) => prev.filter((p) => p.category !== category));
  }

  async function addOtherVendor(vendor: Vendor) {
    if (!lineup) return;
    const { data } = await supabase
      .from("supplier_lineup_picks")
      .insert({ lineup_id: lineup.id, category: "other", vendor_id: vendor.id })
      .select()
      .single();
    if (data) {
      setPicks((prev) => [...prev, data as PickRow]);
    }
    setPickerCategory(null);
  }

  async function removeOtherPick(pickId: string) {
    await supabase.from("supplier_lineup_picks").delete().eq("id", pickId);
    setPicks((prev) => prev.filter((p) => p.id !== pickId));
  }

  if (notFound) {
    return (
      <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full items-center justify-center px-4">
        <p className="text-sm text-muted-fg mb-3">Lineup not found.</p>
        <Link href="/more/supplier-lineup" className="text-sm text-accent hover:underline">← Back to Supplier Lineup</Link>
      </div>
    );
  }

  const pickedCategories = activeCategories.filter((cat) => cat !== "other" && picksByCategory.has(cat));

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="print:hidden flex flex-col flex-1">
        <div className="flex-1 pb-20 lg:pb-8">

          <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10 flex items-center gap-3">
            <Link href="/more/supplier-lineup" className="text-accent text-sm">← Lineups</Link>
          </div>

          {loading ? (
            <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
          ) : (
            <div className="px-4 py-4 space-y-4">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={saveName}
                className="font-display text-2xl bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none w-full"
              />

              <div className="bg-terra-100 rounded-xl px-4 py-3">
                <p className="text-xs text-muted-fg mb-0.5">Estimated total</p>
                <p className="text-sm font-medium">
                  {hasPrice ? `${formatPHP(totalMin)} – ${formatPHP(totalMax)}` : "Add vendors to see an estimated total"}
                </p>
              </div>

              <div className="bg-card rounded-xl border border-border overflow-hidden">
                {activeCategories.map((cat) => {
                  if (cat === "other") {
                    const eligible = eligibleByCategory.get(cat) ?? [];
                    return (
                      <div key={cat} className="px-4 py-3 border-b border-border last:border-0">
                        <h3 className="text-xs uppercase tracking-widest text-accent font-semibold mb-1">{CATEGORY_LABELS[cat]}</h3>
                        {otherPicks.length > 0 && (
                          <div className="space-y-2 mb-2">
                            {otherPicks.map(({ pickId, vendor }) => (
                              <div key={pickId} className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium">{vendor.name}</p>
                                  <p className="text-xs text-muted-fg">{priceLabel(vendor)}</p>
                                  {vendor.contact && <p className="text-xs text-muted-fg">{vendor.contact}</p>}
                                </div>
                                <button
                                  onClick={() => removeOtherPick(pickId)}
                                  aria-label={`Remove ${vendor.name}`}
                                  className="text-muted-fg hover:text-foreground flex-shrink-0"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {eligible.length > 0 ? (
                          <button
                            onClick={() => setPickerCategory(cat)}
                            className="text-xs text-accent flex items-center gap-1 hover:underline"
                          >
                            <Plus className="w-3 h-3" /> {otherPicks.length > 0 ? "Add another vendor" : "Add vendor"}
                          </button>
                        ) : otherPicks.length === 0 ? (
                          <p className="text-xs text-muted-fg">No vendors added in this category yet</p>
                        ) : null}
                      </div>
                    );
                  }

                  const pick = picksByCategory.get(cat);
                  const eligible = eligibleByCategory.get(cat) ?? [];
                  return (
                    <div key={cat} className="px-4 py-3 border-b border-border last:border-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs uppercase tracking-widest text-accent font-semibold">{CATEGORY_LABELS[cat]}</h3>
                        {pick && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => setPickerCategory(cat)} className="text-xs text-accent hover:underline">
                              Change
                            </button>
                            <button
                              onClick={() => clearPick(cat)}
                              aria-label={`Remove ${CATEGORY_LABELS[cat]} pick`}
                              className="text-muted-fg hover:text-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      {pick ? (
                        <div>
                          <p className="text-sm font-medium">{pick.vendor.name}</p>
                          <p className="text-xs text-muted-fg">{priceLabel(pick.vendor)}</p>
                          {pick.vendor.contact && <p className="text-xs text-muted-fg">{pick.vendor.contact}</p>}
                        </div>
                      ) : eligible.length > 0 ? (
                        <button
                          onClick={() => setPickerCategory(cat)}
                          className="text-xs text-accent flex items-center gap-1 hover:underline"
                        >
                          <Plus className="w-3 h-3" /> Choose vendor
                        </button>
                      ) : (
                        <p className="text-xs text-muted-fg">No vendors added in this category yet</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {uniqueInclusionVendors.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-xs uppercase tracking-widest text-accent font-semibold">Inclusions</h3>
                  </div>
                  {uniqueInclusionVendors.map((vendor) => (
                    <div key={vendor.id} className="px-4 py-3 border-b border-border last:border-0">
                      <p className="text-sm font-medium">{vendor.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {vendor.inclusions.map((tag) => (
                          <span key={tag} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-fg">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-sm font-medium hover:bg-muted transition-colors"
              >
                <Printer className="w-4 h-4" /> Print / Save as PDF
              </button>
            </div>
          )}
        </div>

        <BottomNav />
      </div>

      <div className="hidden print:block p-6">
        <h1 className="text-2xl font-bold mb-1">{lineup?.name}</h1>
        <p className="text-sm mb-4">
          {hasPrice ? `Estimated total: ${formatPHP(totalMin)} – ${formatPHP(totalMax)}` : "No estimated total yet"}
        </p>
        {pickedCategories.length === 0 && otherPicks.length === 0 ? (
          <p className="text-sm">No vendors picked yet.</p>
        ) : (
          <>
            {pickedCategories.map((cat) => {
              const pick = picksByCategory.get(cat)!;
              return (
                <div key={cat} className="mb-3">
                  <p className="text-xs uppercase tracking-widest font-semibold">{CATEGORY_LABELS[cat]}</p>
                  <p className="text-sm font-medium">{pick.vendor.name}</p>
                  <p className="text-xs">{priceLabel(pick.vendor)}</p>
                  {pick.vendor.contact && <p className="text-xs">{pick.vendor.contact}</p>}
                </div>
              );
            })}
            {otherPicks.length > 0 && (
              <div className="mb-3">
                <p className="text-xs uppercase tracking-widest font-semibold">{CATEGORY_LABELS.other}</p>
                {otherPicks.map(({ pickId, vendor }) => (
                  <div key={pickId} className="mb-1">
                    <p className="text-sm font-medium">{vendor.name}</p>
                    <p className="text-xs">{priceLabel(vendor)}</p>
                    {vendor.contact && <p className="text-xs">{vendor.contact}</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {uniqueInclusionVendors.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-widest font-semibold mb-1">Inclusions</p>
            {uniqueInclusionVendors.map((vendor) => (
              <p key={vendor.id} className="text-xs mb-1">
                <span className="font-medium">{vendor.name}:</span> {vendor.inclusions.join(", ")}
              </p>
            ))}
          </div>
        )}
      </div>

      <Dialog open={pickerCategory !== null} onOpenChange={(o) => !o && setPickerCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose {pickerCategory ? CATEGORY_LABELS[pickerCategory] : ""} vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {pickerCategory && (eligibleByCategory.get(pickerCategory) ?? []).length === 0 ? (
              <p className="text-sm text-muted-fg">No vendors added in this category yet.</p>
            ) : (
              pickerCategory && (eligibleByCategory.get(pickerCategory) ?? []).map((vendor) => (
                <button
                  key={vendor.id}
                  onClick={() => (pickerCategory === "other" ? addOtherVendor(vendor) : pickVendor(pickerCategory, vendor))}
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{vendor.name}</p>
                    <p className="text-xs text-muted-fg">{priceLabel(vendor)}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[vendor.status]}>{STATUS_LABELS[vendor.status]}</Badge>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
