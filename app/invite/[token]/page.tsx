"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type AuthMode = "signin" | "signup";
type Status = "loading" | "invalid" | "auth" | "ready" | "joining";

type InviteData = {
  token: string;
  wedding_id: string;
  couple_name_1: string;
  couple_name_2: string;
  wedding_date: string | null;
};

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [status, setStatus] = useState<Status>("loading");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createClient();

      const { data: inv } = await supabase
        .from("partner_invites")
        .select("token, wedding_id, weddings(couple_name_1, couple_name_2, wedding_date)")
        .eq("token", token)
        .maybeSingle();

      if (!inv) { setStatus("invalid"); return; }

      const w = inv.weddings as unknown as { couple_name_1: string; couple_name_2: string; wedding_date: string | null };
      setInvite({ token: inv.token, wedding_id: inv.wedding_id, ...w });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus("auth"); return; }

      // Already owner?
      const { data: owned } = await supabase.from("weddings").select("id").eq("id", inv.wedding_id).eq("owner_id", user.id).maybeSingle();
      if (owned) { router.replace("/dashboard"); return; }

      // Already collaborator?
      const { data: collab } = await supabase.from("collaborators").select("id").eq("wedding_id", inv.wedding_id).eq("user_id", user.id).maybeSingle();
      if (collab) { router.replace("/dashboard"); return; }

      setStatus("ready");
    }
    init();
  }, [token]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    const supabase = createClient();

    const { error } = mode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setAuthLoading(false);
    if (error) { setAuthError(error.message); return; }
    setStatus("ready");
  }

  async function handleJoin() {
    if (!invite) return;
    setStatus("joining");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("auth"); return; }

    await supabase.from("collaborators").insert({
      wedding_id: invite.wedding_id,
      user_id: user.id,
      role: "partner",
    });

    await supabase
      .from("partner_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
      .eq("token", invite.token);

    router.push("/dashboard");
  }

  const coupleName = invite ? `${invite.couple_name_1} & ${invite.couple_name_2}` : "";
  const formattedDate = invite?.wedding_date
    ? new Date(invite.wedding_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <p className="font-display text-2xl text-center text-foreground">Kasalan</p>

        {status === "loading" && (
          <p className="text-center text-muted-fg text-sm">Loading invite...</p>
        )}

        {status === "invalid" && (
          <div className="rounded-xl bg-card border border-border p-6 text-center space-y-2">
            <p className="font-medium">Invalid invite link</p>
            <p className="text-sm text-muted-fg">This link is invalid or has expired. Ask your partner to generate a new one.</p>
          </div>
        )}

        {status === "auth" && invite && (
          <>
            <div className="text-center space-y-1">
              <p className="text-xs uppercase tracking-widest text-muted-fg">You&apos;re invited to co-plan</p>
              <h1 className="font-display text-2xl">{coupleName}</h1>
              {formattedDate && <p className="text-sm text-muted-fg">{formattedDate}</p>}
              <p className="text-sm text-muted-fg pt-1">Sign in or create an account to access their wedding plan.</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder={mode === "signup" ? "Choose a password" : "Your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              {authError && <p className="text-sm text-red-600">{authError}</p>}
              <Button type="submit" className="w-full" disabled={authLoading}>
                {authLoading ? "Please wait..." : mode === "signup" ? "Create account & join" : "Sign in & join"}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-fg">
              {mode === "signin" ? (
                <>No account? <button onClick={() => { setMode("signup"); setAuthError(""); }} className="text-accent underline">Create one</button></>
              ) : (
                <>Have an account? <button onClick={() => { setMode("signin"); setAuthError(""); }} className="text-accent underline">Sign in</button></>
              )}
            </p>
          </>
        )}

        {(status === "ready" || status === "joining") && invite && (
          <div className="space-y-6">
            <div className="text-center space-y-1">
              <p className="text-xs uppercase tracking-widest text-muted-fg">You&apos;re invited to co-plan</p>
              <h1 className="font-display text-3xl">{coupleName}</h1>
              {formattedDate && <p className="text-sm text-muted-fg">{formattedDate}</p>}
            </div>
            <div className="rounded-xl bg-terra-100 border border-terra-200 p-4 text-sm text-center text-foreground">
              You&apos;ll get full access to edit the checklist, budget, guests, and more.
            </div>
            <Button className="w-full" disabled={status === "joining"} onClick={handleJoin}>
              {status === "joining" ? "Joining..." : "Join wedding plan"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
