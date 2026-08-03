import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth, useRoles } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { money, PROPERTY_TYPES, typeLabel } from "@/lib/format";
import { playChime } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/app/biens")({
  head: () => ({
    meta: [
      { title: "Mes Biens — Imo MSN" },
      { name: "description", content: "Gérez vos biens immobiliers et vos locataires." },
      { property: "og:title", content: "Mes Biens — Imo MSN" },
      { property: "og:description", content: "Gérez vos biens immobiliers et vos locataires." },
    ],
  }),
  component: BiensPage,
});

type Property = {
  id: string;
  name: string;
  type: string;
  rent_amount: number;
  due_day: number;
  city: string | null;
  district: string | null;
  address: string | null;
  description: string | null;
  photos: string[];
};

function BiensPage() {
  const { userId } = useAuth();
  const { data: roles = [] } = useRoles();
  const isLandlord = roles.includes("landlord");

  const becomeLandlord = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("become_landlord");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vous êtes maintenant propriétaire");
      window.location.reload();
    },
  });

  const { data: properties, isLoading } = useQuery({
    queryKey: ["my-properties", userId],
    enabled: !!userId && isLandlord,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("landlord_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Property[];
    },
  });

  if (!isLandlord) {
    return (
      <AppShell title="Mes Biens">
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <Building2 className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Devenez propriétaire pour ajouter et gérer vos biens.
          </p>
          <Button
            disabled={becomeLandlord.isPending}
            onClick={() => becomeLandlord.mutate()}
            className="mt-4 rounded-2xl"
          >
            Devenir propriétaire
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Mes Biens" subtitle="Gérez vos propriétés et vos locataires">
      <PropertyFormDialog trigger={
        <Button className="h-12 w-full gap-2 rounded-2xl bg-gradient-sky">
          <Plus className="size-4" /> Ajouter un bien
        </Button>
      } />

      {isLoading && <Loader2 className="mx-auto mt-8 size-5 animate-spin text-secondary" />}

      {!isLoading && (properties ?? []).length === 0 && (
        <p className="mt-8 text-center text-sm text-muted-foreground">Aucun bien ajouté pour le moment.</p>
      )}

      <div className="mt-5 space-y-4">
        {(properties ?? []).map((p) => (
          <PropertyCard key={p.id} property={p} />
        ))}
      </div>
    </AppShell>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const { data: tenancies } = useQuery({
    queryKey: ["property-tenancies", property.id],
    enabled: expanded,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("tenancies")
        .select("*")
        .eq("property_id", property.id)
        .eq("active", true);
      if (error) throw error;
      if (!rows || rows.length === 0) return [];
      const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id)));
      const { data: profs, error: perr } = await supabase
        .from("profiles")
        .select("id, full_name, phone, email")
        .in("id", tenantIds);
      if (perr) throw perr;
      const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profile: profMap.get(r.tenant_id) ?? null }));
    },
  });

  const unlink = useMutation({
    mutationFn: async (tenancyId: string) => {
      const { error } = await supabase.from("tenancies").update({ active: false }).eq("id", tenancyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Locataire retiré du bien");
      void queryClient.invalidateQueries({ queryKey: ["property-tenancies", property.id] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  const deleteProperty = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("properties").delete().eq("id", property.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bien supprimé");
      void queryClient.invalidateQueries({ queryKey: ["my-properties"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <Building2 className="mt-0.5 size-5 shrink-0 text-secondary" />
        <div className="flex-1">
          <p className="font-semibold text-primary">{property.name}</p>
          <p className="text-xs text-muted-foreground">
            {typeLabel(property.type)} · {property.city ?? "—"} {property.district ?? ""}
          </p>
          <p className="mt-1 text-sm font-bold text-success">
            {money(property.rent_amount)} / mois · échéance le {property.due_day}
          </p>
        </div>
        <button
          type="button"
          onClick={() => deleteProperty.mutate()}
          aria-label="Supprimer"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 rounded-xl"
          onClick={() => setExpanded((v) => !v)}
        >
          <Users className="size-3.5" /> {expanded ? "Masquer" : "Locataires"}
        </Button>
        <AssignTenantDialog propertyId={property.id} />
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {(tenancies ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">Aucun locataire associé.</p>
          )}
          {(tenancies ?? []).map((t) => {
            const progress =
              property.rent_amount > 0 ? Math.min(100, (Number(t.paid_current_cycle) / Number(property.rent_amount)) * 100) : 0;
            const prof = t.profile;
            return (
              <div key={t.id} className="rounded-2xl bg-muted p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">{prof?.full_name || "Locataire"}</p>
                    <p className="text-[11px] text-muted-foreground">{prof?.email ?? prof?.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => unlink.mutate(t.id)}
                    className="text-[11px] font-semibold text-destructive"
                  >
                    Retirer
                  </button>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{money(t.paid_current_cycle)} payé</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="mt-1 h-1.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssignTenantDialog({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const results = useQuery({
    queryKey: ["search-users-assign", submitted],
    enabled: submitted.length > 1,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_users", { _q: submitted });
      if (error) throw error;
      return data ?? [];
    },
  });

  const assign = useMutation({
    mutationFn: async (tenantId: string) => {
      const { error } = await supabase.rpc("assign_tenant", { _property_id: propertyId, _tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => {
      playChime("success");
      toast.success("Locataire assigné");
      setOpen(false);
      setQuery("");
      setSubmitted("");
      void queryClient.invalidateQueries({ queryKey: ["property-tenancies", propertyId] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex-1 gap-1.5 rounded-xl bg-gradient-emerald text-success-foreground">
          <UserPlus className="size-3.5" /> Assigner
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Assigner un locataire</DialogTitle>
          <DialogDescription>Recherchez un utilisateur inscrit par nom, email ou téléphone.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
          className="flex gap-2"
        >
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nom, email ou téléphone" />
          <Button type="submit" className="rounded-xl"><Search className="size-4" /></Button>
        </form>
        {results.isFetching && <Loader2 className="mx-auto mt-4 size-5 animate-spin text-secondary" />}
        <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {(results.data ?? []).map((u) => (
            <li key={u.id}>
              <button
                type="button"
                disabled={assign.isPending}
                onClick={() => assign.mutate(u.id)}
                className="flex w-full items-center justify-between rounded-2xl bg-muted p-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-primary">{u.full_name || "Sans nom"}</p>
                  <p className="text-[11px] text-muted-foreground">{u.email ?? u.phone}</p>
                </div>
                <UserPlus className="size-4 text-secondary" />
              </button>
            </li>
          ))}
        </ul>
        {submitted && !results.isFetching && (results.data ?? []).length === 0 && (
          <p className="mt-4 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PropertyFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("studio");
  const [rent, setRent] = useState("");
  const [dueDay, setDueDay] = useState("5");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      const photos: string[] = [];
      if (files) {
        for (const file of Array.from(files)) {
          const path = `${userId}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage.from("property-photos").upload(path, file);
          if (upErr) throw upErr;
          const { data } = supabase.storage.from("property-photos").getPublicUrl(path);
          photos.push(data.publicUrl);
        }
      }
      const { error } = await supabase.from("properties").insert({
        landlord_id: userId!,
        name: name.trim(),
        type: type as never,
        rent_amount: Number(rent),
        due_day: Number(dueDay),
        city: city.trim() || null,
        district: district.trim() || null,
        address: address.trim() || null,
        description: description.trim() || null,
        photos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bien ajouté");
      setOpen(false);
      setName("");
      setRent("");
      setCity("");
      setDistrict("");
      setAddress("");
      setDescription("");
      setFiles(null);
      void queryClient.invalidateQueries({ queryKey: ["my-properties"] });
    },
    onError: (e: Error) => toast.error("Échec", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>Ajouter un bien</DialogTitle>
          <DialogDescription>Renseignez les informations de la propriété.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Nom / Code du bien</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label>Type de bien</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-rent">Loyer mensuel (FCFA)</Label>
              <Input id="p-rent" inputMode="numeric" value={rent} onChange={(e) => setRent(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-due">Jour d&apos;échéance</Label>
              <Input
                id="p-due"
                inputMode="numeric"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-city">Ville</Label>
              <Input id="p-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-district">Quartier</Label>
              <Input id="p-district" value={district} onChange={(e) => setDistrict(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-address">Adresse détaillée</Label>
            <Input id="p-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-photos">Photos</Label>
            <Input id="p-photos" type="file" accept="image/*" multiple onChange={(e) => setFiles(e.target.files)} />
          </div>
          <Button
            disabled={!name || !rent || submit.isPending}
            onClick={() => submit.mutate()}
            className="h-12 w-full rounded-2xl"
          >
            {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : "Ajouter le bien"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
