import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
  Building2,
  Home,
  MessageCircle,
  Receipt,
  Shield,
  User,
  Wallet,
} from "lucide-react";

import { useRoles } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type Item = { to: string; label: string; icon: typeof Home };

export function BottomNav() {
  const { data: roles = [] } = useRoles();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isLandlord = roles.includes("landlord");
  const isTenant = roles.includes("tenant");
  const isAdmin = roles.includes("admin");

  const items: Item[] = [{ to: "/app", label: "Accueil", icon: Home }];
  if (isLandlord) items.push({ to: "/app/biens", label: "Mes Biens", icon: Building2 });
  if (isTenant || !isLandlord) items.push({ to: "/app/loyer", label: "Loyer", icon: Receipt });
  items.push({ to: "/app/portefeuille", label: "Portefeuille", icon: Wallet });
  items.push({ to: "/app/chat", label: "Chat", icon: MessageCircle });
  if (isAdmin) items.push({ to: "/app/admin", label: "Admin", icon: Shield });
  items.push({ to: "/app/profil", label: "Profil", icon: User });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl shadow-float">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1.5">
        {items.map((item) => {
          const active =
            item.to === "/app" ? pathname === "/app" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                className="relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium"
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-x-1.5 inset-y-1 -z-10 rounded-2xl bg-secondary/10"
                  />
                )}
                <Icon
                  className={cn(
                    "size-5 transition-colors",
                    active ? "text-secondary" : "text-muted-foreground",
                  )}
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span className={cn(active ? "text-secondary" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}