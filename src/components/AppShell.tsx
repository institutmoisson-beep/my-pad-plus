import { Bell } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { BottomNav } from "@/components/BottomNav";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNotifications } from "@/hooks/useNotifications";

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { data: notifications = [], unread, markAllRead } = useNotifications();

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Logo size={32} withWordmark />
          <Sheet onOpenChange={(open) => open && void markAllRead()}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications">
                <Bell className="size-5 text-primary" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                    {unread}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[88%] sm:max-w-sm">
              <SheetHeader>
                <SheetTitle>Notifications</SheetTitle>
                <SheetDescription>Vos alertes récentes</SheetDescription>
              </SheetHeader>
              <div className="mt-2 space-y-2 overflow-y-auto px-4 pb-6">
                {notifications.length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune notification.</p>
                )}
                {notifications.map((n) => (
                  <div key={n.id} className="rounded-xl border border-border bg-card p-3 shadow-soft">
                    <p className="text-sm font-semibold text-foreground">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {new Date(n.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mx-auto max-w-lg px-4 pb-28 pt-4"
      >
        {title && (
          <div className="mb-4">
            <h1 className="text-2xl font-extrabold tracking-tight text-primary">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        {children}
      </motion.main>

      <BottomNav />
    </div>
  );
}