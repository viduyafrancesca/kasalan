"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/shared/BottomNav";
import Link from "next/link";

export default function SharePage() {
  const [weddingId, setWeddingId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [partnerEmail, setPartnerEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: wedding } = await supabase
        .from("weddings")
        .select("id")
        .or(`owner_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (wedding) setWeddingId(wedding.id);
    })();
  }, []);

  async function generateShareLink() {
    if (!weddingId) return;
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("share_tokens")
      .insert({ wedding_id: weddingId })
      .select("token")
      .single();
    if (data) setShareUrl(`${location.origin}/share/${data.token}`);
    setLoading(false);
  }

  async function handleCopy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }

  async function handleInvitePartner(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOtp({
      email: partnerEmail,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setInviteSent(true);
    setLoading(false);
  }

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto">
      <div className="flex-1 pb-20">
        <div className="bg-background px-4 py-5 border-b border-border flex items-center gap-3">
          <Link href="/more" className="text-accent text-sm">← More</Link>
          <h1 className="font-display text-2xl">Share</h1>
        </div>

        <div className="px-4 py-6 space-y-8">
          <div className="space-y-3">
            <h2 className="font-display text-lg">Invite your partner</h2>
            <p className="text-sm text-muted-fg">Your partner will get full access to edit the wedding plan together.</p>
            {inviteSent ? (
              <div className="rounded-xl bg-terra-100 border border-terra-200 p-4 text-sm">
                Invite sent to <strong>{partnerEmail}</strong> — they'll receive a magic link to join.
              </div>
            ) : (
              <form onSubmit={handleInvitePartner} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Partner&apos;s email</Label>
                  <Input
                    type="email"
                    placeholder="partner@example.com"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>Send invite</Button>
              </form>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-lg">Family view-only link</h2>
            <p className="text-sm text-muted-fg">Share a read-only link with family and friends so they can follow along.</p>
            {shareUrl ? (
              <div className="space-y-2">
                <div className="bg-card rounded-lg border border-border px-3 py-2 text-sm break-all text-muted-fg">{shareUrl}</div>
                <Button variant="outline" className="w-full" onClick={handleCopy}>
                  {copyDone ? "Copied!" : "Copy link"}
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={generateShareLink} disabled={loading || !weddingId}>
                {loading ? "Generating..." : "Generate share link"}
              </Button>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
