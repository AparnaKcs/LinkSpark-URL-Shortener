import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
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
        toast.success("Account created.");
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

  function enterGuestMode() {
    if (typeof window !== "undefined") {
      localStorage.setItem("mock_session", "true");
    }
    toast.success("Logged in as Guest for Smoke Testing!");
    navigate({ to: "/dashboard", replace: true });
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
            Link infrastructure for operators who measure everything.
          </p>
          <p className="text-sm opacity-60 font-mono">— Built for the Katomaran hackathon</p>
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

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-3 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Or</span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          <button
            type="button"
            onClick={enterGuestMode}
            className="w-full h-10 border border-border bg-surface text-foreground rounded-md text-sm font-medium hover:bg-muted transition flex items-center justify-center gap-2 cursor-pointer"
          >
            ⚡ Guest Mode (Bypass Auth)
          </button>

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
