/**
 * Small cross-browser wrapper around the Notification API.
 *
 * Notification construction rules differ between browsers:
 * - Desktop Chrome/Safari expose `new Notification()`.
 * - Android Chrome throws "Illegal constructor" and requires
 *   `ServiceWorkerRegistration.showNotification()`.
 * - iOS only supports notifications for installed PWAs and also requires
 *   the service worker path.
 *
 * Using the service worker when available keeps every platform on the same
 * code path and also lets notification clicks focus the dashboard.
 */

export type NotificationSupport = "supported" | "unsupported" | "insecure";

const SERVICE_WORKER_READY_TIMEOUT_MS = 1500;

export function getNotificationSupport(): NotificationSupport {
  if (typeof window === "undefined") return "unsupported";

  // The Notification API and service workers only work in secure contexts
  // (HTTPS, localhost, or an installed PWA).
  if (!window.isSecureContext) return "insecure";

  if (!("Notification" in window)) return "unsupported";

  return "supported";
}

export function getNotificationPermission(): NotificationPermission | null {
  if (getNotificationSupport() !== "supported") return null;
  return window.Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | null> {
  if (getNotificationSupport() !== "supported") return null;

  try {
    if (window.Notification.permission !== "default") {
      return window.Notification.permission;
    }

    return await window.Notification.requestPermission();
  } catch (error) {
    console.error("Could not request notification permission:", error);
    return null;
  }
}

export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !window.isSecureContext) return null;
  if (!("serviceWorker" in navigator)) return null;

  try {
    return await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
  } catch (error) {
    console.warn("Could not register notification service worker:", error);
    return null;
  }
}

function waitForActiveServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(
      () => resolve(null),
      SERVICE_WORKER_READY_TIMEOUT_MS
    );

    navigator.serviceWorker.ready.then(
      (registration) => {
        window.clearTimeout(timeoutId);
        resolve(registration);
      },
      () => {
        window.clearTimeout(timeoutId);
        resolve(null);
      }
    );
  });
}

export async function showNotification(
  title: string,
  options: NotificationOptions = {}
): Promise<boolean> {
  if (getNotificationPermission() !== "granted") return false;

  // Prefer the service worker implementation so the same code works on
  // desktop and mobile browsers.
  const registration = await waitForActiveServiceWorker();

  if (registration && typeof registration.showNotification === "function") {
    try {
      await registration.showNotification(title, options);
      return true;
    } catch (error) {
      console.warn(
        "Service worker notification failed, trying the page constructor:",
        error
      );
    }
  }

  try {
    new window.Notification(title, options);
    return true;
  } catch (error) {
    console.error("Could not show notification:", error);
    return false;
  }
}
