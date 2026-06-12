import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, LogOut } from "lucide-react";

export function AppNav({ email }: { email?: string | null }) {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      localStorage.removeItem("mock_session");
    }
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <nav className="border-b border-border bg-background sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-1.5 text-brand hover:opacity-95 transition-opacity">
            <Link2 className="size-5" />
            <span className="font-semibold text-lg tracking-tight text-foreground">Snip</span>
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <Link
            to="/dashboard"
            className="text-sm font-medium text-foreground hover:opacity-85 transition"
          >
            Dashboard
          </Link>
          <div className="flex items-center gap-4">
            {email && <span className="hidden sm:block text-xs text-muted-foreground font-mono">{email}</span>}
            <button
              onClick={signOut}
              className="text-sm font-medium hover:opacity-85 transition flex items-center gap-1.5 cursor-pointer text-foreground"
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
