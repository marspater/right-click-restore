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
} from './cleaner';

export function handleContentMessage(
  message: { type?: string; config?: Settings },
  sender: chrome.runtime.MessageSender | undefined,
  sendResponse: (response?: unknown) => void,
  onUnlockTriggered?: () => void,
  onCleanDOMTree?: () => void,
  onDispatchEvent?: (name: string) => void,
  unlockEventName?: string,
  onShowUnlockToast?: () => void,
  onApplySettings?: (config: Settings) => void,
) {
  // Validate sender origin to prevent message spoofing from untrusted extension contexts or web scripts
  if (
    typeof chrome !== 'undefined' &&
    chrome.runtime?.id &&
    sender?.id !== chrome.runtime.id
  ) {
    sendResponse({ status: 'unauthorized' });
    return;
  }

  // Security Hardening: Validate message payload to prevent unhandled TypeErrors on null/non-object messages
  if (!message || typeof message !== 'object') {
    sendResponse({ status: 'ignored' });
    return;
  }

  if (message.type === 'RCR_FORCE_UNLOCK') {
    try {
      onUnlockTriggered?.();
    } catch (_e) {}
    try {
      onCleanDOMTree?.();
    } catch (_e) {}
    if (unlockEventName && onDispatchEvent) {
      try {
        onDispatchEvent(unlockEventName);
      } catch (_e) {}
    }
    try {
      onShowUnlockToast?.();
    } catch (_e) {}
    sendResponse({ status: 'unlocked' });
    return;
  }

  if (message.type === 'RCR_CONFIG_CHANGED' && message.config) {
    try {
      onApplySettings?.(message.config);
      sendResponse({ status: 'ok' });
    } catch (_err) {
      sendResponse({ status: 'error' });
    }
    return;
  }

  sendResponse({ status: 'ignored' });
}

(() => {
  const updateEventName =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `__rcr_update_${crypto.randomUUID()}`
      : `__rcr_update_${Math.random().toString(36).substring(2)}`;
  const unlockEventName =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? `__rcr_unlock_${crypto.randomUUID()}`
      : `__rcr_unlock_${Math.random().toString(36).substring(2)}`;

  let currentSettings: Settings = { ...DEFAULT_SETTINGS };
  let mainWorldInjected = false;
  let observer: MutationObserver | null = null;
  let unlockToastTimer: ReturnType<typeof setTimeout> | null = null;
  let unlockToastRemoveTimer: ReturnType<typeof setTimeout> | null = null;
  let configRequestInFlight = false;

  // Diagnostics counters (privacy-safe: strictly integer counters, no URLs/content)
  const diagnostics = {
    pageScriptInjected: false,
    observerBatchesProcessed: 0,
    elementsCleaned: 0,
    unlockTriggered: 0,
    spaRouteChanges: 0,
  };

  const globalWin = (typeof window !== 'undefined'
    ? window
    : {}) as unknown as Record<string, unknown>;
  globalWin.__RCR_DIAGNOSTICS__ = diagnostics;

  // Coalesced mutation processing queue
  const pendingNodes = new Set<Node>();
  let batchScheduled = false;
  const BATCH_SIZE = 50;

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

  function applySettings(settings: Settings) {
    try {
      const validated = validateSettings(settings);
      const hostname =
        typeof window !== 'undefined' && window.location
          ? window.location.hostname
          : '';
      currentSettings = effectiveSettings(validated, hostname);

      const root =
        typeof document !== 'undefined' ? document.documentElement : null;
      if (root) {
        root.dataset.rcrEnabled = currentSettings.enabled ? 'true' : 'false';
        root.dataset.rcrRightClick = currentSettings.restoreRightClick
          ? 'true'
          : 'false';
        root.dataset.rcrSelection = currentSettings.restoreSelection
          ? 'true'
          : 'false';
        root.dataset.rcrAntiShield = currentSettings.antiShield
          ? 'true'
          : 'false';
        root.dataset.rcrForceMode = currentSettings.absoluteForce
          ? 'true'
          : 'false';
        root.dataset.rcrModifierBypass = currentSettings.bypassModifierKey
          ? 'true'
          : 'false';
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(updateEventName, { detail: currentSettings }),
        );
      }
    } catch (_e) {}
  }

  function injectMainWorldScript(initialConfig: Settings) {
    if (mainWorldInjected) return;
    mainWorldInjected = true;

    const inject = () => {
      try {
        if (
          typeof document === 'undefined' ||
          document.querySelector('script[data-rcr-page-script]')
        )
          return;
        const script = document.createElement('script');
        script.dataset.rcrPageScript = 'true';
        script.src = chrome.runtime.getURL('page-script.js');
        script.dataset.initialConfig = JSON.stringify(initialConfig);
        script.dataset.updateEvent = updateEventName;
        script.dataset.unlockEvent = unlockEventName;
        (
          document.head ||
          document.documentElement ||
          document.body
        )?.appendChild(script);
        diagnostics.pageScriptInjected = true;
      } catch (_e) {}
    };

    try {
      if (document.head || document.documentElement || document.body) {
        inject();
      } else {
        document.addEventListener('DOMContentLoaded', inject, { once: true });
      }
    } catch (_error) {
      mainWorldInjected = false;
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
              injectMainWorldScript(currentSettings);
              return;
            }
            const stored = result?.rcr_settings as
              | Partial<Settings>
              | undefined;
            const settings: Settings = validateSettings({
              ...DEFAULT_SETTINGS,
              ...(stored ?? {}),
            });
            if (typeof result?.shieldEnabled === 'boolean') {
              settings.enabled = result.shieldEnabled;
            }
            applySettings(settings);
            injectMainWorldScript(currentSettings);
          },
        );
      } else {
        configRequestInFlight = false;
        applySettings(DEFAULT_SETTINGS);
        injectMainWorldScript(currentSettings);
      }
    } catch (_error) {
      configRequestInFlight = false;
      applySettings(DEFAULT_SETTINGS);
      injectMainWorldScript(currentSettings);
    }
  }

  function showUnlockToast() {
    try {
      const root = document.documentElement;
      if (!root) return;

      if (unlockToastTimer) clearTimeout(unlockToastTimer);
      if (unlockToastRemoveTimer) clearTimeout(unlockToastRemoveTimer);

      document.getElementById('rcr-unlock-toast')?.remove();

      const toast = document.createElement('div');
      toast.id = 'rcr-unlock-toast';
      toast.textContent = '🔓 Right-click & selection unlocked';

      root.appendChild(toast);
      requestAnimationFrame(() => {
        try {
          toast.classList.add('rcr-toast-visible');
        } catch (_e) {}
      });

      unlockToastTimer = setTimeout(() => {
        try {
          toast.classList.remove('rcr-toast-visible');
        } catch (_e) {}
        unlockToastRemoveTimer = setTimeout(() => {
          try {
            toast.remove();
          } catch (_e) {}
          unlockToastRemoveTimer = null;
        }, 300);
        unlockToastTimer = null;
      }, 1600);
    } catch (_e) {}
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
            if (mutation.type === 'childList') {
              for (const node of mutation.addedNodes) {
                // Only queue Element nodes; ignore Text, Comment, etc.
                if (node && node.nodeType === 1) {
                  pendingNodes.add(node);
                }
              }
            } else if (
              mutation.type === 'attributes' &&
              mutation.target instanceof Element
            ) {
              cleanNode(mutation.target);
            }
          } catch (_e) {}
        }

        if (pendingNodes.size > 0) {
          scheduleBatch();
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: SCRUB_ATTRS,
      });
    } catch (_e) {}
  }

  // SPA Navigation hooks
  function handleSpaNavigation() {
    try {
      diagnostics.spaRouteChanges++;
      applySettings(currentSettings);
      if (currentSettings.enabled) {
        cleanDOMTree();
      }
    } catch (_e) {}
  }

  try {
    window.addEventListener('popstate', handleSpaNavigation, { passive: true });
    window.addEventListener('hashchange', handleSpaNavigation, {
      passive: true,
    });

    const origPushState = history.pushState;
    if (origPushState) {
      try {
        history.pushState = function (...args) {
          const res = origPushState.apply(this, args);
          handleSpaNavigation();
          return res;
        };
      } catch (_e) {}
    }

    const origReplaceState = history.replaceState;
    if (origReplaceState) {
      try {
        history.replaceState = function (...args) {
          const res = origReplaceState.apply(this, args);
          handleSpaNavigation();
          return res;
        };
      } catch (_e) {}
    }
  } catch (_e) {}

  function handleMessage(
    message: { type?: string; config?: Settings },
    sender: chrome.runtime.MessageSender | undefined,
    sendResponse: (response?: unknown) => void,
  ) {
    return handleContentMessage(
      message,
      sender,
      sendResponse,
      () => diagnostics.unlockTriggered++,
      cleanDOMTree,
      (name) => window.dispatchEvent(new CustomEvent(name)),
      unlockEventName,
      showUnlockToast,
      applySettings,
    );
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
