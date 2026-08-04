import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { isUnlocked } from "@/lib/lock";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: hasPin } = await supabase.rpc("has_pin");
    if (hasPin && !isUnlocked()) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});