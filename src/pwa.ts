function normalizedBasePath(): string {
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function installUpdateCheckHooks(registration: ServiceWorkerRegistration): void {
  const checkForUpdates = (): void => {
    void registration.update().catch(() => {
      // Ignore update check failures and keep the current cached app usable.
    });
  };

  window.addEventListener("focus", checkForUpdates);
  window.addEventListener("pageshow", checkForUpdates);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForUpdates();
    }
  });

  checkForUpdates();
}

export function registerPwaServiceWorker(): void {
  if (!import.meta.env.PROD || !window.isSecureContext || !("serviceWorker" in navigator)) {
    return;
  }

  const basePath = normalizedBasePath();
  const serviceWorkerUrl = `${basePath}service-worker.js`;
  const hadController = navigator.serviceWorker.controller !== null;
  let reloadedForUpdatedController = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloadedForUpdatedController) {
      return;
    }

    reloadedForUpdatedController = true;
    window.location.reload();
  });

  void navigator.serviceWorker
    .register(serviceWorkerUrl, {
      scope: basePath,
      updateViaCache: "none",
    })
    .then((registration) => {
      installUpdateCheckHooks(registration);
    })
    .catch(() => {
      // The app still works without offline support if registration fails.
    });
}
