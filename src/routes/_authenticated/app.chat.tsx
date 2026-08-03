import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  File as FileIcon,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Send,
  Square,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Imo MSN" },
      { name: "description", content: "Messagerie directe entre propriétaires et locataires." },
      { property: "og:title", content: "Chat — Imo MSN" },
      { property: "og:description", content: "Messagerie directe entre propriétaires et locataires." },
    ],
  }),
  component: ChatPage,
});

type Contact = { id: string; full_name: string; email: string | null; phone: string | null };

function ChatPage() {
  const { userId } = useAuth();
  const [active, setActive] = useState<Contact | null>(null);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["chat-contacts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("tenancies")
        .select("tenant_id, landlord_id")
        .or(`tenant_id.eq.${userId},landlord_id.eq.${userId}`)
        .eq("active", true);
      if (error) throw error;
      const otherIds = new Set<string>();
      for (const row of rows ?? []) {
        const other = row.tenant_id === userId ? row.landlord_id : row.tenant_id;
        if (other && other !== userId) otherIds.add(other);
      }
      if (otherIds.size === 0) return [];
      const { data: profs, error: perr } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", Array.from(otherIds));
      if (perr) throw perr;
      return (profs ?? []) as Contact[];
    },
  });

  if (active) {
    return <ConversationView contact={active} onBack={() => setActive(null)} />;
  }

  return (
    <AppShell title="Chat" subtitle="Messagerie avec vos propriétaires ou locataires">
      {isLoading && <p className="text-center text-sm text-muted-foreground">Chargement…</p>}
      {!isLoading && (contacts ?? []).length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aucune conversation disponible. Associez un bien pour discuter avec votre propriétaire ou locataire.
          </p>
        </div>
      )}
      <ul className="space-y-2">
        {(contacts ?? []).map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setActive(c)}
              className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-soft active:scale-[0.99]"
            >
              <div className="flex size-11 items-center justify-center rounded-full bg-gradient-royal text-sm font-bold text-primary-foreground">
                {(c.full_name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-primary">{c.full_name || "Sans nom"}</p>
                <p className="text-[11px] text-muted-foreground">{c.email ?? c.phone}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
};

function ConversationView({ contact, onBack }: { contact: Contact; onBack: () => void }) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["messages", userId, contact.id],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${userId},recipient_id.eq.${contact.id}),and(sender_id.eq.${contact.id},recipient_id.eq.${userId})`,
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
    refetchInterval: 8000,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!userId) return;
    void supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", contact.id)
      .eq("recipient_id", userId)
      .is("read_at", null);

    const channel = supabase
      .channel(`chat-${userId}-${contact.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const belongs =
            (m.sender_id === userId && m.recipient_id === contact.id) ||
            (m.sender_id === contact.id && m.recipient_id === userId);
          if (belongs) void queryClient.invalidateQueries({ queryKey: ["messages", userId, contact.id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, contact.id, queryClient]);

  const send = useMutation({
    mutationFn: async (payload: { body?: string; attachment_url?: string; attachment_type?: string }) => {
      const { error } = await supabase.from("messages").insert({
        sender_id: userId!,
        recipient_id: contact.id,
        body: payload.body ?? null,
        attachment_url: payload.attachment_url ?? null,
        attachment_type: payload.attachment_type ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      void queryClient.invalidateQueries({ queryKey: ["messages", userId, contact.id] });
    },
    onError: (e: Error) => toast.error("Échec de l'envoi", { description: e.message }),
  });

  async function uploadAndSend(file: File | Blob, name: string, kind: string) {
    const path = `${userId}/${Date.now()}-${name}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file);
    if (error) {
      toast.error("Échec de l'envoi", { description: error.message });
      return;
    }
    const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
    send.mutate({ attachment_url: data.publicUrl, attachment_type: kind });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        void uploadAndSend(blob, "voice-note.webm", "voice");
      };
      rec.start();
      mediaRecorder.current = rec;
      setRecording(true);
    } catch {
      toast.error("Microphone indisponible", { description: "Autorisez l'accès au micro pour enregistrer." });
    }
  }

  function stopRecording() {
    mediaRecorder.current?.stop();
    setRecording(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <button type="button" onClick={onBack} aria-label="Retour" className="rounded-full p-1.5 hover:bg-muted">
          <ArrowLeft className="size-5 text-primary" />
        </button>
        <div className="flex size-9 items-center justify-center rounded-full bg-gradient-royal text-xs font-bold text-primary-foreground">
          {(contact.full_name || "?").slice(0, 1).toUpperCase()}
        </div>
        <p className="font-semibold text-primary">{contact.full_name || "Conversation"}</p>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4 pb-28">
        {(messages ?? []).map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-soft",
                  mine ? "bg-gradient-sky text-secondary-foreground" : "bg-card text-foreground",
                )}
              >
                {m.body && <p>{m.body}</p>}
                {m.attachment_type === "image" && m.attachment_url && (
                  <img src={m.attachment_url} alt="Pièce jointe" className="mt-1 max-h-56 rounded-xl object-cover" />
                )}
                {m.attachment_type === "voice" && m.attachment_url && (
                  <audio controls src={m.attachment_url} className="mt-1 h-9 w-56 max-w-full" />
                )}
                {m.attachment_type === "document" && m.attachment_url && (
                  <a
                    href={m.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 flex items-center gap-2 rounded-xl bg-background/40 px-2.5 py-2 text-xs font-medium underline"
                  >
                    <FileIcon className="size-3.5" /> Document joint
                  </a>
                )}
                <p className="mt-1 text-right text-[10px] opacity-70">
                  {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 px-3 py-2.5 pb-[calc(0.6rem+env(safe-area-inset-bottom))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <label className="cursor-pointer rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Image">
            <ImageIcon className="size-5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAndSend(f, f.name, "image");
                e.target.value = "";
              }}
            />
          </label>
          <label className="cursor-pointer rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Document">
            <Paperclip className="size-5" />
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAndSend(f, f.name, "document");
                e.target.value = "";
              }}
            />
          </label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim()) send.mutate({ body: text.trim() });
            }}
            placeholder="Écrire un message…"
            className="h-10 flex-1 rounded-full border border-border bg-card px-4 text-sm outline-none focus:border-secondary"
          />
          {text.trim() ? (
            <Button
              size="icon"
              disabled={send.isPending}
              onClick={() => send.mutate({ body: text.trim() })}
              className="size-10 shrink-0 rounded-full"
            >
              <Send className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant={recording ? "destructive" : "default"}
              onClick={recording ? stopRecording : startRecording}
              className="size-10 shrink-0 rounded-full"
              aria-label={recording ? "Arrêter" : "Enregistrer un message vocal"}
            >
              {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

