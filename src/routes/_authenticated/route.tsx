import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { isUnlocked } from "@/lib/lock";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("pin_hash")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.pin_hash && !isUnlocked()) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});