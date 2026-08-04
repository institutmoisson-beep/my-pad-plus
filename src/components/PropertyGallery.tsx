import { ChevronLeft, ChevronRight, ImageOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSignedPhotos } from "@/hooks/useSignedPhotos";

export function PropertyGallery({
  photos,
  title,
}: {
  photos: string[] | undefined;
  title: string;
}) {
  const { data, isLoading, isError } = useSignedPhotos(photos);
  const [index, setIndex] = useState<number | null>(null);
  const items = data ?? [];

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => (i === null ? i : (i + 1) % items.length));
      if (e.key === "ArrowLeft") setIndex((i) => (i === null ? i : (i - 1 + items.length) % items.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length]);

  if (!photos || photos.length === 0) return null;

  if (isLoading) {
    return (
      <div className="mt-3 flex h-24 items-center justify-center rounded-2xl bg-muted">
        <Loader2 className="size-4 animate-spin text-secondary" />
      </div>
    );
  }

  if (isError || items.length === 0) {
    return (
      <div className="mt-3 flex h-24 items-center justify-center gap-2 rounded-2xl bg-muted text-xs text-muted-foreground">
        <ImageOff className="size-4" /> Images indisponibles
      </div>
    );
  }

  const current = index === null ? null : items[index];

  return (
    <>
      <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {items.map((p, i) => (
          <li key={p.path} className="shrink-0">
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Voir la photo ${i + 1} de ${title}`}
              className="block overflow-hidden rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-secondary"
            >
              <img
                src={p.thumbUrl ?? undefined}
                alt={`${title} — photo ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="size-24 object-cover transition-transform active:scale-95"
              />
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={index !== null} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent className="max-w-[95vw] rounded-3xl p-3 sm:max-w-2xl">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {current && (
            <div className="relative">
              <img
                src={current.url ?? undefined}
                alt={`${title} — photo ${(index ?? 0) + 1}`}
                className="max-h-[70vh] w-full rounded-2xl object-contain"
              />
              {items.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Photo précédente"
                    onClick={() => setIndex((i) => ((i ?? 0) - 1 + items.length) % items.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-soft"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Photo suivante"
                    onClick={() => setIndex((i) => ((i ?? 0) + 1) % items.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 shadow-soft"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {(index ?? 0) + 1} / {items.length}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}