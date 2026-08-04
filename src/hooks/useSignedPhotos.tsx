import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { thumbPath } from "@/lib/images";

const BUCKET = "property-photos";
const EXPIRES_IN = 60 * 60; // 1 h — mis en cache côté client, aucun appel répété

/** Normalise les anciennes URL publiques en chemins de stockage. */
export function toStoragePath(value: string): string {
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(value.slice(idx + marker.length).split("?")[0] ?? "");
  return value;
}

export type SignedPhoto = { path: string; url: string | null; thumbUrl: string | null };

/**
 * Signe en un seul appel réseau toutes les images d'un bien (image + miniature),
 * puis met le résultat en cache : tenable même avec un très grand nombre d'utilisateurs.
 */
export function useSignedPhotos(photos: string[] | undefined, enabled = true) {
  const paths = (photos ?? []).map(toStoragePath).filter(Boolean);

  return useQuery({
    queryKey: ["signed-photos", paths],
    enabled: enabled && paths.length > 0,
    staleTime: (EXPIRES_IN - 300) * 1000,
    gcTime: EXPIRES_IN * 1000,
    retry: 2,
    queryFn: async (): Promise<SignedPhoto[]> => {
      const thumbs = paths.map(thumbPath);
      const wanted = Array.from(new Set([...paths, ...thumbs]));
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(wanted, EXPIRES_IN);
      if (error) throw error;
      const map = new Map((data ?? []).map((d) => [d.path ?? "", d.signedUrl]));
      return paths.map((p) => ({
        path: p,
        url: map.get(p) ?? null,
        thumbUrl: map.get(thumbPath(p)) ?? map.get(p) ?? null,
      }));
    },
  });
}