const CACHE = "atencion-cliente-campo-v23";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function sameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Las API nunca se guardan en caché.
  if (url.pathname.startsWith("/api/")) return;

  // Archivos estáticos de Next.js: caché primero.
  if (sameOrigin(request) && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;

        return fetch(request).then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }

          return response;
        });
      })
    );

    return;
  }

  // Navegación principal.
  if (request.mode === "navigate") {
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("network-timeout")), 2500)
        ),
      ])
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put("/", copy));
          }

          return response;
        })
        .catch(() =>
          caches.match("/").then(cached => cached || fetch(request))
        )
    );

    return;
  }

  // Otros archivos: caché inmediato y actualización en segundo plano.
  if (sameOrigin(request)) {
    event.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request)
          .then(response => {
            if (response && response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then(cache => cache.put(request, copy));
            }

            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
  }
});
