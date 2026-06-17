"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/shared/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type SponsorRole = "principal" | "cord" | "veil" | "arrhae" | "candle" | "secondary";

type Sponsor = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: SponsorRole;
  confirmed: boolean;
  notes: string | null;
};

const ROLE_LABELS: Record<SponsorRole, string> = {
  principal:  "Principal Sponsors",
  cord:       "Cord",
  veil:       "Veil",
  arrhae:     "Arrhae",
  candle:     "Candle",
  secondary:  "Secondary Sponsors",
};

const ROLE_DESCRIPTIONS: Record<SponsorRole, string> = {
  principal: "Ninong & Ninang — witness the vows",
  cord:      "Symbol of everlasting bond",
  veil:      "Symbol of purity and unity",
  arrhae:    "13 coins — symbol of prosperity",
  candle:    "Symbol of the light of Christ",
  secondary: "Additional witnesses and supporters",
};

const ROLE_ORDER: SponsorRole[] = ["principal", "cord", "veil", "arrhae", "candle", "secondary"];

const EMPTY_FORM = { name: "", phone: "", email: "", role: "principal" as SponsorRole, confirmed: false, notes: "" };

export default function SponsorsPage() {
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: w } = await supabase.from("weddings").select("id").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(1).single();
    if (!w) return;
    setWeddingId(w.id);
    const { data } = await supabase.from("sponsors").select("*").eq("wedding_id", w.id).order("role").order("name");
    setSponsors((data ?? []) as Sponsor[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd(defaultRole?: SponsorRole) {
    setEditing(null);
    setForm({ ...EMPTY_FORM, role: defaultRole ?? "principal" });
    setOpen(true);
  }

  function openEdit(s: Sponsor) {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone ?? "", email: s.email ?? "", role: s.role, confirmed: s.confirmed, notes: s.notes ?? "" });
    setOpen(true);
  }

  async function save() {
    if (!weddingId || !form.name.trim()) return;
    setSaving(true);
    const payload = {
      wedding_id: weddingId,
      name: form.name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      role: form.role,
      confirmed: form.confirmed,
      notes: form.notes || null,
    };
    if (editing) {
      await supabase.from("sponsors").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("sponsors").insert(payload);
    }
    setOpen(false);
    setSaving(false);
    load();
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    await supabase.from("sponsors").delete().eq("id", editing.id);
    setOpen(false);
    setSaving(false);
    load();
  }

  async function toggleConfirmed(s: Sponsor) {
    await supabase.from("sponsors").update({ confirmed: !s.confirmed }).eq("id", s.id);
    setSponsors((prev) => prev.map((sp) => sp.id === s.id ? { ...sp, confirmed: !sp.confirmed } : sp));
  }

  const confirmed = sponsors.filter((s) => s.confirmed).length;
  const grouped = ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    desc: ROLE_DESCRIPTIONS[role],
    items: sponsors.filter((s) => s.role === role),
  }));

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <div className="flex-1 pb-20">

        {/* Header */}
        <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10 flex items-center gap-3">
          <Link href="/more" className="text-accent text-sm">← More</Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl">Sponsors</h1>
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
                <div className="flex items-end justify-between mb-1">
                  <div>
                    <h2 className="text-xs uppercase tracking-widest text-accent font-semibold">{label}</h2>
                    <p className="text-[11px] text-muted-fg mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => openAdd(role)}
                    className="text-xs text-accent flex items-center gap-0.5 mb-0.5 hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-4 text-center">
                    <p className="text-xs text-muted-fg">No one added yet</p>
                  </div>
                ) : (
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    {items.map((sponsor) => (
                      <div key={sponsor.id} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                        <button onClick={() => toggleConfirmed(sponsor)} className="flex-shrink-0">
                          <div className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                            sponsor.confirmed ? "bg-accent text-accent-fg" : "bg-terra-100 text-terra-700"
                          )}>
                            {sponsor.confirmed ? "✓" : sponsor.name.charAt(0).toUpperCase()}
                          </div>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{sponsor.name}</p>
                          {sponsor.phone && <p className="text-xs text-muted-fg">{sponsor.phone}</p>}
                          {sponsor.notes && <p className="text-xs text-muted-fg italic truncate">{sponsor.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge variant={sponsor.confirmed ? "success" : "secondary"}>
                            {sponsor.confirmed ? "Confirmed" : "Pending"}
                          </Badge>
                          <button onClick={() => openEdit(sponsor)} className="text-muted-fg hover:text-foreground text-xs underline">
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit sponsor" : "Add sponsor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input placeholder="e.g. Tito Romeo Santos" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="grid grid-cols-3 gap-2">
                {ROLE_ORDER.map((r) => (
                  <button
                    key={r}
                    onClick={() => setForm((f) => ({ ...f, role: r }))}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-medium transition-colors",
                      form.role === r
                        ? "border-accent bg-terra-100 text-accent"
                        : "border-border bg-card text-muted-fg hover:bg-muted"
                    )}
                  >
                    {ROLE_LABELS[r].replace(" Sponsors", "").replace("Secondary", "Secondary")}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="09XX XXX XXXX" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="Optional" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="e.g. Wants to give a speech" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>

            <button
              onClick={() => setForm((f) => ({ ...f, confirmed: !f.confirmed }))}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                form.confirmed ? "border-accent bg-terra-100" : "border-border bg-card hover:bg-muted"
              )}
            >
              <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0", form.confirmed ? "border-accent bg-accent" : "border-border")}>
                {form.confirmed && <span className="text-white text-[10px]">✓</span>}
              </div>
              <span className="text-sm">Confirmed they can attend</span>
            </button>

            <Button className="w-full" disabled={!form.name.trim() || saving} onClick={save}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add sponsor"}
            </Button>
            {editing && (
              <Button variant="destructive" className="w-full" disabled={saving} onClick={remove}>Delete</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <button
        onClick={() => openAdd()}
        className="fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full bg-accent text-accent-fg shadow-lg flex items-center justify-center hover:bg-terra-500 transition-colors"
        aria-label="Add sponsor"
      >
        <Plus className="w-5 h-5" />
      </button>

      <BottomNav />
    </div>
  );
}
