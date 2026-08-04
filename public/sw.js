// Kill-switch worker: evicts the previous Imo MSN offline cache that could keep
// serving a stale "Internal server error" page inside the installed app.
function isImoMsnCache(name) {
  return /^imo-msn-/.test(name);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(names.filter(isImoMsnCache).map((n) => caches.delete(n)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(windowClients.map((c) => c.navigate(c.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
