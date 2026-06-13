import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { deleteSelf } from "@/lib/auth.functions";
import { z } from "zod";

const searchSchema = z.object({
  flow: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Check if user is newly created and tried to sign in (not sign up) with Google
    if (search.flow === "signin") {
      const createdAt = new Date(data.user.created_at).getTime();
      const lastSignInAt = data.user.last_sign_in_at
        ? new Date(data.user.last_sign_in_at).getTime()
        : createdAt;

      // If it is their very first session (created_at matches last_sign_in_at within 1 second)
      if (Math.abs(lastSignInAt - createdAt) < 1000) {
        try {
          await deleteSelf();
        } catch (e) {
          console.error("New user cleanup failed:", e);
        }
        await supabase.auth.signOut();
        throw redirect({
          to: "/auth",
          search: { error: "user_not_found" },
        });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
