import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Vektor" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initial } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(initial ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // If already signed in, bounce to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const parsed = z.object({
        email: z.string().trim().email(),
        password: z.string().min(6, "Min 6 characters"),
        name: mode === "signup" ? z.string().trim().min(1).max(80) : z.string().optional(),
      }).parse({ email, password, name });

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { name: parsed.name },
          },
        });
        if (error) throw error;
        toast.success("Account created. Redirecting…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.email, password: parsed.password,
        });
        if (error) throw error;
        toast.success("Welcome back.");
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : (err as Error).message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function signInGoogle() {
    setLoading(true);
    try {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
      if (r.error) throw new Error(r.error.message);
      if (r.redirected) return;
      navigate({ to: "/dashboard", replace: true });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-foreground text-background">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-6 bg-brand rounded-sm flex items-center justify-center">
            <div className="size-2 bg-foreground rotate-45" />
          </div>
          <span className="font-semibold tracking-tight">VEKTOR</span>
        </Link>
        <div className="space-y-4 max-w-md">
          <p className="text-2xl font-semibold tracking-tight text-balance">
            "We replaced three SaaS tools with Vektor. The analytics dashboard alone was worth it."
          </p>
          <p className="text-sm opacity-60 font-mono">— Sample testimonial</p>
        </div>
        <p className="text-xs opacity-50 font-mono">System status: Optimal</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Sign in" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "signin" ? "Welcome back to your link infrastructure." : "Start shortening and tracking in 30 seconds."}
            </p>
          </div>

          <button
            type="button" onClick={signInGoogle} disabled={loading}
            className="w-full flex items-center justify-center gap-2 border border-border rounded-md py-2.5 text-sm font-medium hover:bg-muted transition disabled:opacity-50"
          >
            <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.997 10.997 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.09A6.62 6.62 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div className="h-px bg-border flex-1" /> or <div className="h-px bg-border flex-1" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <Field label="Name">
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ada Lovelace" required />
              </Field>
            )}
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@company.com" required />
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" required minLength={6} />
            </Field>
            <button disabled={loading} className="w-full bg-brand text-brand-foreground py-2.5 rounded-md text-sm font-medium hover:brightness-110 transition disabled:opacity-50">
              {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            {mode === "signin" ? "No account? " : "Already have one? "}
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-foreground font-medium hover:underline">
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full h-10 px-3 bg-surface border border-input rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}
