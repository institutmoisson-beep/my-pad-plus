import { useCallback, useEffect, useState } from "react";

const KEY = "imo-msn-hide-balance";

/** Préférence locale : masquer les montants sensibles (solde). */
export function useHideBalance() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(localStorage.getItem(KEY) === "1");
    const onChange = () => setHidden(localStorage.getItem(KEY) === "1");
    window.addEventListener("imo-hide-balance", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("imo-hide-balance", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const toggle = useCallback(() => {
    const next = localStorage.getItem(KEY) === "1" ? "0" : "1";
    localStorage.setItem(KEY, next);
    window.dispatchEvent(new Event("imo-hide-balance"));
  }, []);

  const mask = useCallback((value: string) => (hidden ? "••••••" : value), [hidden]);

  return { hidden, toggle, mask };
}
