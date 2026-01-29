const CACHE_NAME = "chat-app-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/style.css",
  "/client.js",
  "/manifest.json",
  "/socket.io/socket.io.js"
];

/* =========================
   インストール（初回）
========================= */
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

/* =========================
   有効化
========================= */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

/* =========================
   fetch（オフライン対応）
========================= */
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, copy);
        });
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

/* =========================
   Push 通知受信（②で使用）
========================= */
self.addEventListener("push", event => {
  let data = { title: "Chat App", body: "新着メッセージがあります" };

  if (event.data) {
    data = event.data.json();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "chat-notification",
      renotify: true
    })
  );
});

/* =========================
   通知クリック
========================= */
self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.includes("/index.html")) {
            return client.focus();
          }
        }
        return clients.openWindow("/index.html");
      })
  );
});
