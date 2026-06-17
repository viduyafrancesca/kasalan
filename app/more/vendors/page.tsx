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

type VendorStatus = "interested" | "shortlisted" | "booked" | "declined";
type VendorCategory =
  | "venue" | "catering" | "photography" | "videography" | "flowers"
  | "hair_makeup" | "styling" | "sounds_lights" | "cake" | "transportation" | "other";

type Vendor = {
  id: string;
  category: VendorCategory;
  name: string;
  contact: string | null;
  price_range_min: string | null;
  price_range_max: string | null;
  status: VendorStatus;
  notes: string | null;
};

const CATEGORY_LABELS: Record<VendorCategory, string> = {
  venue:          "Venue",
  catering:       "Catering",
  photography:    "Photography",
  videography:    "Videography",
  flowers:        "Flowers",
  hair_makeup:    "Hair & Makeup",
  styling:        "Styling",
  sounds_lights:  "Sounds & Lights",
  cake:           "Cake",
  transportation: "Transportation",
  other:          "Other",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as VendorCategory[];

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
  name: "", category: "venue" as VendorCategory, contact: "",
  price_min: "", price_max: "", status: "interested" as VendorStatus, notes: "",
};

export default function VendorsPage() {
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
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
    const { data } = await supabase.from("vendors").select("*").eq("wedding_id", w.id).order("created_at", { ascending: true });
    setVendors((data ?? []) as Vendor[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd(defaultCategory?: VendorCategory) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, category: defaultCategory ?? "venue" });
    setOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setForm({
      name: v.name,
      category: v.category,
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
      category: form.category,
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

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: vendors.filter((v) => v.category === cat),
  })).filter((g) => g.items.length > 0);

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
          ) : grouped.length === 0 ? (
            <p className="text-center text-muted-fg py-12 text-sm">
              No vendors yet.{" "}
              <button onClick={() => openAdd()} className="text-accent underline">Add your first vendor.</button>
            </p>
          ) : (
            grouped.map(({ cat, label, items }) => (
              <div key={cat} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xs uppercase tracking-widest text-accent font-semibold">{label}</h2>
                  <button onClick={() => openAdd(cat)} className="text-xs text-accent flex items-center gap-0.5 hover:underline">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
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
              </div>
            ))
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
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as VendorCategory }))}
              >
                {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
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

            <Button className="w-full" disabled={!form.name.trim() || saving} onClick={save}>
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
