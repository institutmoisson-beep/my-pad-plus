import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, LogOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/Logo";
import { PinPad } from "@/components/PinPad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lock, unlock } from "@/lib/lock";
import { playChime } from "@/lib/sound";
import { platformAuthenticatorAvailable, registerBiometric, verifyBiometric } from "@/lib/webauthn";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion — Imo MSN" },
      { name: "description", content: "Connectez-vous à Imo MSN par mot de passe, code PIN ou empreinte digitale." },
      { property: "og:title", content: "Connexion — Imo MSN" },
      { property: "og:description", content: "Accès sécurisé : mot de passe, code PIN à 4 chiffres ou biométrie." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-gradient-royal">
      <div className="flex flex-col items-center gap-2 pb-6 pt-14">
        <Logo size={64} />
        <h1 className="text-2xl font-extrabold tracking-tight text-primary-foreground">
          Imo<span className="text-success"> MSN</span>
        </h1>
        <p className="text-xs text-primary-foreground/70">Gestion locative & portefeuille</p>
      </div>
      <div className="flex-1 rounded-t-[2rem] bg-background px-5 pb-10 pt-7 shadow-soft">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-secondary" />
          </div>
        ) : session ? (
          <UnlockPanel />
        ) : (
          <CredentialsPanel />
        )}
      </div>
    </div>
  );
}

function UnlockPanel() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [credId, setCredId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("profiles").select("biometric_enabled").maybeSingle();
      if (!data?.biometric_enabled) return;
      const { data: bio } = await supabase.rpc("get_my_biometric");
      const cred = bio as { rawId?: string } | null;
      if (cred?.rawId) setCredId(cred.rawId);
    })();
  }, []);

  const handlePin = useCallback(
    async (pin: string) => {
      setBusy(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc("verify_pin", { _pin: pin });
      setBusy(false);
      if (rpcError || !data) {
        setError("Code PIN incorrect");
        return;
      }
      unlock();
      playChime("success");
      void navigate({ to: "/app", replace: true });
    },
    [navigate],
  );

  async function handleBiometric() {
    if (!credId) return;
    try {
      setBusy(true);
      await verifyBiometric(credId);
      unlock();
      playChime("success");
      void navigate({ to: "/app", replace: true });
    } catch {
      setError("Empreinte non reconnue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center gap-2 text-primary">
        <Lock className="size-4" />
        <span className="text-sm font-semibold">Accès rapide</span>
      </div>
      <PinPad onComplete={handlePin} onBiometric={credId ? handleBiometric : undefined} busy={busy} error={error} />
      {credId && (
        <p className="text-center text-xs text-muted-foreground">
          Se connecter avec l&apos;empreinte digitale
        </p>
      )}
      <Button
        variant="ghost"
        className="w-full text-muted-foreground"
        onClick={async () => {
          lock();
          await supabase.auth.signOut();
        }}
      >
        <LogOut className="size-4" /> Changer de compte
      </Button>
    </div>
  );
}

function CredentialsPanel() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const [loginId, setLoginId] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");

  async function afterLogin() {
    unlock();
    playChime("success");
    const available = await platformAuthenticatorAvailable();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, biometric_enabled")
      .maybeSingle();
    if (available && profile && !profile.biometric_enabled) {
      const wants = window.confirm(
        "Activer la connexion par empreinte digitale pour vos prochains accès ?",
      );
      if (wants) {
        try {
          const cred = await registerBiometric(profile.id, profile.full_name);
          await supabase
            .from("profiles")
            .update({ biometric_enabled: true, biometric_credential: cred })
            .eq("id", profile.id);
          toast.success("Empreinte digitale activée");
        } catch {
          toast.error("Activation biométrique annulée");
        }
      }
    }
    void navigate({ to: "/app", replace: true });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const identifier = loginId.trim();
    const payload = identifier.includes("@")
      ? { email: identifier, password: loginPass }
      : { phone: identifier, password: loginPass };
    const { error } = await supabase.auth.signInWithPassword(payload);
    setBusy(false);
    if (error) {
      toast.error("Connexion échouée", { description: error.message });
      return;
    }
    await afterLogin();
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[0-9]{4}$/.test(pin)) {
      toast.error("Le code PIN doit contenir 4 chiffres");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name.trim(), phone: phone.trim() },
      },
    });
    if (error) {
      setBusy(false);
      toast.error("Inscription échouée", { description: error.message });
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setBusy(false);
      toast.success("Compte créé", {
        description: "Vérifiez votre email pour confirmer, puis connectez-vous.",
      });
      return;
    }
    await supabase.rpc("set_pin", { _pin: pin });
    setBusy(false);
    await afterLogin();
  }

  return (
    <Tabs defaultValue="login">
      <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-muted p-1">
        <TabsTrigger value="login" className="rounded-xl">Connexion</TabsTrigger>
        <TabsTrigger value="register" className="rounded-xl">Inscription</TabsTrigger>
      </TabsList>

      <TabsContent value="login" className="mt-6">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="loginId">Email ou téléphone</Label>
            <Input id="loginId" value={loginId} onChange={(e) => setLoginId(e.target.value)} required placeholder="vous@exemple.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loginPass">Mot de passe</Label>
            <Input id="loginPass" type="password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} required />
          </div>
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl text-base font-semibold">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Se connecter"}
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="register" className="mt-6">
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom complet</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+225 07 00 00 00 00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin">Code PIN (4 chiffres)</Label>
            <Input
              id="pin"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              required
              className="tracking-[0.6em]"
              placeholder="••••"
            />
          </div>
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl text-base font-semibold">
            {busy ? <Loader2 className="size-4 animate-spin" /> : "Créer mon compte"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}