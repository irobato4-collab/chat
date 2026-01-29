const CACHE_NAME = "chatapp-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/style.css",
  "/client.js",
  "/manifest.json",
  "/favicon.ico"
];

// インストール時にキャッシュ
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// アクティベート時に古いキャッシュ削除
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ネットワーク優先、オフラインならキャッシュ
self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(res => {
        // 更新されたらキャッシュに保存
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push通知受信
self.addEventListener("push", event => {
  let data = { title: "New message", body: "メッセージが届きました" };
  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico"
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// 通知クリックでアプリをフォーカス
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
