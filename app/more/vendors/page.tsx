"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { BottomNav } from "@/components/shared/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatPHP } from "@/lib/utils";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { type VendorCategory, CATEGORY_LABELS, getActiveCategories } from "@/lib/categories";
import { EyeOff } from "lucide-react";

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
};

const STATUS_OPTIONS: { value: VendorStatus; label: string }[] = [
  { value: "interested",  label: "Interested" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "booked",      label: "Booked" },
  { value: "declined",    label: "Declined" },
];

const STATUS_VARIANT: Record<VendorStatus, "default" | "success" | "secondary" | "destructive"> = {
  interested:  "secondary",
  shortlisted: "default",
  booked:      "success",
  declined:    "destructive",
};

const EMPTY_FORM = {
  name: "", categories: ["venue"] as VendorCategory[], contact: "",
  price_min: "", price_max: "", status: "interested" as VendorStatus, notes: "",
};

export default function VendorsPage() {
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<VendorCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;
    setWeddingId(w.id);
    setHiddenCategories((w.hidden_vendor_categories ?? []) as VendorCategory[]);
    const { data } = await supabase.from("vendors").select("*").eq("wedding_id", w.id).order("created_at", { ascending: true });
    setVendors((data ?? []) as Vendor[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function hideCategory(cat: VendorCategory) {
    if (!weddingId) return;
    const inUse = vendors.some((v) => v.categories.includes(cat));
    if (inUse) return;
    const next = [...hiddenCategories, cat];
    setHiddenCategories(next);
    await supabase.from("weddings").update({ hidden_vendor_categories: next }).eq("id", weddingId);
  }

  async function restoreCategory(cat: VendorCategory) {
    if (!weddingId) return;
    const next = hiddenCategories.filter((c) => c !== cat);
    setHiddenCategories(next);
    await supabase.from("weddings").update({ hidden_vendor_categories: next }).eq("id", weddingId);
  }

  function openAdd(defaultCategory?: VendorCategory) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, categories: defaultCategory ? [defaultCategory] : ["venue"] });
    setOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({
      name: v.name,
      categories: v.categories,
      contact: v.contact ?? "",
      price_min: v.price_range_min ?? "",
      price_max: v.price_range_max ?? "",
      status: v.status,
      notes: v.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!weddingId || !form.name.trim()) return;
    setSaving(true);
    const payload = {
      wedding_id: weddingId,
      name: form.name.trim(),
      categories: form.categories,
      contact: form.contact || null,
      price_range_min: form.price_min ? Number(form.price_min) : null,
      price_range_max: form.price_max ? Number(form.price_max) : null,
      status: form.status,
      notes: form.notes || null,
    };
    if (editing) {
      await supabase.from("vendors").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("vendors").insert(payload);
    }
    setOpen(false);
    setSaving(false);
    load();
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    await supabase.from("vendors").delete().eq("id", editing.id);
    setOpen(false);
    setSaving(false);
    load();
  }

  const booked = vendors.filter((v) => v.status === "booked").length;
  const activeCategories = getActiveCategories(hiddenCategories);

  const grouped = activeCategories.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: vendors.filter((v) => v.categories.includes(cat)),
  }));

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">

        <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10 flex items-center gap-3">
          <Link href="/more" className="text-accent text-sm">← More</Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl">Vendors</h1>
            {!loading && (
              <p className="text-xs text-muted-fg">{booked} booked · {vendors.length} total</p>
            )}
          </div>
        </div>

        <div className="px-4 py-4">
          {loading ? (
            <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
          ) : activeCategories.length === 0 ? (
            <p className="text-center text-muted-fg py-12 text-sm">
              All categories are hidden. Restore one below to add a vendor.
            </p>
          ) : (
            grouped.map(({ cat, label, items }) => (
              <div key={cat} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs uppercase tracking-widest text-accent font-semibold">{label}</h2>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openAdd(cat)} className="text-xs text-accent flex items-center gap-0.5 hover:underline">
                      <Plus className="w-3 h-3" /> Add
                    </button>
                    <button
                      onClick={() => hideCategory(cat)}
                      disabled={items.length > 0}
                      title={items.length > 0 ? "Retag or remove vendors in this category first" : "Hide this category"}
                      className="text-muted-fg hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-4 text-center">
                    <p className="text-xs text-muted-fg">No vendor added yet</p>
                  </div>
                ) : (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {items.map((vendor) => (
                      <button
                        key={vendor.id}
                        onClick={() => openEdit(vendor)}
                        className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted text-left transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{vendor.name}</p>
                          {vendor.contact && <p className="text-xs text-muted-fg">{vendor.contact}</p>}
                          {(vendor.price_range_min || vendor.price_range_max) && (
                            <p className="text-xs text-muted-fg">
                              {vendor.price_range_min ? formatPHP(Number(vendor.price_range_min)) : ""}
                              {vendor.price_range_min && vendor.price_range_max ? " – " : ""}
                              {vendor.price_range_max ? formatPHP(Number(vendor.price_range_max)) : ""}
                            </p>
                          )}
                          {vendor.notes && <p className="text-xs text-muted-fg italic truncate">{vendor.notes}</p>}
                        </div>
                        <Badge variant={STATUS_VARIANT[vendor.status]}>
                          {STATUS_OPTIONS.find((s) => s.value === vendor.status)?.label}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {!loading && hiddenCategories.length > 0 && (
            <div className="mt-2">
              <h2 className="text-xs uppercase tracking-widest text-muted-fg font-semibold mb-2">Hidden categories</h2>
              <div className="flex flex-wrap gap-2">
                {hiddenCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => restoreCategory(cat)}
                    className="flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-fg hover:bg-muted transition-colors"
                  >
                    <Plus className="w-3 h-3" /> {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit vendor" : "Add vendor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Casa Verde Events Place"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Categories</Label>
              <div className="grid grid-cols-3 gap-2">
                {activeCategories.map((c) => {
                  const selected = form.categories.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setForm((f) => ({
                        ...f,
                        categories: selected
                          ? f.categories.filter((x) => x !== c)
                          : [...f.categories, c],
                      }))}
                      className={cn(
                        "rounded-lg border py-2 text-xs font-medium transition-colors",
                        selected
                          ? "border-accent bg-terra-100 text-accent"
                          : "border-border bg-card text-muted-fg hover:bg-muted"
                      )}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setForm((f) => ({ ...f, status: value }))}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-medium transition-colors",
                      form.status === value
                        ? "border-accent bg-terra-100 text-accent"
                        : "border-border bg-card text-muted-fg hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Contact (name, phone, or email)</Label>
              <Input
                placeholder="e.g. 0917 123 4567"
                value={form.contact}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min price (₱)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.price_min}
                  onChange={(e) => setForm((f) => ({ ...f, price_min: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max price (₱)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.price_max}
                  onChange={(e) => setForm((f) => ({ ...f, price_max: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g. Includes tables and chairs, free parking"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <Button className="w-full" disabled={!form.name.trim() || form.categories.length === 0 || saving} onClick={save}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add vendor"}
            </Button>
            {editing && (
              <Button variant="destructive" className="w-full" disabled={saving} onClick={remove}>
                Delete vendor
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <button
        onClick={() => openAdd()}
        className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-50 w-12 h-12 rounded-full bg-accent text-accent-fg shadow-lg flex items-center justify-center hover:bg-terra-500 transition-colors"
        aria-label="Add vendor"
      >
        <Plus className="w-5 h-5" />
      </button>

      <BottomNav />
    </div>
  );
}
