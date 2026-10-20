// Service worker used for browser notifications.
// Keeping this file minimal means it only handles notification delivery and
// clicks; it intentionally does not cache pages or intercept network requests.

self.addEventListener("install", (event) => {
  // Activate the new service worker immediately so the first notification can
  // be shown without waiting for every tab to close.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const dashboardUrl = new URL("/dashboard", self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(dashboardUrl);
        }

        return undefined;
      })
  );
});
