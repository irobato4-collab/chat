/* =========================
   Service Worker
========================= */

const CACHE_NAME = "chat-pwa-v1";
const OFFLINE_URLS = [
  "/",
  "/index.html",
  "/style.css",
  "/client.js",
  "/socket.io/socket.io.js",
  "/manifest.json"
];

/* ===== インストール ===== */
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  );
});

/* ===== 有効化 ===== */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/* ===== fetch（オフライン対応） ===== */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ===== Push通知 ===== */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge.png",
    data: {
      time: data.time || Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "新着メッセージ", options)
  );
});

/* ===== 通知クリック ===== */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes("/") && "focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
