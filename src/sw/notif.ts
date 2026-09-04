/**
 * TASK-10 [FRD-03] — Service Worker notif handler stub
 *
 * Stub untuk push notification via Service Worker.
 * Tidak perlu real SW di test — cukup export fungsi showNotification
 * yang aman dipanggil di Node (fallback ke console.log atau native Notification).
 *
 * Real PWA: vite-plugin-pwa generateSW dengan workbox, SW akan handle push
 * via self.addEventListener('push', ...) — tidak diperlukan untuk unit test TASK-10.
 *
 * Trace: TASK-10 [FRD-03] — src/sw/notif.ts
 * References: CONTEXT.md:20-21 Notifikasi push PWA + badge dashboard di H-threshold
 */

export type ShowNotificationOptions = NotificationOptions & {
  tag?: string;
  badge?: string;
  icon?: string;
  data?: unknown;
};

/**
 * Stub showNotification — dipakai oleh src/engine/notifScheduler.ts checkAndNotify
 *
 * - Jika ada ServiceWorkerRegistration: pakai registration.showNotification
 * - Jika tidak: fallback ke native Notification (jika permission granted)
 * - Jika Node/test tanpa Notification: console.log saja, resolve
 *
 * MUST NOT throw di test — selalu resolve.
 */
export async function showNotification(
  title: string,
  options?: ShowNotificationOptions
): Promise<void> {
  try {
    const g = globalThis as unknown as {
      navigator?: { serviceWorker?: { ready: Promise<ServiceWorkerRegistration> } };
      Notification?: typeof Notification;
    };

    // Coba SW registration jika ada
    if (
      g.navigator &&
      g.navigator.serviceWorker &&
      typeof g.navigator.serviceWorker.ready !== "undefined"
    ) {
      try {
        const reg = await g.navigator.serviceWorker.ready;
        // ServiceWorkerRegistration.showNotification tersedia di SW context
        if (reg && typeof (reg as unknown as { showNotification?: unknown }).showNotification === "function") {
          await (reg as unknown as { showNotification: (t: string, o?: NotificationOptions) => Promise<void> }).showNotification(
            title,
            options
          );
          return;
        }
      } catch {
        // fallback ke native
      }
    }

    // Fallback native Notification jika tersedia dan permission granted
    if (
      typeof g.Notification !== "undefined" &&
      g.Notification.permission === "granted"
    ) {
      try {
        // eslint-disable-next-line no-new
        new g.Notification(title, options as NotificationOptions);
        return;
      } catch {
        // ignore
      }
    }

    // Final fallback — log saja (aman di test)
    console.log(`[SW notif stub] ${title}`, options?.body ?? "");
  } catch {
    // MUST NOT throw
    console.log(`[SW notif stub fallback] ${title}`);
  }
}

/**
 * Stub untuk handle push event di Service Worker (tidak dipanggil di unit test)
 * Export agar sw.js generated bisa import jika diperlukan.
 */
export function handlePushEvent(_event: unknown): void {
  // Stub — real SW handlePushEvent akan parse payload dan showNotification
  console.log("[SW notif stub] handlePushEvent — no-op v1");
}

export function getNotificationPermission(): NotificationPermission {
  try {
    const g = globalThis as unknown as { Notification?: { permission: NotificationPermission } };
    if (typeof g.Notification === "undefined") return "denied";
    const p = g.Notification.permission;
    if (p === "granted" || p === "denied" || p === "default") return p;
    return "denied";
  } catch {
    return "denied";
  }
}

/**
 * Stub untuk request permission — wrapper agar engine tidak import Notification langsung di test
 * Jika ditolak → tidak throw, return "denied", badge tetap update via checkAndNotify fallback path
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const g = globalThis as unknown as {
    Notification?: { permission: NotificationPermission; requestPermission: () => Promise<NotificationPermission> };
  };
  if (typeof g.Notification === "undefined") return "denied";
  if (g.Notification.permission === "granted" || g.Notification.permission === "denied") {
    return g.Notification.permission;
  }
  try {
    return await g.Notification.requestPermission();
  } catch {
    return "denied";
  }
}
