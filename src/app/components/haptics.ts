/**
 * Telegram WebApp HapticFeedback — native bridge implementation.
 *
 * Bridge detection (priority order):
 *   1. TelegramWebviewProxy.postEvent(type, data)  — iOS newer API
 *   2. webkit.messageHandlers.performAction.postMessage({event,data}) — iOS WKWebView
 *   3. external.notify(json) — Android
 *   4. parent.postMessage — iframe fallback
 */

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
type NotificationType = "error" | "success" | "warning";

function isIframe(): boolean {
  try {
    return window.parent != null && window !== window.parent;
  } catch (_e) {
    return false;
  }
}

/**
 * Send a raw event to the Telegram native bridge.
 */
function postEvent(eventType: string, eventData?: Record<string, string>) {
  const dataStr = JSON.stringify(eventData ?? {});

  // --- Method 1: TelegramWebviewProxy.postEvent (iOS newer API) ---
  try {
    const proxy = window.TelegramWebviewProxy as any;
    if (proxy?.postEvent) {
      proxy.postEvent(eventType, dataStr);
      return;
    }
  } catch (_e) { /* continue */ }

  // --- Method 1b: TelegramWebviewProxy.postMessage (iOS legacy API) ---
  try {
    const proxy = window.TelegramWebviewProxy as any;
    if (proxy?.postMessage) {
      proxy.postMessage(JSON.stringify({ eventType, eventData: eventData ?? {} }));
      return;
    }
  } catch (_e) { /* continue */ }

  // --- Method 2: webkit.messageHandlers.performAction ---
  try {
    const wk = (window as any).webkit;
    if (wk?.messageHandlers?.performAction) {
      // performAction expects {eventType, eventData} as the message
      wk.messageHandlers.performAction.postMessage({
        eventType,
        eventData: dataStr,
      });
      return;
    }
  } catch (_e) { /* continue */ }

  // --- Method 3: Android external.notify ---
  try {
    if (window.external && "notify" in window.external) {
      window.external.notify!(JSON.stringify({ eventType, eventData: eventData ?? {} }));
      return;
    }
  } catch (_e) { /* continue */ }

  // --- Method 4: iframe postMessage ---
  try {
    if (isIframe()) {
      window.parent.postMessage(
        JSON.stringify({ eventType, eventData: eventData ?? {} }),
        "*"
      );
      return;
    }
  } catch (_e) { /* continue */ }
}

// ── Debug helpers ────────────────────────────────────────

export function getHapticDebugInfo(): Record<string, string> {
  const info: Record<string, string> = {};

  info["Proxy exists"] = window.TelegramWebviewProxy ? "YES" : "no";
  try {
    const proxy = window.TelegramWebviewProxy as any;
    info["Proxy.postEvent"] = typeof proxy?.postEvent === "function" ? "YES fn" : typeof proxy?.postEvent;
    info["Proxy.postMessage"] = typeof proxy?.postMessage === "function" ? "YES fn" : typeof proxy?.postMessage;
    if (proxy) {
      const proto = Object.getPrototypeOf(proxy);
      info["Proxy proto"] = proto ? Object.getOwnPropertyNames(proto).join(",") : "(no proto)";
    }
  } catch (_e) {
    info["Proxy err"] = String(_e);
  }

  try {
    const wk = (window as any).webkit;
    if (wk?.messageHandlers) {
      const names = Object.getOwnPropertyNames(wk.messageHandlers).join(",");
      info["webkit.mH"] = names || "(empty)";
    } else {
      info["webkit.mH"] = wk ? "no mH" : "no webkit";
    }
  } catch (_e) {
    info["webkit.mH"] = "err";
  }

  info["external.notify"] = (window.external && "notify" in window.external) ? "YES" : "no";
  info["isIframe"] = isIframe() ? "YES" : "no";
  info["TG WebApp"] = window.Telegram?.WebApp ? "YES" : "no";
  info["version"] = window.Telegram?.WebApp?.version ?? "n/a";
  info["platform"] = window.Telegram?.WebApp?.platform ?? "n/a";
  info["hash"] = (location.hash || "(empty)").substring(0, 100);

  return info;
}

/**
 * Run comprehensive bridge test — tries every method and reports results.
 */
export function runBridgeTest(): string {
  const results: string[] = [];
  const hapticData = { type: "impact", impact_style: "heavy" };
  const hapticDataStr = JSON.stringify(hapticData);
  const eventType = "web_app_trigger_haptic_feedback";

  // Test 1: postEvent (NEW — should be the working one)
  try {
    const proxy = window.TelegramWebviewProxy as any;
    if (proxy?.postEvent) {
      proxy.postEvent(eventType, hapticDataStr);
      results.push("Proxy.postEvent: OK ✓");
    } else {
      results.push("Proxy.postEvent: not available");
    }
  } catch (e: unknown) {
    results.push("Proxy.postEvent: ERR " + (e instanceof Error ? e.message : String(e)));
  }

  // Test 2: postMessage (legacy)
  try {
    const proxy = window.TelegramWebviewProxy as any;
    if (proxy?.postMessage) {
      proxy.postMessage(JSON.stringify({ eventType, eventData: hapticData }));
      results.push("Proxy.postMessage: OK");
    } else {
      results.push("Proxy.postMessage: not available");
    }
  } catch (e: unknown) {
    results.push("Proxy.postMessage: ERR " + (e instanceof Error ? e.message : String(e)));
  }

  // Test 3: webkit.messageHandlers.performAction
  try {
    const wk = (window as any).webkit;
    if (wk?.messageHandlers?.performAction) {
      // Try format A: {eventType, eventData as string}
      wk.messageHandlers.performAction.postMessage({
        eventType,
        eventData: hapticDataStr,
      });
      results.push("webkit.mH.performAction (str): OK");
    } else {
      results.push("webkit.mH.performAction: not found");
    }
  } catch (e: unknown) {
    results.push("webkit.mH.performAction (str): ERR " + (e instanceof Error ? e.message : String(e)));
  }

  // Test 3b: webkit performAction with object eventData
  try {
    const wk = (window as any).webkit;
    if (wk?.messageHandlers?.performAction) {
      wk.messageHandlers.performAction.postMessage({
        eventType,
        eventData: hapticData,
      });
      results.push("webkit.mH.performAction (obj): OK");
    }
  } catch (e: unknown) {
    results.push("webkit.mH.performAction (obj): ERR " + (e instanceof Error ? e.message : String(e)));
  }

  // Test 3c: webkit performAction with full JSON string
  try {
    const wk = (window as any).webkit;
    if (wk?.messageHandlers?.performAction) {
      wk.messageHandlers.performAction.postMessage(
        JSON.stringify({ eventType, eventData: hapticData })
      );
      results.push("webkit.mH.performAction (json): OK");
    }
  } catch (e: unknown) {
    results.push("webkit.mH.performAction (json): ERR " + (e instanceof Error ? e.message : String(e)));
  }

  // Test 4: SDK with version bypass
  try {
    const hf = window.Telegram?.WebApp?.HapticFeedback;
    if (hf) {
      hf.impactOccurred("heavy");
      results.push("SDK HF: called (v" + (window.Telegram?.WebApp?.version ?? "?") + ")");
    } else {
      results.push("SDK HF: no object");
    }
  } catch (e: unknown) {
    results.push("SDK HF: ERR " + String(e));
  }

  return results.join("\n");
}

export function forceSDKVersion(ver: string = "7.10"): boolean {
  try {
    const wa = window.Telegram?.WebApp;
    if (!wa) return false;
    // Try defineProperty first
    try {
      Object.defineProperty(wa, "version", {
        get: () => ver,
        configurable: true,
      });
      if (wa.version === ver) return true;
    } catch (_e) { /* try next */ }
    // Try direct assignment
    try {
      (wa as any).version = ver;
      if (wa.version === ver) return true;
    } catch (_e) { /* try next */ }
    // Try overriding prototype
    try {
      const proto = Object.getPrototypeOf(wa);
      if (proto) {
        Object.defineProperty(proto, "version", {
          get: () => ver,
          configurable: true,
        });
        if (wa.version === ver) return true;
      }
    } catch (_e) { /* nope */ }
    return false;
  } catch (_e) {
    return false;
  }
}

// ── Impact feedback ─────────────────────────────────────

function impact(style: ImpactStyle) {
  postEvent("web_app_trigger_haptic_feedback", {
    type: "impact",
    impact_style: style,
  });
}

export function hapticSelection() {
  postEvent("web_app_trigger_haptic_feedback", { type: "selection_change" });
}

export function hapticLight() { impact("light"); }
export function hapticMedium() { impact("medium"); }
export function hapticHeavy() { impact("heavy"); }
export function hapticRigid() { impact("rigid"); }

function notification(type: NotificationType) {
  postEvent("web_app_trigger_haptic_feedback", {
    type: "notification",
    notification_type: type,
  });
}

export function hapticSuccess() { notification("success"); }
export function hapticError() { notification("error"); }
export function hapticWarning() { notification("warning"); }
