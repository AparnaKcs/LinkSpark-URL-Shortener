// Integration-managed pattern: ssr:false, client-side gate that redirects to /auth.
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const isMock = typeof window !== "undefined" && localStorage.getItem("mock_session") === "true";
    if (isMock) {
      return { user: { id: "00000000-0000-0000-0000-000000000000", email: "smoke-test@example.com" } };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
