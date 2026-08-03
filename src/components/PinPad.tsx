import { Delete, Fingerprint } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function PinPad({
  onComplete,
  onBiometric,
  busy,
  error,
  label = "Entrez votre code PIN",
}: {
  onComplete: (pin: string) => void;
  onBiometric?: (() => void) | undefined;
  busy?: boolean;
  error?: string | null;
  label?: string;
}) {
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (pin.length === 4) {
      const value = pin;
      setPin("");
      onComplete(value);
    }
  }, [pin, onComplete]);

  useEffect(() => {
    if (error) setPin("");
  }, [error]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "bio", "0", "del"];

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <motion.div animate={error ? { x: [0, -8, 8, -6, 0] } : {}} className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "size-13 rounded-2xl border-2 transition-all",
              "flex size-14 items-center justify-center text-2xl font-bold",
              pin.length > i
                ? "border-secondary bg-secondary/10 text-secondary"
                : "border-border bg-card text-transparent",
            )}
          >
            •
          </span>
        ))}
      </motion.div>
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
        {keys.map((k) => {
          if (k === "bio") {
            return (
              <button
                key={k}
                type="button"
                disabled={!onBiometric || busy}
                onClick={onBiometric}
                aria-label="Empreinte digitale"
                className="flex h-14 items-center justify-center rounded-2xl text-success disabled:opacity-25"
              >
                <Fingerprint className="size-7" />
              </button>
            );
          }
          if (k === "del") {
            return (
              <button
                key={k}
                type="button"
                onClick={() => setPin((p) => p.slice(0, -1))}
                aria-label="Effacer"
                className="flex h-14 items-center justify-center rounded-2xl text-muted-foreground active:bg-muted"
              >
                <Delete className="size-6" />
              </button>
            );
          }
          return (
            <button
              key={k}
              type="button"
              disabled={busy}
              onClick={() => setPin((p) => (p.length < 4 ? p + k : p))}
              className="h-14 rounded-2xl bg-card text-xl font-semibold text-primary shadow-soft transition active:scale-95 active:bg-muted disabled:opacity-50"
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}