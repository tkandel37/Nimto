"use client";

import { useEffect, useState } from "react";

const INSTALL_DELAY_MS = 60_000;
const INSTALL_VISIBLE_MS = 60_000;
const INSTALL_DISMISSED_UNTIL_KEY = "mynimto:pwa-install-dismissed-until";
const INSTALLED_KEY = "mynimto:pwa-installed";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRegistration() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [canOfferInstall, setCanOfferInstall] = useState(false);
  const [installVisible, setInstallVisible] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((nextRegistration) => {
        nextRegistration.addEventListener("updatefound", () => {
          const worker = nextRegistration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => undefined);

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) {
      window.localStorage.setItem(INSTALLED_KEY, "true");
    }

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      const dismissedUntil = Number(
        window.localStorage.getItem(INSTALL_DISMISSED_UNTIL_KEY) ?? 0,
      );
      if (
        standalone ||
        window.localStorage.getItem(INSTALLED_KEY) === "true" ||
        dismissedUntil > Date.now()
      ) {
        return;
      }
      setInstallPrompt(event as InstallPromptEvent);
      setCanOfferInstall(true);
    };
    const installed = () => {
      window.localStorage.setItem(INSTALLED_KEY, "true");
      setInstallPrompt(null);
      setCanOfferInstall(false);
      setInstallVisible(false);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  useEffect(() => {
    if (!canOfferInstall || updateReady) return;
    const showTimer = window.setTimeout(
      () => setInstallVisible(true),
      INSTALL_DELAY_MS,
    );
    return () => window.clearTimeout(showTimer);
  }, [canOfferInstall, updateReady]);

  useEffect(() => {
    if (!installVisible) return;
    const hideTimer = window.setTimeout(() => {
      const dismissedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(
        INSTALL_DISMISSED_UNTIL_KEY,
        String(dismissedUntil),
      );
      setInstallPrompt(null);
      setCanOfferInstall(false);
      setInstallVisible(false);
    }, INSTALL_VISIBLE_MS);
    return () => window.clearTimeout(hideTimer);
  }, [installVisible]);

  async function install() {
    if (!installPrompt) return;

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      window.localStorage.setItem(INSTALLED_KEY, "true");
      setCanOfferInstall(false);
      setInstallVisible(false);
    } else {
      dismissInstallPrompt(30);
    }
    setInstallPrompt(null);
  }

  function dismissInstallPrompt(days: number) {
    const dismissedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(
      INSTALL_DISMISSED_UNTIL_KEY,
      String(dismissedUntil),
    );
    setInstallPrompt(null);
    setCanOfferInstall(false);
    setInstallVisible(false);
  }

  function applyUpdate() {
    navigator.serviceWorker.getRegistration().then((registration) => {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => window.location.reload(),
        { once: true },
      );
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
  }

  if (!updateReady && !installVisible) return null;

  return (
    <aside className="pwa-prompt" aria-live="polite">
      {updateReady ? (
        <div className="pwa-prompt-content">
          <span>A new myNimto version is ready.</span>
          <button onClick={applyUpdate} type="button">Update</button>
        </div>
      ) : (
        <div className="pwa-prompt-content">
          <span>Install myNimto for quick access from your home screen.</span>
          <button onClick={install} type="button">Install</button>
        </div>
      )}
      <button
        className="pwa-prompt-close"
        aria-label="Close notification"
        onClick={() => {
          if (updateReady) {
            setUpdateReady(false);
          } else {
            dismissInstallPrompt(30);
          }
        }}
        type="button"
      >
        ×
      </button>
    </aside>
  );
}
