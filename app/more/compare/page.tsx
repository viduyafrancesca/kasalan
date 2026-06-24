"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { BottomNav } from "@/components/shared/BottomNav";
import { Badge } from "@/components/ui/badge";
import { formatPHP, cn } from "@/lib/utils";
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

export default function ComparePage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [activeCategories, setActiveCategories] = useState<VendorCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<VendorCategory | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;
    const hidden = (w.hidden_vendor_categories ?? []) as VendorCategory[];
    const categories = getActiveCategories(hidden);
    setActiveCategories(categories);

    const { data } = await supabase.from("vendors").select("*").eq("wedding_id", w.id);
    const all = (data ?? []) as Vendor[];
    setVendors(all);

    const comparable = (cat: VendorCategory) =>
      all.filter((v) => v.categories.includes(cat) && v.status !== "declined");
    const defaultCat =
      categories.find((c) => comparable(c).length >= 2) ?? categories[0] ?? null;
    setSelectedCategory(defaultCat);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const comparableVendors = useMemo(() => {
    if (!selectedCategory) return [];
    return vendors.filter(
      (v) => v.categories.includes(selectedCategory) && v.status !== "declined"
    );
  }, [vendors, selectedCategory]);

  const inclusionRows = useMemo(() => {
    const set = new Set<string>();
    for (const v of comparableVendors) {
      for (const tag of v.inclusions ?? []) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [comparableVendors]);

  function priceLabel(v: Vendor) {
    if (!v.price_range_min && !v.price_range_max) return "—";
    const min = v.price_range_min ? formatPHP(Number(v.price_range_min)) : "";
    const max = v.price_range_max ? formatPHP(Number(v.price_range_max)) : "";
    if (min && max) return `${min} – ${max}`;
    return min || max;
  }

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">

        <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10 flex items-center gap-3">
          <Link href="/more" className="text-accent text-sm">← More</Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl">Compare Packages</h1>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
        ) : activeCategories.length === 0 ? (
          <p className="text-center text-muted-fg py-12 text-sm px-4">
            No vendor categories available yet.
          </p>
        ) : (
          <>
            <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-border">
              {activeCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                    selectedCategory === cat
                      ? "border-accent bg-terra-100 text-accent"
                      : "border-border bg-card text-muted-fg hover:bg-muted"
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            <div className="px-4 py-4">
              {comparableVendors.length < 2 ? (
                <div className="rounded-xl border border-dashed border-border py-8 text-center px-4">
                  <p className="text-sm text-muted-fg mb-2">
                    Add at least 2 vendors in this category to compare.
                  </p>
                  <Link href="/more/vendors" className="text-xs text-accent hover:underline">
                    Go to Vendors →
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="min-w-full text-sm border-collapse">
                    <tbody>
                      <tr>
                        <th className="sticky left-0 z-10 bg-card text-left px-3 py-2 text-xs font-semibold text-muted-fg border-b border-border w-28 min-w-28">
                          &nbsp;
                        </th>
                        {comparableVendors.map((v) => (
                          <th
                            key={v.id}
                            className="px-3 py-2 text-left font-medium border-b border-border border-l border-border min-w-40 whitespace-nowrap"
                          >
                            {v.name}
                          </th>
                        ))}
                      </tr>

                      <tr>
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-semibold text-muted-fg border-b border-border">
                          Price
                        </td>
                        {comparableVendors.map((v) => (
                          <td key={v.id} className="px-3 py-2 border-b border-border border-l border-border whitespace-nowrap">
                            {priceLabel(v)}
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-semibold text-muted-fg border-b border-border">
                          Status
                        </td>
                        {comparableVendors.map((v) => (
                          <td key={v.id} className="px-3 py-2 border-b border-border border-l border-border">
                            <Badge variant={STATUS_VARIANT[v.status]}>{STATUS_LABELS[v.status]}</Badge>
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-semibold text-muted-fg border-b border-border">
                          Contact
                        </td>
                        {comparableVendors.map((v) => (
                          <td key={v.id} className="px-3 py-2 border-b border-border border-l border-border">
                            {v.contact || "—"}
                          </td>
                        ))}
                      </tr>

                      <tr>
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs font-semibold text-muted-fg border-b border-border">
                          Notes
                        </td>
                        {comparableVendors.map((v) => (
                          <td key={v.id} className="px-3 py-2 border-b border-border border-l border-border">
                            {v.notes || "—"}
                          </td>
                        ))}
                      </tr>

                      {inclusionRows.length > 0 && (
                        <>
                          <tr>
                            <td
                              colSpan={comparableVendors.length + 1}
                              className="sticky left-0 z-10 bg-muted px-3 py-1.5 text-xs uppercase tracking-widest text-accent font-semibold border-b border-border"
                            >
                              Inclusions
                            </td>
                          </tr>
                          {inclusionRows.map((tag) => (
                            <tr key={tag}>
                              <td className="sticky left-0 z-10 bg-card px-3 py-2 text-xs text-muted-fg border-b border-border">
                                {tag}
                              </td>
                              {comparableVendors.map((v) => (
                                <td
                                  key={v.id}
                                  className="px-3 py-2 border-b border-border border-l border-border text-center"
                                >
                                  {(v.inclusions ?? []).includes(tag) ? "✓" : "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
