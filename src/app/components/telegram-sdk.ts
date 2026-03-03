/**
 * Telegram Mini App SDK initialization.
 *
 * Dynamically loads the official Telegram WebApp JS script, then
 * sets up: ready(), expand(), fullscreen, disableVerticalSwipes,
 * chrome colors, and CSS custom properties for safe areas.
 *
 * All feature calls (fullscreen, swipes, colors, haptics) go through
 * postBridgeEvent() which talks directly to the native WebView bridge,
 * bypassing the SDK's version gating. This is necessary because the
 * dynamically-loaded telegram-web-app.js often fails version negotiation
 * and falls back to 6.0, blocking features the native client supports.
 *
 * CSS variables set on <html>:
 *   --tg-safe-top     (hardware + content inset top)
 *   --tg-safe-bottom  (hardware inset bottom)
 *   --tg-safe-left    (hardware inset left)
 *   --tg-safe-right   (hardware inset right)
 *   --tg-content-top  (Telegram header height only)
 *   --tg-viewport-h   (stable viewport height)
 */

// Minimum safe area for fullscreen mode where Telegram shows floating controls
const MIN_FULLSCREEN_SAFE_TOP = 88;
const FALLBACK_SAFE_BOTTOM = 0;

const TG_SDK_URL = "https://telegram.org/js/telegram-web-app.js";

let sdkLoadPromise: Promise<void> | null = null;

/**
 * Dynamically load the Telegram WebApp JS SDK.
 * Resolves immediately if already available.
 */
function loadTelegramScript(): Promise<void> {
  if (window.Telegram?.WebApp) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector(`script[src="${TG_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      setTimeout(() => {
        if (window.Telegram?.WebApp) resolve();
      }, 50);
      return;
    }

    const script = document.createElement("script");
    script.src = TG_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      console.warn("[BRUTAL] Telegram WebApp SDK failed to load");
      resolve();
    };
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

function getWebApp() {
  return window.Telegram?.WebApp;
}

/**
 * Send a raw event to the Telegram native bridge.
 * Bypasses SDK version gating — the native client decides what to support.
 *
 * Bridge detection:
 *   iOS (new):  window.TelegramWebviewProxy.postEvent(type, dataJson)
 *   iOS (old):  window.TelegramWebviewProxy.postMessage(json)
 *   Android:    window.external.notify(json)
 */
function postBridgeEvent(eventType: string, eventData?: Record<string, string>) {
  const dataStr = JSON.stringify(eventData ?? {});

  // iOS newer API: postEvent(type, dataJson)
  try {
    const proxy = window.TelegramWebviewProxy as any;
    if (proxy?.postEvent) {
      proxy.postEvent(eventType, dataStr);
      return true;
    }
  } catch (_e) { /* continue */ }

  // iOS legacy API: postMessage(fullJson)
  try {
    const proxy = window.TelegramWebviewProxy as any;
    if (proxy?.postMessage) {
      proxy.postMessage(JSON.stringify({ eventType, eventData: eventData ?? {} }));
      return true;
    }
  } catch (_e) { /* continue */ }

  // webkit messageHandlers (iOS WKWebView)
  try {
    const wk = (window as any).webkit;
    if (wk?.messageHandlers?.performAction) {
      wk.messageHandlers.performAction.postMessage({ eventType, eventData: dataStr });
      return true;
    }
  } catch (_e) { /* continue */ }

  // Android
  try {
    if (window.external && "notify" in window.external) {
      window.external.notify!(JSON.stringify({ eventType, eventData: eventData ?? {} }));
      return true;
    }
  } catch (_e) { /* continue */ }

  return false;
}

/** Push current safe area values into CSS custom properties */
function syncSafeAreaVars() {
  const wa = getWebApp();
  const hw = wa?.safeAreaInset;
  const ct = wa?.contentSafeAreaInset;

  let top = (hw?.top ?? 0) + (ct?.top ?? 0);
  const bottom = hw?.bottom ?? FALLBACK_SAFE_BOTTOM;
  const left = hw?.left ?? 0;
  const right = hw?.right ?? 0;

  if (wa?.isFullscreen && top < MIN_FULLSCREEN_SAFE_TOP) {
    top = MIN_FULLSCREEN_SAFE_TOP;
  }

  const root = document.documentElement;
  root.style.setProperty("--tg-safe-top", `${top}px`);
  root.style.setProperty("--tg-safe-bottom", `${bottom}px`);
  root.style.setProperty("--tg-safe-left", `${left}px`);
  root.style.setProperty("--tg-safe-right", `${right}px`);
  root.style.setProperty("--tg-content-top", `${ct?.top ?? 0}px`);

  const vh = wa?.viewportStableHeight;
  if (vh) {
    root.style.setProperty("--tg-viewport-h", `${vh}px`);
  }
}

function setFallbackCSSVars() {
  const root = document.documentElement;
  root.style.setProperty("--tg-safe-top", "0px");
  root.style.setProperty("--tg-safe-bottom", "0px");
  root.style.setProperty("--tg-safe-left", "0px");
  root.style.setProperty("--tg-safe-right", "0px");
  root.style.setProperty("--tg-content-top", "0px");
  root.style.setProperty("--tg-viewport-h", "100dvh");
}

/**
 * Configure the WebApp after the SDK is loaded.
 */
function configureWebApp() {
  const wa = getWebApp();
  if (!wa) {
    setFallbackCSSVars();
    return;
  }

  // 1. Signal ready
  wa.ready();

  // 2. Expand to full height
  wa.expand();

  // 3. Retry expand (half-sheet race condition)
  setTimeout(() => {
    if (!wa.isExpanded) wa.expand();
  }, 300);

  // 4–6: Use direct bridge calls to bypass SDK version gating.
  //       The native client silently ignores unsupported events.
  postBridgeEvent("web_app_request_fullscreen");
  postBridgeEvent("web_app_setup_swipe_behavior", { allow_vertical_swipe: "false" });
  postBridgeEvent("web_app_set_header_color", { color: "#000000" });
  postBridgeEvent("web_app_set_background_color", { color: "#000000" });
  postBridgeEvent("web_app_set_bottom_bar_color", { color: "#000000" });

  // 7. Sync safe area CSS variables
  syncSafeAreaVars();
  setTimeout(syncSafeAreaVars, 100);
  setTimeout(syncSafeAreaVars, 500);

  // 8. Re-sync on viewport changes
  wa.onEvent?.("viewportChanged", syncSafeAreaVars);
  wa.onEvent?.("fullscreenChanged", syncSafeAreaVars);
  wa.onEvent?.("safeAreaChanged", syncSafeAreaVars);
  wa.onEvent?.("contentSafeAreaChanged", syncSafeAreaVars);
}

/**
 * Initialize the Telegram Mini App SDK.
 * Call once on app mount (inside useEffect in root component).
 */
export function initTelegramSDK() {
  setFallbackCSSVars();
  loadTelegramScript().then(() => configureWebApp());
}

/**
 * Force-reset the viewport after keyboard interactions (iOS zoom fix).
 */
export function resetViewport() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  setTimeout(() => {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    syncSafeAreaVars();
  }, 100);
  setTimeout(() => {
    window.scrollTo(0, 0);
    syncSafeAreaVars();
  }, 400);
}

/** Close the Telegram Mini App. */
export function closeMiniApp() {
  getWebApp()?.close?.();
}

/** Get the start_param from the Telegram deep link. */
export function getTelegramStartParam(): string | undefined {
  return getWebApp()?.initDataUnsafe?.start_param;
}

/** Get the Telegram user ID. */
export function getTelegramUserId(): number | undefined {
  return getWebApp()?.initDataUnsafe?.user?.id;
}

/** Get the raw initData string for server-side validation. */
export function getTelegramInitData(): string | undefined {
  return getWebApp()?.initData;
}

/** Get the platform string. */
export function getTelegramPlatform(): string {
  return getWebApp()?.platform ?? "unknown";
}