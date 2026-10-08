import { supabase } from "@/integrations/supabase/client";

function device() {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "Mac" : "Autre";
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  return `${os}${standalone ? " · App" : " · Web"}`;
}

export function logActivity(path: string, action = "page_view", label?: string) {
  void supabase
    .rpc("log_activity", { _path: path, _action: action, _label: label ?? null, _device: device() } as never)
    .then(() => undefined, () => undefined);
}
