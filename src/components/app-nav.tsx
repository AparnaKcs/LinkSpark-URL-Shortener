import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

export function AppNav({ username: customUsername }: { username?: string | null }) {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [username, setUsername] = useState<string | null>(customUsername ?? null);

  useEffect(() => {
    if (customUsername !== undefined) {
      setUsername(customUsername);
      return;
    }
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", u.user.id)
          .maybeSingle();
        setUsername(data?.username || u.user.user_metadata?.username || u.user.email?.split("@")[0] || null);
      }
    })();
  }, [customUsername]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <nav className="border-b border-border bg-card/45 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-95 transition-opacity"
          >
            <div className="size-6 bg-primary rounded-sm flex items-center justify-center">
              <div className="size-2 bg-card rotate-45" />
            </div>
            <span className="font-bold tracking-tight text-foreground">LINKSPARK</span>
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <Link
            to="/dashboard"
            className="text-sm font-semibold text-foreground hover:text-primary transition"
          >
            Dashboard
          </Link>
          <div className="flex items-center gap-4">
            {username && (
              <span className="hidden sm:block text-xs text-primary font-mono">{username}</span>
            )}
            <button
              onClick={signOut}
              className="text-sm font-semibold hover:text-primary transition flex items-center gap-1.5 cursor-pointer text-foreground"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
