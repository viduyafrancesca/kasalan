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

type RsvpStatus = "pending" | "attending" | "declined";

type Guest = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rsvp_status: RsvpStatus;
  meal_choice: string | null;
  table_number: number | null;
  plus_one: boolean;
  notes: string | null;
};

const RSVP_VARIANT: Record<RsvpStatus, "success" | "destructive" | "secondary"> = {
  attending: "success",
  declined: "destructive",
  pending: "secondary",
};

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "pending",   label: "Pending" },
  { value: "attending", label: "Attending" },
  { value: "declined",  label: "Declined" },
];

const EMPTY_FORM = { name: "", email: "", phone: "", rsvp_status: "pending" as RsvpStatus, meal_choice: "", table_number: "", plus_one: false, notes: "" };

export default function GuestsPage() {
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: w } = await supabase.from("weddings").select("id").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(1).single();
    if (!w) return;
    setWeddingId(w.id);
    const { data } = await supabase.from("guests").select("*").eq("wedding_id", w.id).order("name", { ascending: true });
    setGuests((data ?? []) as Guest[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(g: Guest) {
    setEditing(g);
    setForm({
      name: g.name,
      email: g.email ?? "",
      phone: g.phone ?? "",
      rsvp_status: g.rsvp_status,
      meal_choice: g.meal_choice ?? "",
      table_number: g.table_number != null ? String(g.table_number) : "",
      plus_one: g.plus_one,
      notes: g.notes ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!weddingId || !form.name.trim()) return;
    setSaving(true);
    const payload = {
      wedding_id: weddingId,
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      rsvp_status: form.rsvp_status,
      meal_choice: form.meal_choice || null,
      table_number: form.table_number ? Number(form.table_number) : null,
      plus_one: form.plus_one,
      notes: form.notes || null,
    };
    if (editing) {
      await supabase.from("guests").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("guests").insert(payload);
    }
    setOpen(false);
    setSaving(false);
    load();
  }

  async function remove() {
    if (!editing) return;
    setSaving(true);
    await supabase.from("guests").delete().eq("id", editing.id);
    setOpen(false);
    setSaving(false);
    load();
  }

  const filtered = guests.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const attending = guests.filter((g) => g.rsvp_status === "attending").length;
  const pending   = guests.filter((g) => g.rsvp_status === "pending").length;
  const declined  = guests.filter((g) => g.rsvp_status === "declined").length;
  const totalHeads = guests.filter((g) => g.rsvp_status === "attending").length +
    guests.filter((g) => g.rsvp_status === "attending" && g.plus_one).length;

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <div className="flex-1 pb-20">

        {/* Header */}
        <div className="bg-background px-4 pt-5 pb-3 border-b border-border sticky top-0 z-10">
          <h1 className="font-display text-2xl">Guests</h1>
          {!loading && (
            <div className="flex gap-4 mt-1 text-xs">
              <span className="text-green-700 font-medium">{attending} attending</span>
              <span className="text-muted-fg">{pending} pending</span>
              <span className="text-red-600">{declined} declined</span>
              {totalHeads > 0 && <span className="text-muted-fg ml-auto">{totalHeads} heads</span>}
            </div>
          )}
          <Input
            className="mt-3 h-9 text-sm"
            placeholder="Search guests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="px-4 py-4">
          {loading ? (
            <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-fg py-12 text-sm">
              {search ? "No guests match your search." : <>No guests yet. <button onClick={openAdd} className="text-accent underline">Add your first guest.</button></>}
            </p>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {filtered.map((guest) => (
                <button
                  key={guest.id}
                  onClick={() => openEdit(guest)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-terra-100 flex items-center justify-center text-terra-700 text-sm font-semibold flex-shrink-0">
                    {guest.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {guest.name}
                      {guest.plus_one && <span className="text-muted-fg font-normal"> +1</span>}
                    </p>
                    {guest.meal_choice && <p className="text-xs text-muted-fg">{guest.meal_choice}</p>}
                    {guest.table_number && <p className="text-xs text-muted-fg">Table {guest.table_number}</p>}
                  </div>
                  <Badge variant={RSVP_VARIANT[guest.rsvp_status]}>{guest.rsvp_status}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit guest" : "Add guest"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input placeholder="e.g. Maria Santos" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>RSVP status</Label>
              <div className="flex gap-2">
                {RSVP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setForm((f) => ({ ...f, rsvp_status: opt.value }))}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                      form.rsvp_status === opt.value
                        ? "border-accent bg-terra-100 text-accent"
                        : "border-border bg-card text-muted-fg hover:bg-muted"
                    )}
                  >
                    {opt.label}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Meal choice</Label>
                <Input placeholder="e.g. Chicken, Fish" value={form.meal_choice} onChange={(e) => setForm((f) => ({ ...f, meal_choice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Table #</Label>
                <Input type="number" placeholder="—" value={form.table_number} onChange={(e) => setForm((f) => ({ ...f, table_number: e.target.value }))} />
              </div>
            </div>

            <button
              onClick={() => setForm((f) => ({ ...f, plus_one: !f.plus_one }))}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                form.plus_one ? "border-accent bg-terra-100" : "border-border bg-card hover:bg-muted"
              )}
            >
              <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0", form.plus_one ? "border-accent bg-accent" : "border-border")}>
                {form.plus_one && <span className="text-white text-[10px]">✓</span>}
              </div>
              <span className="text-sm">Bringing a +1</span>
            </button>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="e.g. Vegetarian, wheelchair access" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>

            <Button className="w-full" disabled={!form.name.trim() || saving} onClick={save}>
              {saving ? "Saving..." : editing ? "Save changes" : "Add guest"}
            </Button>
            {editing && (
              <Button variant="destructive" className="w-full" disabled={saving} onClick={remove}>Delete</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <button
        onClick={openAdd}
        className="fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full bg-accent text-accent-fg shadow-lg flex items-center justify-center hover:bg-terra-500 transition-colors"
        aria-label="Add guest"
      >
        <Plus className="w-5 h-5" />
      </button>

      <BottomNav />
    </div>
  );
}
