/**
 * ledgr – public/sw.js
 * Service worker: handles background push notifications
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", e => {
  if (!e.data) return;

  let data;
  try {
    data = e.data.json();
  } catch {
    data = { title: "ledgr.", body: e.data.text() };
  }

  const title   = data.title || "ledgr.";
  const options = {
    body:    data.body  || "New transactions have been synced.",
    icon:    "/icon-192.png",
    badge:   "/icon-192.png",
    tag:     "ledgr-sync",          // replaces previous notification of same tag
    renotify: true,
    data:    { url: data.url || "/" },
    actions: [
      { action: "view",    title: "View Transactions" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();

  if (e.action === "dismiss") return;

  // Focus existing window or open new one
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      const ledgrClient = clients.find(c => c.url.includes(self.location.origin));
      if (ledgrClient) {
        ledgrClient.focus();
        ledgrClient.postMessage({ type: "NEW_TRANSACTIONS" });
      } else {
        self.clients.openWindow(e.notification.data?.url || "/");
      }
    })
  );
});
