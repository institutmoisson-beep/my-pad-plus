import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Fingerprint,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth, useProfile, useRoles } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lock } from "@/lib/lock";
import { playChime } from "@/lib/sound";
import { platformAuthenticatorAvailable, registerBiometric } from "@/lib/webauthn";

export const Route = createFileRoute("/_authenticated/app/profil")({
  head: () => ({
    meta: [
      { title: "Profil — Imo MSN" },
      { name: "description", content: "Gérez votre profil et votre sécurité : PIN, biométrie et mot de passe." },
      { property: "og:title", content: "Profil — Imo MSN" },
      { property: "og:description", content: "Gérez votre profil et votre sécurité." },
    ],
  }),
  component: ProfilPage,
});

function ProfilPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const { data: roles = [] } = useRoles();
  const [bioBusy, setBioBusy] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);

  useEffect(() => {
    void platformAuthenticatorAvailable().then(setBioSupported);
  }, []);

  const becomeLandlord = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("become_landlord");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vous êtes maintenant propriétaire");
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  async function toggleBiometric(checked: boolean) {
    if (!profile) return;
    setBioBusy(true);
    try {
      if (checked) {
        const cred = await registerBiometric(profile.id, profile.full_name);
        const { error } = await supabase
          .from("profiles")
          .update({ biometric_enabled: true, biometric_credential: cred })
          .eq("id", profile.id);
        if (error) throw error;
        toast.success("Empreinte digitale activée");
      } else {
        const { error } = await supabase
          .from("profiles")
          .update({ biometric_enabled: false, biometric_credential: null })
          .eq("id", profile.id);
        if (error) throw error;
        toast.success("Empreinte digitale désactivée");
      }
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error("Échec", { description: e instanceof Error ? e.message : "Action annulée" });
    } finally {
      setBioBusy(false);
    }
  }

  async function handleLogout() {
    lock();
    await supabase.auth.signOut();
    void navigate({ to: "/auth", replace: true });
  }

  const roleLabels: Record<string, string> = {
    admin: "Administrateur",
    landlord: "Propriétaire",
    tenant: "Locataire",
    user: "Utilisateur",
  };

  return (
    <AppShell title="Profil" subtitle="Informations et sécurité">
      <section className="rounded-3xl bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-full bg-gradient-royal text-lg font-bold text-primary-foreground">
            {(profile?.full_name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold text-primary">{profile?.full_name || "Sans nom"}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <span key={r} className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary">
                  {roleLabels[r] ?? r}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          {profile?.email && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" /> {profile.email}
            </p>
          )}
          {profile?.phone && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" /> {profile.phone}
            </p>
          )}
        </div>
      </section>

      {!roles.includes("landlord") && (
        <Button
          variant="outline"
          disabled={becomeLandlord.isPending}
          onClick={() => becomeLandlord.mutate()}
          className="mt-4 h-14 w-full justify-start gap-3 rounded-2xl border-border bg-card text-base shadow-soft"
        >
          <Building2 className="size-5 text-primary" /> Devenir propriétaire
        </Button>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">Sécurité</h2>
        <div className="space-y-3">
          <ChangePinDialog />
          <ChangePasswordDialog />
          <div className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <Fingerprint className="size-5 text-success" />
              <div>
                <p className="text-sm font-semibold text-primary">Connexion par empreinte</p>
                <p className="text-xs text-muted-foreground">
                  {bioSupported ? "Disponible sur cet appareil" : "Non disponible sur cet appareil"}
                </p>
              </div>
            </div>
            <Switch
              checked={!!profile?.biometric_enabled}
              disabled={!bioSupported || bioBusy}
              onCheckedChange={toggleBiometric}
            />
          </div>
        </div>
      </section>

      <Button
        variant="ghost"
        onClick={handleLogout}
        className="mt-8 w-full gap-2 text-destructive hover:text-destructive"
      >
        <LogOut className="size-4" /> Se déconnecter
      </Button>
    </AppShell>
  );
}

function ChangePinDialog() {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (!/^[0-9]{4}$/.test(pin)) throw new Error("Le code PIN doit contenir 4 chiffres");
      if (pin !== confirm) throw new Error("Les codes PIN ne correspondent pas");
      const { error } = await supabase.rpc("set_pin", { _pin: pin });
      if (error) throw error;
    },
    onSuccess: () => {
      playChime("success");
      toast.success("Code PIN mis à jour");
      setOpen(false);
      setPin("");
      setConfirm("");
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-soft active:scale-[0.99]"
        >
          <KeyRound className="size-5 text-secondary" />
          <div>
            <p className="text-sm font-semibold text-primary">Code PIN</p>
            <p className="text-xs text-muted-foreground">Modifier votre code à 4 chiffres</p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Modifier le code PIN</DialogTitle>
          <DialogDescription>Choisissez un nouveau code à 4 chiffres.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-pin">Nouveau code PIN</Label>
            <Input
              id="new-pin"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="tracking-[0.6em]"
              placeholder="••••"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pin">Confirmer</Label>
            <Input
              id="confirm-pin"
              inputMode="numeric"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="tracking-[0.6em]"
              placeholder="••••"
            />
          </div>
          <Button
            disabled={pin.length !== 4 || submit.isPending}
            onClick={() => submit.mutate()}
            className="h-12 w-full rounded-2xl"
          >
            {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      if (password.length < 6) throw new Error("6 caractères minimum");
      if (password !== confirm) throw new Error("Les mots de passe ne correspondent pas");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mot de passe mis à jour");
      setOpen(false);
      setPassword("");
      setConfirm("");
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-soft active:scale-[0.99]"
        >
          <ShieldCheck className="size-5 text-secondary" />
          <div>
            <p className="text-sm font-semibold text-primary">Mot de passe</p>
            <p className="text-xs text-muted-foreground">Modifier votre mot de passe</p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Modifier le mot de passe</DialogTitle>
          <DialogDescription>Choisissez un nouveau mot de passe.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-pass">Nouveau mot de passe</Label>
            <Input id="new-pass" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pass">Confirmer</Label>
            <Input id="confirm-pass" type="password" minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button
            disabled={!password || submit.isPending}
            onClick={() => submit.mutate()}
            className="h-12 w-full rounded-2xl"
          >
            {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

