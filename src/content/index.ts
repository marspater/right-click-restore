import { getSecureRandomString } from '../shared/crypto';
import {
  DEFAULT_SETTINGS,
  type Settings,
  effectiveSettings,
  validateSettings,
} from '../shared/settings';
import {
  SCRUB_ATTRS,
  cleanAddedNode as cleanAddedNodeBase,
  cleanDOMTree as cleanDOMTreeBase,
  cleanNode as cleanNodeBase,
  safeGetElementById,
} from './cleaner';

export interface ContentMessageHandlers {
  onUnlockTriggered?: () => void;
  onCleanDOMTree?: () => void;
  onDispatchEvent?: (name: string) => void;
  unlockEventName?: string;
  onShowUnlockToast?: () => void;
  onApplySettings?: (config: Settings) => void;
}

function isAuthorizedSender(
  sender: chrome.runtime.MessageSender | undefined,
): boolean {
  if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
    return true;
  }
  if (!sender?.id || sender.id !== chrome.runtime.id) {
    return false;
  }

  const extPrefix =
    typeof chrome.runtime.getURL === 'function'
      ? chrome.runtime.getURL('')
      : '';
  const isExtensionUri = (uri?: string) =>
    Boolean(
      uri &&
        (uri.startsWith('chrome-extension://') ||
          uri.startsWith('safari-web-extension://') ||
          uri.startsWith('moz-extension://') ||
          (extPrefix && uri.startsWith(extPrefix))),
    );

  if (sender.origin && !isExtensionUri(sender.origin)) {
    return false;
  }
  if (sender.url && !isExtensionUri(sender.url)) {
    return false;
  }
  return true;
}

function executeForceUnlock(handlers: ContentMessageHandlers) {
  try {
    handlers.onUnlockTriggered?.();
  } catch {
    // Suppress unlock callback errors
  }
  try {
    handlers.onCleanDOMTree?.();
  } catch {
    // Suppress DOM cleaning errors
  }
  if (handlers.unlockEventName && handlers.onDispatchEvent) {
    try {
      handlers.onDispatchEvent(handlers.unlockEventName);
    } catch {
      // Suppress custom event dispatch errors
    }
  }
  try {
    handlers.onShowUnlockToast?.();
  } catch {
    // Suppress toast notification errors
  }
}

export function handleContentMessage(
  message: { type?: string; config?: Settings },
  sender: chrome.runtime.MessageSender | undefined,
  sendResponse: (response?: unknown) => void,
  handlers: ContentMessageHandlers = {},
) {
  // Validate sender origin to prevent message spoofing from untrusted extension contexts or web scripts
  if (!isAuthorizedSender(sender)) {
    sendResponse({ status: 'unauthorized' });
    return;
  }

  // Security Hardening: Validate message payload to prevent unhandled TypeErrors on null/non-object messages
  if (!message || typeof message !== 'object') {
    sendResponse({ status: 'ignored' });
    return;
  }

  if (message.type === 'RCR_FORCE_UNLOCK') {
    executeForceUnlock(handlers);
    sendResponse({ status: 'unlocked' });
    return;
  }

  if (message.type === 'RCR_CONFIG_CHANGED' && message.config) {
    try {
      handlers.onApplySettings?.(message.config);
      sendResponse({ status: 'ok' });
    } catch {
      // Send error response if applying settings fails
      sendResponse({ status: 'error' });
    }
    return;
  }

  sendResponse({ status: 'ignored' });
}

(() => {
  const updateEventName = `__rcr_update_${getSecureRandomString()}`;
  const unlockEventName = `__rcr_unlock_${getSecureRandomString()}`;

  let currentSettings: Settings = { ...DEFAULT_SETTINGS };
  let observer: MutationObserver | null = null;
  let unlockToastTimer: ReturnType<typeof setTimeout> | null = null;
  let unlockToastRemoveTimer: ReturnType<typeof setTimeout> | null = null;
  let configRequestInFlight = false;

  // Internal diagnostics counters (lexical scope only, zero global window footprint)
  const diagnostics = {
    observerBatchesProcessed: 0,
    elementsCleaned: 0,
    unlockTriggered: 0,
    spaRouteChanges: 0,
  };

  // Coalesced mutation processing queue with DoS protection
  const pendingNodes = new Set<Node>();
  let batchScheduled = false;
  const BATCH_SIZE = 50;
  const MAX_PENDING_NODES = 1000;

  function processPendingMutations() {
    batchScheduled = false;
    if (!currentSettings.enabled || pendingNodes.size === 0) return;

    let processed = 0;
    for (const node of pendingNodes) {
      if (processed >= BATCH_SIZE) break;
      pendingNodes.delete(node);
      try {
        cleanAddedNodeBase(node, currentSettings);
      } catch (_e) {}
      processed++;
    }

    diagnostics.observerBatchesProcessed++;
    diagnostics.elementsCleaned += processed;

    // Reschedule remainder if mutations remain in queue
    if (pendingNodes.size > 0) {
      scheduleBatch();
    }
  }

  function scheduleBatch() {
    if (batchScheduled) return;
    batchScheduled = true;
    try {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(processPendingMutations);
      } else {
        setTimeout(processPendingMutations, 16);
      }
    } catch (_e) {
      batchScheduled = false;
    }
  }

  function cleanNode(node: Element) {
    try {
      cleanNodeBase(node, currentSettings);
    } catch (_e) {}
  }

  function cleanDOMTree(root: ParentNode = document) {
    try {
      cleanDOMTreeBase(root, currentSettings);
    } catch (_e) {}
  }

  let bridgeChannel: string | null = null;
  let bridgeNonce: string | null = null;

  function notifyPageScript(type: 'UPDATE' | 'UNLOCK', config?: Settings) {
    if (bridgeChannel && bridgeNonce && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent(bridgeChannel, {
            detail: {
              nonce: bridgeNonce,
              type,
              config,
            },
          }),
        );
      } catch (_e) {}
    }
  }

  try {
    if (typeof window !== 'undefined') {
      window.addEventListener('__rcr_handshake__', (e: Event) => {
        try {
          const detail = (e as CustomEvent)?.detail;
          // Security hardening: Lock channel & nonce once established to prevent hijacking from untrusted page scripts
          if (
            bridgeChannel === null &&
            detail &&
            typeof detail.channel === 'string' &&
            detail.channel.length > 0 &&
            typeof detail.nonce === 'string' &&
            detail.nonce.length > 0
          ) {
            bridgeChannel = detail.channel;
            bridgeNonce = detail.nonce;
            notifyPageScript('UPDATE', currentSettings);
          }
        } catch {
          // Suppress errors handling handshake event
        }
      });

      // Request handshake from page-script if it already ran at document_start
      window.dispatchEvent(new CustomEvent('__rcr_handshake_req__'));
    }
  } catch (_e) {}

  const STYLE_ID = '__rcr_selection_style__';

  function updateInjectedStyles() {
    try {
      if (typeof document === 'undefined') return;
      let styleEl = safeGetElementById(
        document,
        STYLE_ID,
      ) as HTMLStyleElement | null;
      if (currentSettings.enabled && currentSettings.restoreSelection) {
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = STYLE_ID;
          styleEl.textContent = `
            body, p, div:not([class*="ytp-"]):not(.html5-video-player):not(.ProseMirror):not(.monaco-editor),
            span:not([class*="ytp-"]):not(.html5-video-player *),
            h1, h2, h3, h4, h5, h6, article, section, aside, main, header, footer,
            li, td, th, dt, dd, blockquote, pre, code, figcaption {
              -webkit-user-select: text !important;
              user-select: text !important;
            }
            [contenteditable], [contenteditable="true"], [contenteditable="true"] *,
            .ProseMirror, .ProseMirror *, .monaco-editor, .monaco-editor *,
            input, textarea, select, button,
            .html5-video-player, .html5-video-player *,
            [class*="ytp-"], [class*="ytp-"] * {
              -webkit-user-select: auto !important;
              user-select: auto !important;
            }
          `;
          (document.head || document.documentElement)?.appendChild(styleEl);
        }
      } else {
        styleEl?.remove();
      }
    } catch {
      // Suppress errors injecting selection styles
    }
  }

  function applySettings(settings: Settings) {
    try {
      const validated = validateSettings(settings);
      const hostname =
        typeof window !== 'undefined' && window.location
          ? window.location.hostname
          : '';
      currentSettings = effectiveSettings(validated, hostname);

      // Dynamically apply selection styles without polluting root DOM dataset
      updateInjectedStyles();

      // Secure cryptographic bridge notification
      notifyPageScript('UPDATE', currentSettings);

      // Legacy fallback event dispatch
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(updateEventName, { detail: currentSettings }),
        );
      }
    } catch {
      // Suppress errors applying settings
    }
  }

  function loadSettings() {
    if (configRequestInFlight) return;
    configRequestInFlight = true;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(
          ['rcr_settings', 'shieldEnabled'],
          (result) => {
            configRequestInFlight = false;
            if (chrome.runtime?.lastError) {
              applySettings(DEFAULT_SETTINGS);
              return;
            }
            const stored = result?.rcr_settings as
              | Partial<Settings>
              | undefined;
            const settings: Settings = validateSettings({
              ...DEFAULT_SETTINGS,
              ...stored,
            });
            if (typeof result?.shieldEnabled === 'boolean') {
              settings.enabled = result.shieldEnabled;
            }
            applySettings(settings);
          },
        );
      } else {
        configRequestInFlight = false;
        applySettings(DEFAULT_SETTINGS);
      }
    } catch {
      configRequestInFlight = false;
      applySettings(DEFAULT_SETTINGS);
    }
  }

  function showUnlockToast() {
    try {
      const root = document.documentElement;
      if (!root) return;

      if (unlockToastTimer) clearTimeout(unlockToastTimer);
      if (unlockToastRemoveTimer) clearTimeout(unlockToastRemoveTimer);

      safeGetElementById(document, '__rcr_toast_host__')?.remove();

      const host = document.createElement('div');
      host.id = '__rcr_toast_host__';
      host.style.cssText =
        'position:fixed;top:0;left:0;width:100%;pointer-events:none;z-index:2147483647;';

      const shadow = host.attachShadow
        ? host.attachShadow({ mode: 'closed' })
        : host;

      const style = document.createElement('style');
      style.textContent = `
        .toast {
          position: fixed;
          top: 18px;
          left: 50%;
          transform: translateX(-50%) translateY(-10px);
          background: rgba(20, 24, 35, 0.94);
          color: #ffffff;
          padding: 8px 18px;
          border-radius: 9999px;
          font: 600 12.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
          border: 0.5px solid rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          pointer-events: none;
          transition: opacity 0.25s ease, transform 0.25s ease;
          opacity: 0;
        }
        .toast.visible {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      `;

      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = '🔓 Right-click & selection unlocked';

      shadow.appendChild(style);
      shadow.appendChild(toast);
      root.appendChild(host);

      requestAnimationFrame(() => {
        try {
          toast.classList.add('visible');
        } catch (_e) {}
      });

      unlockToastTimer = setTimeout(() => {
        try {
          toast.classList.remove('visible');
        } catch (_e) {}
        unlockToastRemoveTimer = setTimeout(() => {
          try {
            host.remove();
          } catch {
            // Suppress errors removing toast host
          }
          unlockToastRemoveTimer = null;
        }, 300);
        unlockToastTimer = null;
      }, 1600);
    } catch {
      // Suppress errors during toast creation
    }
  }

  function handleMutation(mutation: MutationRecord) {
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        // Only queue Element nodes; ignore Text, Comment, etc.
        if (node?.nodeType === 1) {
          pendingNodes.add(node);
        }
      }
    } else if (
      mutation.type === 'attributes' &&
      mutation.target instanceof Element
    ) {
      cleanNode(mutation.target);
    }
  }

  function startObserver() {
    if (
      observer ||
      typeof document === 'undefined' ||
      !document.documentElement ||
      typeof MutationObserver === 'undefined'
    )
      return;

    try {
      observer = new MutationObserver((mutations) => {
        if (!currentSettings.enabled) return;

        for (const mutation of mutations) {
          try {
            handleMutation(mutation);
          } catch {
            // Suppress errors processing single mutation
          }
        }

        // Bounded queue protection: prevent memory bloat on heavy churn
        if (pendingNodes.size >= MAX_PENDING_NODES) {
          pendingNodes.clear();
          cleanDOMTree();
        } else if (pendingNodes.size > 0) {
          scheduleBatch();
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: SCRUB_ATTRS,
      });
    } catch {
      // Suppress errors initializing MutationObserver
    }
  }

  // SPA Navigation hooks
  function handleSpaNavigation() {
    try {
      diagnostics.spaRouteChanges++;
      applySettings(currentSettings);
      if (currentSettings.enabled) {
        cleanDOMTree();
      }
    } catch {
      // Suppress errors reapplying settings during SPA route transition
    }
  }

  try {
    window.addEventListener('popstate', handleSpaNavigation, { passive: true });
    window.addEventListener('hashchange', handleSpaNavigation, {
      passive: true,
    });
  } catch {
    // Suppress errors adding SPA navigation event listeners
  }

  function handleMessage(
    message: { type?: string; config?: Settings },
    sender: chrome.runtime.MessageSender | undefined,
    sendResponse: (response?: unknown) => void,
  ) {
    return handleContentMessage(message, sender, sendResponse, {
      onUnlockTriggered: () => {
        diagnostics.unlockTriggered++;
        notifyPageScript('UNLOCK');
      },
      onCleanDOMTree,
      onDispatchEvent: (name) => window.dispatchEvent(new CustomEvent(name)),
      unlockEventName,
      onShowUnlockToast: showUnlockToast,
      onApplySettings: applySettings,
    });
  }

  try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message, sender, sendResponse);
      return true;
    });
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (
        areaName === 'local' &&
        (changes.rcr_settings || changes.shieldEnabled)
      ) {
        loadSettings();
      }
    });
  } catch (_error) {
    // Extension APIs may be unavailable during Safari teardown.
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    cleanDOMTree();
    startObserver();
  } else if (typeof document !== 'undefined') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        cleanDOMTree();
        startObserver();
      },
      { once: true },
    );
  }

  loadSettings();
})();
