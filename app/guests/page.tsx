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
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { countAttendingPlusOnes } from "@/lib/guests";

// ── Types ────────────────────────────────────────────────────────────────────

type RsvpStatus = "pending" | "attending" | "declined";
type SponsorRole =
  | "principal" | "cord" | "veil" | "arrhae" | "candle"
  | "best_man" | "maid_of_honor" | "bridesmaid" | "groomsman";
type GuestSide =
  | "partner1_family" | "partner1_friend"
  | "partner2_family" | "partner2_friend"
  | "mutual_friend";

type Guest = {
  kind: "guest";
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  rsvp_status: RsvpStatus;
  meal_choice: string | null;
  table_number: number | null;
  plus_one: boolean;
  notes: string | null;
  side: GuestSide | null;
};

type Sponsor = {
  kind: "sponsor";
  id: string;
  name: string;
  role: SponsorRole;
  confirmed: boolean;
  phone: string | null;
  email: string | null;
  notes: string | null;
  side: GuestSide | null;
};

type Person = Guest | Sponsor;

// ── Constants ────────────────────────────────────────────────────────────────

const RSVP_VARIANT: Record<RsvpStatus, "success" | "destructive" | "secondary"> = {
  attending: "success",
  declined:  "destructive",
  pending:   "secondary",
};

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: "pending",   label: "Pending" },
  { value: "attending", label: "Attending" },
  { value: "declined",  label: "Declined" },
];

const ROLE_LABELS: Record<SponsorRole, string> = {
  principal:    "Principal",
  cord:         "Cord",
  veil:         "Veil",
  arrhae:       "Arrhae",
  candle:       "Candle",
  best_man:     "Best Man",
  maid_of_honor:"Maid of Honor",
  bridesmaid:   "Bridesmaid",
  groomsman:    "Groomsman",
};

const ROLE_ORDER: SponsorRole[] = [
  "principal", "cord", "veil", "arrhae", "candle", "best_man", "maid_of_honor", "bridesmaid", "groomsman",
];

const SIDE_ORDER: (GuestSide | null)[] = [
  null, "partner1_family", "partner1_friend", "partner2_family", "partner2_friend", "mutual_friend",
];

function getSideLabel(side: GuestSide | null, coupleNames: { name1: string; name2: string }): string {
  switch (side) {
    case "partner1_family": return `${coupleNames.name1}'s Family`;
    case "partner1_friend":  return `${coupleNames.name1}'s Friend`;
    case "partner2_family": return `${coupleNames.name2}'s Family`;
    case "partner2_friend":  return `${coupleNames.name2}'s Friend`;
    case "mutual_friend":    return "Mutual Friend";
    default:                 return "Unspecified";
  }
}

const EMPTY_GUEST = {
  name: "", email: "", phone: "", rsvp_status: "pending" as RsvpStatus,
  meal_choice: "", table_number: "", plus_one: false, notes: "",
  side: null as GuestSide | null,
};

const EMPTY_SPONSOR = {
  name: "", role: "principal" as SponsorRole, confirmed: false, phone: "", email: "", notes: "",
  side: null as GuestSide | null,
};

// ── Component ────────────────────────────────────────────────────────────────

type Filter = "all" | "guests" | "entourage";

export default function GuestsPage() {
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [coupleNames, setCoupleNames] = useState({ name1: "Partner 1", name2: "Partner 2" });
  const [guests, setGuests] = useState<Guest[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Guest dialog
  const [guestOpen, setGuestOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [guestForm, setGuestForm] = useState(EMPTY_GUEST);
  const [savingGuest, setSavingGuest] = useState(false);

  // Sponsor dialog
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [sponsorForm, setSponsorForm] = useState(EMPTY_SPONSOR);
  const [savingSponsor, setSavingSponsor] = useState(false);

  const [showMoveToSponsor, setShowMoveToSponsor] = useState(false);
  const [moveRole, setMoveRole] = useState<SponsorRole>("principal");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [showMoveToGuest, setShowMoveToGuest] = useState(false);

  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const w = await getWeddingForUser(supabase, user.id);
    if (!w) return;
    setWeddingId(w.id);
    setCoupleNames({ name1: w.couple_name_1, name2: w.couple_name_2 });
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase.from("guests").select("*").eq("wedding_id", w.id).order("name"),
      supabase.from("sponsors").select("*").eq("wedding_id", w.id).order("name"),
    ]);
    setGuests((g ?? []).map((r) => ({ ...r, kind: "guest" as const })));
    setSponsors((s ?? []).map((r) => ({ ...r, kind: "sponsor" as const })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Guest CRUD ───────────────────────────────────────────────────────────

  function openAddGuest() {
    setEditingGuest(null);
    setGuestForm(EMPTY_GUEST);
    setShowMoveToSponsor(false);
    setMoveRole("principal");
    setMoveError(null);
    setGuestOpen(true);
  }

  function openEditGuest(g: Guest) {
    setEditingGuest(g);
    setGuestForm({
      name: g.name, email: g.email ?? "", phone: g.phone ?? "",
      rsvp_status: g.rsvp_status, meal_choice: g.meal_choice ?? "",
      table_number: g.table_number != null ? String(g.table_number) : "",
      plus_one: g.plus_one, notes: g.notes ?? "", side: g.side,
    });
    setShowMoveToSponsor(false);
    setMoveRole("principal");
    setMoveError(null);
    setGuestOpen(true);
  }

  async function saveGuest() {
    if (!weddingId || !guestForm.name.trim()) return;
    setSavingGuest(true);
    const payload = {
      wedding_id: weddingId,
      name: guestForm.name.trim(),
      email: guestForm.email || null,
      phone: guestForm.phone || null,
      rsvp_status: guestForm.rsvp_status,
      meal_choice: guestForm.meal_choice || null,
      table_number: guestForm.table_number ? Number(guestForm.table_number) : null,
      plus_one: guestForm.plus_one,
      notes: guestForm.notes || null,
      side: guestForm.side,
    };
    if (editingGuest) {
      await supabase.from("guests").update(payload).eq("id", editingGuest.id);
    } else {
      await supabase.from("guests").insert(payload);
    }
    setGuestOpen(false);
    setSavingGuest(false);
    load();
  }

  async function deleteGuest() {
    if (!editingGuest) return;
    setSavingGuest(true);
    await supabase.from("guests").delete().eq("id", editingGuest.id);
    setGuestOpen(false);
    setSavingGuest(false);
    load();
  }

  async function moveGuestToSponsor() {
    if (!weddingId || !editingGuest) return;
    setSavingGuest(true);
    setMoveError(null);
    const payload = {
      wedding_id: weddingId,
      name: guestForm.name.trim(),
      role: moveRole,
      confirmed: guestForm.rsvp_status === "attending",
      phone: guestForm.phone || null,
      email: guestForm.email || null,
      notes: guestForm.notes || null,
      side: guestForm.side,
    };
    const { error: insertError } = await supabase.from("sponsors").insert(payload);
    if (insertError) {
      setMoveError(insertError.message);
      setSavingGuest(false);
      return;
    }
    const { error: deleteError } = await supabase.from("guests").delete().eq("id", editingGuest.id);
    if (deleteError) {
      setMoveError(deleteError.message);
      setSavingGuest(false);
      return;
    }
    setGuestOpen(false);
    setShowMoveToSponsor(false);
    setSavingGuest(false);
    load();
  }

  // ── Sponsor CRUD ─────────────────────────────────────────────────────────

  function openAddSponsor() {
    setEditingSponsor(null);
    setSponsorForm(EMPTY_SPONSOR);
    setShowMoveToGuest(false);
    setMoveError(null);
    setSponsorOpen(true);
  }

  function openEditSponsor(s: Sponsor) {
    setEditingSponsor(s);
    setSponsorForm({
      name: s.name, role: s.role, confirmed: s.confirmed,
      phone: s.phone ?? "", email: s.email ?? "", notes: s.notes ?? "",
      side: s.side,
    });
    setShowMoveToGuest(false);
    setMoveError(null);
    setSponsorOpen(true);
  }

  async function saveSponsor() {
    if (!weddingId || !sponsorForm.name.trim()) return;
    setSavingSponsor(true);
    const payload = {
      wedding_id: weddingId,
      name: sponsorForm.name.trim(),
      role: sponsorForm.role,
      confirmed: sponsorForm.confirmed,
      phone: sponsorForm.phone || null,
      email: sponsorForm.email || null,
      notes: sponsorForm.notes || null,
      side: sponsorForm.side,
    };
    if (editingSponsor) {
      await supabase.from("sponsors").update(payload).eq("id", editingSponsor.id);
    } else {
      await supabase.from("sponsors").insert(payload);
    }
    setSponsorOpen(false);
    setSavingSponsor(false);
    load();
  }

  async function deleteSponsor() {
    if (!editingSponsor) return;
    setSavingSponsor(true);
    await supabase.from("sponsors").delete().eq("id", editingSponsor.id);
    setSponsorOpen(false);
    setSavingSponsor(false);
    load();
  }

  async function moveSponsorToGuest() {
    if (!weddingId || !editingSponsor) return;
    setSavingSponsor(true);
    setMoveError(null);
    const payload = {
      wedding_id: weddingId,
      name: sponsorForm.name.trim(),
      rsvp_status: sponsorForm.confirmed ? "attending" : "pending",
      meal_choice: null,
      table_number: null,
      plus_one: false,
      phone: sponsorForm.phone || null,
      email: sponsorForm.email || null,
      notes: sponsorForm.notes || null,
      side: sponsorForm.side,
    };
    const { error: insertError } = await supabase.from("guests").insert(payload);
    if (insertError) {
      setMoveError(insertError.message);
      setSavingSponsor(false);
      return;
    }
    const { error: deleteError } = await supabase.from("sponsors").delete().eq("id", editingSponsor.id);
    if (deleteError) {
      setMoveError(deleteError.message);
      setSavingSponsor(false);
      return;
    }
    setSponsorOpen(false);
    setShowMoveToGuest(false);
    setSavingSponsor(false);
    load();
  }

  // ── Derived data ─────────────────────────────────────────────────────────

  const attending   = guests.filter((g) => g.rsvp_status === "attending").length;
  const pending     = guests.filter((g) => g.rsvp_status === "pending").length;
  const declined    = guests.filter((g) => g.rsvp_status === "declined").length;
  const totalHeads  = attending + countAttendingPlusOnes(guests);

  const allPeople: Person[] = [...guests, ...sponsors];

  const visible = allPeople
    .filter((p) => {
      if (filter === "guests")    return p.kind === "guest";
      if (filter === "entourage") return p.kind === "sponsor";
      return true;
    })
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  function handleFab() {
    if (filter === "entourage") openAddSponsor();
    else openAddGuest();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen max-w-2xl mx-auto w-full">
      <div className="flex-1 pb-20 lg:pb-8">

        {/* Header */}
        <div className="bg-background px-4 pt-5 pb-3 border-b border-border sticky top-0 z-10">
          <h1 className="font-display text-2xl">Guests</h1>
          {!loading && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs">
              <span className="text-green-700 font-medium">{attending} attending</span>
              <span className="text-muted-fg">{pending} pending</span>
              <span className="text-red-600">{declined} declined</span>
              <span className="text-muted-fg">{sponsors.length} entourage</span>
              {totalHeads > 0 && <span className="text-muted-fg ml-auto">{totalHeads} heads</span>}
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-1 mt-3">
            {(["all", "guests", "entourage"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors",
                  filter === f
                    ? "bg-accent text-accent-fg"
                    : "bg-muted text-muted-fg hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <Input
            className="mt-2 h-9 text-sm"
            placeholder={filter === "entourage" ? "Search entourage..." : "Search guests..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="px-4 py-4">
          {loading ? (
            <p className="text-center text-muted-fg py-12 text-sm">Loading...</p>
          ) : visible.length === 0 ? (
            <p className="text-center text-muted-fg py-12 text-sm">
              {search
                ? "No one matches your search."
                : filter === "entourage"
                ? <>No entourage yet. <button onClick={openAddSponsor} className="text-accent underline">Add someone.</button></>
                : <>No guests yet. <button onClick={openAddGuest} className="text-accent underline">Add your first guest.</button></>
              }
            </p>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {visible.map((person) =>
                person.kind === "guest" ? (
                  <button
                    key={`g-${person.id}`}
                    onClick={() => openEditGuest(person)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted text-left transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-terra-100 flex items-center justify-center text-terra-700 text-sm font-semibold flex-shrink-0">
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {person.name}
                        {person.plus_one && <span className="text-muted-fg font-normal"> +1</span>}
                      </p>
                      {person.meal_choice && <p className="text-xs text-muted-fg">{person.meal_choice}</p>}
                      {person.table_number && <p className="text-xs text-muted-fg">Table {person.table_number}</p>}
                      {person.side && <p className="text-xs text-muted-fg">{getSideLabel(person.side, coupleNames)}</p>}
                    </div>
                    <Badge variant={RSVP_VARIANT[person.rsvp_status]}>{person.rsvp_status}</Badge>
                  </button>
                ) : (
                  <button
                    key={`s-${person.id}`}
                    onClick={() => openEditSponsor(person)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-muted text-left transition-colors"
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0",
                      person.confirmed ? "bg-accent text-accent-fg" : "bg-terra-100 text-terra-700"
                    )}>
                      {person.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{person.name}</p>
                      {person.phone && <p className="text-xs text-muted-fg">{person.phone}</p>}
                      {person.side && <p className="text-xs text-muted-fg">{getSideLabel(person.side, coupleNames)}</p>}
                    </div>
                    <Badge variant="default">{ROLE_LABELS[person.role]}</Badge>
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Guest dialog ── */}
      <Dialog open={guestOpen} onOpenChange={setGuestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGuest ? "Edit guest" : "Add guest"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input placeholder="e.g. Maria Santos" value={guestForm.name} onChange={(e) => setGuestForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>RSVP status</Label>
              <div className="flex gap-2">
                {RSVP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setGuestForm((f) => ({ ...f, rsvp_status: opt.value }))}
                    className={cn(
                      "flex-1 rounded-lg border py-2 text-xs font-medium transition-colors",
                      guestForm.rsvp_status === opt.value
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
                <Input placeholder="09XX XXX XXXX" value={guestForm.phone} onChange={(e) => setGuestForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="Optional" value={guestForm.email} onChange={(e) => setGuestForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Meal choice</Label>
                <Input placeholder="e.g. Chicken" value={guestForm.meal_choice} onChange={(e) => setGuestForm((f) => ({ ...f, meal_choice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Table #</Label>
                <Input type="number" placeholder="—" value={guestForm.table_number} onChange={(e) => setGuestForm((f) => ({ ...f, table_number: e.target.value }))} />
              </div>
            </div>
            <button
              onClick={() => setGuestForm((f) => ({ ...f, plus_one: !f.plus_one }))}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                guestForm.plus_one ? "border-accent bg-terra-100" : "border-border bg-card hover:bg-muted"
              )}
            >
              <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0", guestForm.plus_one ? "border-accent bg-accent" : "border-border")}>
                {guestForm.plus_one && <span className="text-white text-[10px]">✓</span>}
              </div>
              <span className="text-sm">Bringing a +1</span>
            </button>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="e.g. Vegetarian, wheelchair access" value={guestForm.notes} onChange={(e) => setGuestForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Side</Label>
              <div className="grid grid-cols-2 gap-2">
                {SIDE_ORDER.map((sideOption) => (
                  <button
                    key={sideOption ?? "unspecified"}
                    onClick={() => setGuestForm((f) => ({ ...f, side: sideOption }))}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-medium transition-colors",
                      guestForm.side === sideOption
                        ? "border-accent bg-terra-100 text-accent"
                        : "border-border bg-card text-muted-fg hover:bg-muted"
                    )}
                  >
                    {getSideLabel(sideOption, coupleNames)}
                  </button>
                ))}
              </div>
            </div>
            {showMoveToSponsor ? (
              <div className="space-y-3 rounded-xl border border-accent bg-terra-100 p-3">
                <p className="text-sm font-medium">Pick their entourage role</p>
                <div className="grid grid-cols-4 gap-2">
                  {ROLE_ORDER.map((r) => (
                    <button
                      key={r}
                      onClick={() => setMoveRole(r)}
                      className={cn(
                        "rounded-lg border py-2 text-xs font-medium transition-colors",
                        moveRole === r
                          ? "border-accent bg-accent text-accent-fg"
                          : "border-border bg-card text-muted-fg hover:bg-muted"
                      )}
                    >
                      {ROLE_LABELS[r]}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-fg">Table number and meal choice won&apos;t carry over.</p>
                {moveError && <p className="text-sm text-red-600">{moveError}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={savingGuest}
                    onClick={() => { setShowMoveToSponsor(false); setMoveError(null); }}
                  >
                    Cancel
                  </Button>
                  <Button className="flex-1" disabled={savingGuest} onClick={moveGuestToSponsor}>
                    {savingGuest ? "Moving..." : "Confirm move"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button className="w-full" disabled={!guestForm.name.trim() || savingGuest} onClick={saveGuest}>
                  {savingGuest ? "Saving..." : editingGuest ? "Save changes" : "Add guest"}
                </Button>
                {editingGuest && (
                  <>
                    <Button variant="outline" className="w-full" disabled={savingGuest} onClick={() => setShowMoveToSponsor(true)}>
                      Move to Entourage
                    </Button>
                    <Button variant="destructive" className="w-full" disabled={savingGuest} onClick={deleteGuest}>Delete</Button>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Sponsor/entourage dialog ── */}
      <Dialog open={sponsorOpen} onOpenChange={setSponsorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSponsor ? "Edit entourage" : "Add entourage"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input placeholder="e.g. Ana Reyes" value={sponsorForm.name} onChange={(e) => setSponsorForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="grid grid-cols-4 gap-2">
                {ROLE_ORDER.map((r) => (
                  <button
                    key={r}
                    onClick={() => setSponsorForm((f) => ({ ...f, role: r }))}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-medium transition-colors",
                      sponsorForm.role === r
                        ? "border-accent bg-terra-100 text-accent"
                        : "border-border bg-card text-muted-fg hover:bg-muted"
                    )}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Side</Label>
              <div className="grid grid-cols-2 gap-2">
                {SIDE_ORDER.map((sideOption) => (
                  <button
                    key={sideOption ?? "unspecified"}
                    onClick={() => setSponsorForm((f) => ({ ...f, side: sideOption }))}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-medium transition-colors",
                      sponsorForm.side === sideOption
                        ? "border-accent bg-terra-100 text-accent"
                        : "border-border bg-card text-muted-fg hover:bg-muted"
                    )}
                  >
                    {getSideLabel(sideOption, coupleNames)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="09XX XXX XXXX" value={sponsorForm.phone} onChange={(e) => setSponsorForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="Optional" value={sponsorForm.email} onChange={(e) => setSponsorForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input placeholder="e.g. Wants to give a speech" value={sponsorForm.notes} onChange={(e) => setSponsorForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <button
              onClick={() => setSponsorForm((f) => ({ ...f, confirmed: !f.confirmed }))}
              className={cn(
                "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                sponsorForm.confirmed ? "border-accent bg-terra-100" : "border-border bg-card hover:bg-muted"
              )}
            >
              <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0", sponsorForm.confirmed ? "border-accent bg-accent" : "border-border")}>
                {sponsorForm.confirmed && <span className="text-white text-[10px]">✓</span>}
              </div>
              <span className="text-sm">Confirmed they can attend</span>
            </button>
            {showMoveToGuest ? (
              <div className="space-y-3 rounded-xl border border-accent bg-terra-100 p-3">
                <p className="text-sm">Move this person to the guest list? Their role and confirmation status won&apos;t be needed anymore.</p>
                {moveError && <p className="text-sm text-red-600">{moveError}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={savingSponsor}
                    onClick={() => { setShowMoveToGuest(false); setMoveError(null); }}
                  >
                    Cancel
                  </Button>
                  <Button className="flex-1" disabled={savingSponsor} onClick={moveSponsorToGuest}>
                    {savingSponsor ? "Moving..." : "Confirm move"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button className="w-full" disabled={!sponsorForm.name.trim() || savingSponsor} onClick={saveSponsor}>
                  {savingSponsor ? "Saving..." : editingSponsor ? "Save changes" : "Add to entourage"}
                </Button>
                {editingSponsor && (
                  <>
                    <Button variant="outline" className="w-full" disabled={savingSponsor} onClick={() => setShowMoveToGuest(true)}>
                      Move to Guest List
                    </Button>
                    <Button variant="destructive" className="w-full" disabled={savingSponsor} onClick={deleteSponsor}>Delete</Button>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* FAB — adds guest or entourage depending on active filter */}
      <button
        onClick={handleFab}
        className="fixed bottom-24 right-4 lg:bottom-8 lg:right-8 z-50 w-12 h-12 rounded-full bg-accent text-accent-fg shadow-lg flex items-center justify-center hover:bg-terra-500 transition-colors"
        aria-label={filter === "entourage" ? "Add entourage" : "Add guest"}
      >
        <Plus className="w-5 h-5" />
      </button>

      <BottomNav />
    </div>
  );
}
