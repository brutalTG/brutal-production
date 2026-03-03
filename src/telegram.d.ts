interface TelegramSafeAreaInset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface TelegramWebApp {
  /** Signal to Telegram that the app is ready to display */
  ready: () => void;
  /** Expand the mini app to maximum available height */
  expand: () => void;
  /** Request true fullscreen mode (Bot API 8.0+) */
  requestFullscreen?: () => void;
  /** Exit fullscreen mode */
  exitFullscreen?: () => void;
  /** Prevent swipe-to-dismiss gesture */
  disableVerticalSwipes?: () => void;
  /** Re-enable swipe-to-dismiss gesture */
  enableVerticalSwipes?: () => void;
  /** Close the mini app */
  close: () => void;

  /** Set the header bar color */
  setHeaderColor?: (color: string) => void;
  /** Set the background color visible during swipe */
  setBackgroundColor?: (color: string) => void;
  /** Set the bottom bar color (Bot API 7.10+) */
  setBottomBarColor?: (color: string) => void;

  /** Whether the mini app is currently expanded */
  isExpanded?: boolean;
  /** Whether the app is in fullscreen mode */
  isFullscreen?: boolean;
  /** Current viewport height in px */
  viewportHeight?: number;
  /** Stable viewport height (does not change with keyboard) */
  viewportStableHeight?: number;
  /** App platform: "android" | "ios" | "tdesktop" | "web" | etc */
  platform?: string;
  /** App version string */
  version?: string;

  /** Hardware safe area (notch, Dynamic Island, rounded corners) */
  safeAreaInset?: TelegramSafeAreaInset;
  /** Content safe area (Telegram's own header/bottom bar) */
  contentSafeAreaInset?: TelegramSafeAreaInset;

  /** Raw init data string (validate server-side) */
  initData?: string;
  /** Parsed init data (NOT validated — use server-side validation) */
  initDataUnsafe?: {
    query_id?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_premium?: boolean;
    };
    auth_date?: number;
    hash?: string;
    start_param?: string;
  };

  /** Haptic feedback interface */
  HapticFeedback?: {
    impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred: (type: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };

  /** Subscribe to events */
  onEvent?: (eventType: string, callback: () => void) => void;
  /** Unsubscribe from events */
  offEvent?: (eventType: string, callback: () => void) => void;

  /** Theme params from Telegram */
  themeParams?: Record<string, string>;
  /** Color scheme: "light" | "dark" */
  colorScheme?: string;
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp;
  };
  /** iOS Telegram WebView native bridge */
  TelegramWebviewProxy?: {
    postMessage(message: string): void;
  };
  /** Android Telegram WebView native bridge (external.notify) */
  external?: {
    notify?(message: string): void;
  };
}