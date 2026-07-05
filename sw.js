// sw.js — Service Worker لتطبيق M-Tech Chat
// يُرفع في جذر الموقع (نفس مستوى index.html) حتى يصل مساره إلى https://domain/sw.js

const CACHE_NAME = "mtech-chat-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ===== استقبال إشعار Push حتى لو كان الموقع/المتصفح مغلقًا تمامًا =====
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "M-Tech Chat", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "M-Tech Chat";
  const options = {
    body: payload.body || "لديك رسالة جديدة",
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-96.png",
    tag: payload.tag || "mtech-message",
    renotify: true,
    dir: "rtl",
    lang: "ar",
    data: {
      url: payload.url || "/",
      chatId: payload.chatId || null,
    },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ===== عند الضغط على الإشعار: فتح المحادثة المعنية أو التركيز على نافذة مفتوحة =====
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope) && "focus" in client) {
          client.postMessage({ type: "OPEN_CHAT", data: event.notification.data });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    }),
  );
});
