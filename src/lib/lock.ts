const KEY = "imo_msn_unlocked";

export function isUnlocked() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY) === "1";
}

export function unlock() {
  sessionStorage.setItem(KEY, "1");
  window.dispatchEvent(new Event("imo-lock-change"));
}

export function lock() {
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event("imo-lock-change"));
}