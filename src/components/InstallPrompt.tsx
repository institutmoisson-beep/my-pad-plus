import { Download, Share, SquarePlus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { type BeforeInstallPromptEvent, isIos, isStandalone } from "@/lib/pwa";

const DISMISS_KEY = "imo_msn_install_dismissed_at";
const DISMISS_DAYS = 7;

function wasRecentlyDismissed() {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const elapsedMs = Date.now() - Number(raw);
  return elapsedMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Surfaces the native "add to home screen" prompt automatically as soon as the
 * browser makes it available (Android/desktop Chrome/Edge), and shows guided
 * instructions on iOS Safari, which has no programmatic install prompt.
 * A single tap on "Installer" triggers the real browser prompt — browsers
 * require that gesture, so this is the earliest a prompt can appear unprompted.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyDismissed()) return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    function onInstalled() {
      setVisible(false);
      setDeferred(null);
    }
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari never fires beforeinstallprompt — surface manual instructions instead.
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    if (isIos()) {
      iosTimer = setTimeout(() => {
        setShowIosHelp(true);
        setVisible(true);
      }, 1200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome !== "accepted") dismiss();
    else {
      setVisible(false);
      setDeferred(null);
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto max-w-lg rounded-3xl bg-primary p-4 text-primary-foreground shadow-float"
          role="dialog"
          aria-label="Installer l'application Imo MSN"
        >
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="absolute right-3 top-3 rounded-full p-1 text-primary-foreground/60 hover:text-primary-foreground"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-start gap-3 pr-5">
            <Logo size={40} />
            <div className="flex-1">
              <p className="text-sm font-bold">Installer Imo MSN</p>
              <p className="mt-0.5 text-xs text-primary-foreground/75">
                {showIosHelp
                  ? "Ajoutez Imo MSN à votre écran d'accueil pour un accès rapide."
                  : "Ajoutez l'application à votre écran d'accueil pour un accès rapide et hors-ligne."}
              </p>
            </div>
          </div>

          {showIosHelp ? (
            <div className="mt-3 space-y-1.5 rounded-2xl bg-primary-foreground/10 p-3 text-xs">
              <p className="flex items-center gap-2">
                <Share className="size-3.5 shrink-0" /> 1. Appuyez sur le bouton Partager
              </p>
              <p className="flex items-center gap-2">
                <SquarePlus className="size-3.5 shrink-0" /> 2. Choisissez « Sur l&apos;écran d&apos;accueil »
              </p>
            </div>
          ) : (
            <Button
              onClick={install}
              className="mt-3 h-11 w-full gap-2 rounded-2xl bg-background text-primary hover:bg-background/90"
            >
              <Download className="size-4" /> Installer l&apos;application
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
