"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRegistration() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let registration: ServiceWorkerRegistration | null = null;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((nextRegistration) => {
        registration = nextRegistration;
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

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const installed = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      registration = null;
    };
  }, []);

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      return;
    }
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIos) setShowIosHelp(true);
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

  const standalone =
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const isIos =
    typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (!updateReady && !installPrompt && (!isIos || standalone || showIosHelp)) {
    if (!updateReady && !showIosHelp) return null;
  }

  return (
    <aside className="pwa-prompt" aria-live="polite">
      {updateReady ? (
        <>
          <span>A new myNimto version is ready.</span>
          <button onClick={applyUpdate} type="button">Update</button>
        </>
      ) : showIosHelp ? (
        <>
          <span>In Safari, tap Share and then “Add to Home Screen”.</span>
          <button onClick={() => setShowIosHelp(false)} type="button">Got it</button>
        </>
      ) : (
        <>
          <span>Install myNimto for quick access from your home screen.</span>
          <button onClick={install} type="button">Install</button>
        </>
      )}
    </aside>
  );
}
