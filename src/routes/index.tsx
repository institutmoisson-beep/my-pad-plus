import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Imo MSN — Loyer, biens et portefeuille" },
      {
        name: "description",
        content: "Accédez à votre espace Imo MSN : loyer, portefeuille, biens et messagerie.",
      },
      { property: "og:title", content: "Imo MSN — Loyer, biens et portefeuille" },
      {
        property: "og:description",
        content: "Accédez à votre espace Imo MSN : loyer, portefeuille, biens et messagerie.",
      },
    ],
  }),
  component: Splash,
});

function Splash() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    void navigate({ to: session ? "/app" : "/auth", replace: true });
  }, [session, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-royal">
      <Logo size={84} />
      <p className="text-lg font-extrabold tracking-tight text-primary-foreground">
        Imo<span className="text-success"> MSN</span>
      </p>
      <p className="text-xs text-primary-foreground/70">Pure Premium Peace</p>
    </div>
  );
}
