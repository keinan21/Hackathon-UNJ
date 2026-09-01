import { useEffect, useState, useCallback } from "react";

const DISMISSED_KEY = "pwa-prompt-dismissed-at";
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return false;
    const sevenDaysMs = DISMISS_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < sevenDaysMs;
  } catch {
    return false;
  }
}

export interface UsePWAInstallReturn {
  canInstall: boolean;
  promptInstall: () => Promise<void>;
  dismiss: () => void;
  isDismissed: boolean;
}

/**
 * Hook PWA install prompt — sopan, tidak memblokir.
 * - Listen `beforeinstallprompt`, simpan event.
 * - Respect 7 hari dismiss via localStorage `pwa-prompt-dismissed-at`.
 * - `promptInstall` panggil `deferredPrompt.prompt()`.
 * - `dismiss` set timestamp dan sembunyikan prompt sesi ini.
 */
export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => isDismissedRecently());

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      if (isDismissedRecently()) {
        return;
      }
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Jika sudah ter-install (standalone), tidak perlu prompt
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) {
      setDeferredPrompt(null);
    }

    // Listen appinstalled → clear prompt
    const installedHandler = () => setDeferredPrompt(null);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // ignore storage errors
    }
    setIsDismissed(true);
    setDeferredPrompt(null);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "dismissed") {
      dismiss();
    } else {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt, dismiss]);

  const canInstall = deferredPrompt !== null && !isDismissed;

  return { canInstall, promptInstall, dismiss, isDismissed };
}

export const PWA_DISMISSED_KEY = DISMISSED_KEY;
export const PWA_DISMISS_DAYS = DISMISS_DAYS;
