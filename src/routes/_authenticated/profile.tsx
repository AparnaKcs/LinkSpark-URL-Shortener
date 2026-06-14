import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/app-nav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — LinkSpark" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const [user, setUser] = useState<{ id: string; email?: string; created_at?: string } | null>(
    null,
  );
  const [profile, setProfile] = useState<{
    email: string | null;
    username: string | null;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setUser(
        u.user ? { id: u.user.id, email: u.user.email, created_at: u.user.created_at } : null,
      );
      if (u.user) {
        const { data } = await supabase
          .from("profiles")
          .select("email, username")
          .eq("id", u.user.id)
          .maybeSingle();
        setProfile(data);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <AppNav username={profile?.username ?? user?.email ?? null} />
      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight mb-1 text-foreground">Profile</h1>
        <p className="text-sm text-muted-foreground mb-6">Your account information.</p>
        <div className="bg-card backdrop-blur-md border border-border rounded-xl p-6 space-y-4 shadow-sm">
          <Row label="Username" value={profile?.username ?? "—"} />
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="User ID" value={user?.id ?? "—"} mono />
          <Row
            label="Joined"
            value={user?.created_at ? new Date(user.created_at).toLocaleString() : "—"}
          />
        </div>
      </main>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center pb-3 border-b border-border/40 last:border-0 last:pb-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`text-sm font-semibold text-foreground ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
