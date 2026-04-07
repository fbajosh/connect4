function normalizedBasePath(): string {
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

export function registerPwaServiceWorker(): void {
  if (!import.meta.env.PROD || !window.isSecureContext || !("serviceWorker" in navigator)) {
    return;
  }

  const basePath = normalizedBasePath();
  const serviceWorkerUrl = `${basePath}service-worker.js`;

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(serviceWorkerUrl, { scope: basePath }).catch(() => {
      // The app still works without offline support if registration fails.
    });
  });
}
