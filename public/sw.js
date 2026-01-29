self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", event => {
  if (event.data?.type === "NOTIFY") {
    self.registration.showNotification("新しいメッセージ", {
      body: event.data.text,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "chat-notify",
      renotify: true
    });
  }
});
