"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { BottomNav } from "@/components/shared/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { groupByTimeline, MONTH_BUCKETS, monthLabel } from "@/lib/checklist/generateChecklist";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChecklistItem = {
  id: string;
  title: string;
  category: string;
  months_before: string;
  completed: boolean;
  notes: string | null;
  is_custom: boolean;
};

const CATEGORIES = [
  "Planning", "Venue", "Catering", "Photography", "Flowers",
  "Attire", "Beauty", "Church Requirements", "Legal", "Ceremony Items",
  "Sponsors", "Guests", "Reception", "Transportation", "Accommodation",
  "Cotillion", "Coordinator", "Budget", "Other",
];

export default function ChecklistPage() {
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [weddingDate, setWeddingDate] = useState<string | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [form, setForm] = useState({ title: "", category: "Planning", months_before: "3", notes: "" });
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;
    setWeddingId(w.id);
    setWeddingDate(w.wedding_date);
    const { data } = await supabase.from("checklist_items").select("*").eq("wedding_id", w.id).order("months_before", { ascending: false });
    setItems((data ?? []) as ChecklistItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleComplete(item: ChecklistItem) {
    const next = !item.completed;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, completed: next } : i));
    await supabase.from("checklist_items").update({ completed: next, completed_at: next ? new Date().toISOString() : null }).eq("id", item.id);
  }

  function openAdd() {
    setEditingItem(null);
    setForm({ title: "", category: "Planning", months_before: "3", notes: "" });
    setOpen(true);
  }

  function openEdit(item: ChecklistItem) {
    if (!item.is_custom) return;
    setEditingItem(item);
    setForm({ title: item.title, category: item.category, months_before: String(item.months_before), notes: item.notes ?? "" });
    setOpen(true);
  }

  async function save() {
    if (!weddingId || !form.title.trim()) return;
    setSaving(true);
    const payload = {
      wedding_id: weddingId,
      title: form.title.trim(),
      category: form.category,
      months_before: Number(form.months_before),
      notes: form.notes || null,
      is_custom: true,
      completed: false,
    };
    if (editingItem) {
      await supabase.from("checklist_items").update({ title: payload.title, category: payload.category, months_before: payload.months_before, notes: payload.notes }).eq("id", editingItem.id);
    } else {
      await supabase.from("checklist_items").insert(payload);
    }
    setOpen(false);
    setSaving(false);
    load();
  }

  async function remove() {
    if (!editingItem) return;
    setSaving(true);
    await supabase.from("checklist_items").delete().eq("id", editingItem.id);
    setOpen(false);
    setSaving(false);
    load();
  }

  const done = items.filter((i) => i.completed).length;
  const grouped = groupByTimeline(items, weddingDate);

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">

        <div className="bg-background px-4 py-5 border-b border-border sticky top-0 z-10">
          <h1 className="font-display text-2xl">Checklist</h1>
          <p className="text-sm text-muted-fg mt-0.5">
            {loading ? "Loading..." : `${done} of ${items.length} tasks complete`}
          </p>
        </div>

        <div className="px-4 py-4">
          {!loading && grouped.length === 0 && (
            <p className="text-center text-muted-fg py-12 text-sm">
              No tasks yet.{" "}
              <button onClick={openAdd} className="text-accent underline">Add your first task.</button>
            </p>
          )}

          {grouped.map((group) => {
            const isOverdue = group.label.startsWith("Overdue");
            const groupDone = group.items.filter((i) => i.completed).length;
            return (
              <div key={group.label} className="mb-6">
                <div className="flex items-baseline justify-between px-1 mb-2">
                  <h2 className={cn("text-xs uppercase tracking-widest font-semibold", isOverdue ? "text-red-600" : "text-accent")}>
                    {group.label}
                  </h2>
                  <span className="text-xs text-muted-fg">{groupDone}/{group.items.length}</span>
                </div>
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0"
                    >
                      <button
                        onClick={() => toggleComplete(item)}
                        className={cn(
                          "w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors",
                          item.completed ? "bg-accent border-accent" : "border-terra-400"
                        )}
                      >
                        {item.completed && <span className="text-white text-[10px]">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm", item.completed && "line-through text-muted-fg")}>
                          {item.title}
                        </p>
                        {item.notes && <p className="text-xs text-muted-fg truncate">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-muted-fg">{item.category}</span>
                        {item.is_custom && (
                          <button onClick={() => openEdit(item)} className="text-muted-fg hover:text-accent transition-colors" aria-label="Edit task">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit task" : "Add custom task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Task *</Label>
              <Input
                placeholder="e.g. Book hair trial"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>When</Label>
              <div className="grid grid-cols-3 gap-2">
                {(MONTH_BUCKETS as readonly number[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setForm((f) => ({ ...f, months_before: String(m) }))}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-medium transition-colors",
                      form.months_before === String(m)
                        ? "border-accent bg-terra-100 text-accent"
                        : "border-border bg-card text-muted-fg hover:bg-muted"
                    )}
                  >
                    {monthLabel(m)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="e.g. Call florist first"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <Button className="w-full" disabled={!form.title.trim() || saving} onClick={save}>
              {saving ? "Saving..." : editingItem ? "Save changes" : "Add task"}
            </Button>
            {editingItem && (
              <Button variant="destructive" className="w-full" disabled={saving} onClick={remove}>
                Delete task
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <button
        onClick={openAdd}
        className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-50 w-12 h-12 rounded-full bg-accent text-accent-fg shadow-lg flex items-center justify-center hover:bg-terra-500 transition-colors"
        aria-label="Add task"
      >
        <Plus className="w-5 h-5" />
      </button>

      <BottomNav />
    </div>
  );
}
