import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function AppNav({ email }: { email?: string | null }) {
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-6 bg-brand rounded-sm flex items-center justify-center">
              <div className="size-2 bg-background rotate-45" />
            </div>
            <span className="font-semibold tracking-tight">VEKTOR</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link
              to="/dashboard"
              activeProps={{ className: "bg-muted text-foreground" }}
              className="text-sm font-medium px-3 py-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/profile"
              activeProps={{ className: "bg-muted text-foreground" }}
              className="text-sm font-medium px-3 py-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
            >
              Profile
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {email && <span className="hidden sm:block text-xs text-muted-foreground font-mono">{email}</span>}
          <button
            onClick={signOut}
            className="text-xs font-medium px-3 py-1.5 border border-border rounded-md hover:bg-muted transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
