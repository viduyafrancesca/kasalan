"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getWeddingForUser } from "@/lib/supabase/getWedding";
import { BottomNav } from "@/components/shared/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatPHP } from "@/lib/utils";
import { Plus, Pencil } from "lucide-react";
import { type VendorCategory, CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/categories";
import { cn } from "@/lib/utils";

type BudgetItem = {
  id: string;
  category: string | null;
  vendor_id: string | null;
  label: string;
  estimated_amount: string;
  paid_amount: string;
  paid_date: string | null;
  notes: string | null;
};

type VendorRef = { id: string; name: string; categories: VendorCategory[]; price_range_max: string | null };

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type Wedding = { id: string; budget_total: string | null };

export default function BudgetPage() {
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [vendors, setVendors] = useState<VendorRef[]>([]);
  const [loading, setLoading] = useState(true);

  // Budget total modal
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  // Add/edit expense modal
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [form, setForm] = useState({ label: "", category: "Venue", vendor_id: null as string | null, estimated: "", paid: "", paid_date: todayStr(), notes: "" });
  const [savingExpense, setSavingExpense] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;
    setWedding(w);

    const { data: budgetItems } = await supabase
      .from("budget_items")
      .select("*")
      .eq("wedding_id", w.id)
      .order("created_at", { ascending: true });

    const { data: vendorRows } = await supabase
      .from("vendors")
      .select("id, name, categories, price_range_max")
      .eq("wedding_id", w.id)
      .order("name");

    setItems((budgetItems ?? []) as BudgetItem[]);
    setVendors((vendorRows ?? []) as VendorRef[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalBudget = Number(wedding?.budget_total ?? 0);
  const totalPaid = items.reduce((s, i) => s + Number(i.paid_amount), 0);
  const totalEstimated = items.reduce((s, i) => s + Number(i.estimated_amount), 0);
  const remaining = totalBudget > 0 ? totalBudget - totalPaid : totalEstimated - totalPaid;

  async function saveBudget() {
    if (!wedding) return;
    setSavingBudget(true);
    await supabase.from("weddings").update({ budget_total: Number(budgetInput) }).eq("id", wedding.id);
    setBudgetOpen(false);
    setSavingBudget(false);
    load();
  }

  function openAdd() {
    setEditing(null);
    setForm({ label: "", category: "Venue", vendor_id: null, estimated: "", paid: "", paid_date: todayStr(), notes: "" });
    setExpenseOpen(true);
  }

  function openEdit(item: BudgetItem) {
    setEditing(item);
    setForm({
      label: item.label,
      category: item.category ?? "Venue",
      vendor_id: item.vendor_id,
      estimated: item.estimated_amount,
      paid: item.paid_amount,
      paid_date: item.paid_date ?? todayStr(),
      notes: item.notes ?? "",
    });
    setExpenseOpen(true);
  }

  async function saveExpense() {
    if (!wedding) return;
    setSavingExpense(true);
    const payload = {
      wedding_id: wedding.id,
      label: form.label,
      category: form.vendor_id ? null : form.category,
      vendor_id: form.vendor_id,
      estimated_amount: Number(form.estimated) || 0,
      paid_amount: Number(form.paid) || 0,
      paid_date: form.paid_date || null,
      notes: form.notes || null,
    };
    if (editing) {
      await supabase.from("budget_items").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("budget_items").insert(payload);
    }
    setExpenseOpen(false);
    setSavingExpense(false);
    load();
  }

  async function deleteExpense() {
    if (!editing) return;
    setSavingExpense(true);
    await supabase.from("budget_items").delete().eq("id", editing.id);
    setExpenseOpen(false);
    setSavingExpense(false);
    load();
  }

  function effectiveLabels(item: BudgetItem): string[] {
    if (item.vendor_id) {
      const v = vendors.find((vv) => vv.id === item.vendor_id);
      return v ? v.categories.map((c) => CATEGORY_LABELS[c]) : ["Other"];
    }
    return [item.category ?? "Other"];
  }

  const grouped = CATEGORY_ORDER.map((cat) => {
    const label = CATEGORY_LABELS[cat];
    return {
      category: label,
      items: items.filter((i) => effectiveLabels(i).includes(label)),
    };
  }).filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">

        {/* Header */}
        <div className="bg-accent px-4 py-5 text-accent-fg">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl">Budget</h1>
            <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
              <DialogTrigger asChild>
                <button
                  onClick={() => setBudgetInput(totalBudget > 0 ? String(totalBudget) : "")}
                  className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 text-accent-fg rounded-lg px-3 py-1.5 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  {totalBudget > 0 ? "Edit total" : "Set total budget"}
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Total wedding budget</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Amount (PHP)</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-fg text-sm">₱</span>
                      <Input
                        type="number"
                        className="pl-7"
                        placeholder="500000"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button className="w-full" disabled={!budgetInput || savingBudget} onClick={saveBudget}>
                    {savingBudget ? "Saving..." : "Save budget"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {loading ? (
            <div className="mt-3 h-12 opacity-50 text-sm">Loading...</div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-base sm:text-lg font-semibold break-words">{totalBudget > 0 ? formatPHP(totalBudget) : "—"}</div>
                <div className="text-[10px] uppercase opacity-75">Total</div>
              </div>
              <div>
                <div className="text-base sm:text-lg font-semibold break-words">{formatPHP(totalPaid)}</div>
                <div className="text-[10px] uppercase opacity-75">Paid</div>
              </div>
              <div>
                <div className={`text-base sm:text-lg font-semibold break-words ${remaining < 0 ? "text-red-300" : ""}`}>
                  {formatPHP(Math.abs(remaining))}
                </div>
                <div className="text-[10px] uppercase opacity-75">{remaining < 0 ? "Over budget" : "Remaining"}</div>
              </div>
            </div>
          )}
        </div>

        {/* Expense list */}
        <div className="px-4 py-4 space-y-4">
          {!loading && grouped.length === 0 && (
            <p className="text-center text-muted-fg py-8 text-sm">
              No expenses yet.{" "}
              <button onClick={openAdd} className="text-accent underline">Add your first item.</button>
            </p>
          )}
          {grouped.map((group) => {
            const groupEstimated = group.items.reduce((s, i) => s + Number(i.estimated_amount), 0);
            const groupPaid      = group.items.reduce((s, i) => s + Number(i.paid_amount), 0);
            return (
              <div key={group.category}>
                <div className="flex justify-between items-baseline mb-2">
                  <h2 className="text-xs uppercase tracking-widest text-accent font-semibold">{group.category}</h2>
                  <span className="text-xs text-muted-fg">{formatPHP(groupPaid)} / {formatPHP(groupEstimated)}</span>
                </div>
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => openEdit(item)}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted text-left transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        {item.notes && <p className="text-xs text-muted-fg truncate">{item.notes}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-foreground">{formatPHP(Number(item.paid_amount))}</p>
                        <p className="text-xs text-muted-fg">of {formatPHP(Number(item.estimated_amount))}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/edit expense dialog */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="e.g. Reception venue deposit" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>How is this categorized?</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setForm((f) => ({ ...f, vendor_id: null }))}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-medium transition-colors",
                    !form.vendor_id ? "border-accent bg-terra-100 text-accent" : "border-border bg-card text-muted-fg hover:bg-muted"
                  )}
                >
                  Manual category
                </button>
                <button
                  onClick={() => {
                    const v = vendors[0];
                    setForm((f) => ({
                      ...f,
                      vendor_id: v?.id ?? null,
                      estimated: v?.price_range_max ? v.price_range_max : f.estimated,
                    }));
                  }}
                  disabled={vendors.length === 0}
                  className={cn(
                    "rounded-lg border py-2 text-xs font-medium transition-colors disabled:opacity-40",
                    form.vendor_id ? "border-accent bg-terra-100 text-accent" : "border-border bg-card text-muted-fg hover:bg-muted"
                  )}
                >
                  Link to vendor
                </button>
              </div>
            </div>

            {form.vendor_id ? (
              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={form.vendor_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const v = vendors.find((vv) => vv.id === id);
                    setForm((f) => ({
                      ...f,
                      vendor_id: id,
                      estimated: v?.price_range_max ? v.price_range_max : f.estimated,
                    }));
                  }}
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.categories.map((c) => CATEGORY_LABELS[c]).join(", ")})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORY_ORDER.map((c) => <option key={c} value={CATEGORY_LABELS[c]}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Estimated (₱)</Label>
                <Input type="number" placeholder="0" value={form.estimated} onChange={(e) => setForm((f) => ({ ...f, estimated: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Paid (₱) *</Label>
                <Input type="number" placeholder="0" value={form.paid} onChange={(e) => setForm((f) => ({ ...f, paid: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Payment date *</Label>
              <Input type="date" value={form.paid_date} onChange={(e) => setForm((f) => ({ ...f, paid_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input placeholder="e.g. 50% due 3 months before" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button className="w-full" disabled={!form.label || !form.paid || !form.paid_date || savingExpense} onClick={saveExpense}>
              {savingExpense ? "Saving..." : editing ? "Save changes" : "Add expense"}
            </Button>
            {editing && (
              <Button variant="destructive" className="w-full" disabled={savingExpense} onClick={deleteExpense}>
                Delete
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* FAB */}
      <button
        onClick={openAdd}
        className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-50 w-12 h-12 rounded-full bg-accent text-accent-fg shadow-lg flex items-center justify-center hover:bg-terra-500 transition-colors"
        aria-label="Add expense"
      >
        <Plus className="w-5 h-5" />
      </button>

      <BottomNav />
    </div>
  );
}
