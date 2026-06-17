"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-1">
          <h1 className="font-display text-4xl text-foreground">Kasalan</h1>
          <p className="text-muted-fg text-sm tracking-wide uppercase">Philippine Wedding Planner</p>
        </div>

        {sent ? (
          <div className="rounded-xl bg-terra-100 border border-terra-200 p-6 text-center space-y-2">
            <p className="font-medium text-foreground">Check your email</p>
            <p className="text-sm text-muted-fg">We sent a magic link to <strong>{email}</strong>. Click it to sign in.</p>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send magic link"}
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-muted-fg">
          No password needed — we&apos;ll email you a sign-in link.
        </p>
      </div>
    </main>
  );
}
