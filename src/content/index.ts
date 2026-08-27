import {
  DEFAULT_SETTINGS,
  effectiveSettings,
  type Settings,
} from '../shared/settings';

(() => {
  let currentSettings: Settings = { ...DEFAULT_SETTINGS };
  let mainWorldInjected = false;
  let observer: MutationObserver | null = null;
  let unlockToastTimer: ReturnType<typeof setTimeout> | null = null;
  let unlockToastRemoveTimer: ReturnType<typeof setTimeout> | null = null;
  let configRequestInFlight = false;

  const INTERACTIVE_CONTAINERS =
    '.ProseMirror, .monaco-editor, .html5-video-player, [class*="ytp-"], [class*="player-"], ytd-app, [contenteditable="true"]';
  const INTERACTIVE_ELEMENTS =
    'input, textarea, select, button, [contenteditable], [contenteditable="true"]';
  const SCRUB_ATTRS = [
    'oncontextmenu',
    'onselectstart',
    'ondragstart',
    'oncopy',
    'oncut',
    'onbeforecopy',
  ];
  const SCRUB_SELECTOR = SCRUB_ATTRS.map((attr) => `[${attr}]`).join(',');

  function applySettings(settings: Settings) {
    currentSettings = effectiveSettings(settings, window.location.hostname);

    const root = document.documentElement;
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

    window.dispatchEvent(
      new CustomEvent('__rcr_update_config', { detail: currentSettings }),
    );
  }

  function injectMainWorldScript(initialConfig: Settings) {
    if (mainWorldInjected) return;
    mainWorldInjected = true;

    const inject = () => {
      if (document.querySelector('script[data-rcr-page-script]')) return;
      const script = document.createElement('script');
      script.dataset.rcrPageScript = 'true';
      script.src = chrome.runtime.getURL('page-script.js');
      script.dataset.initialConfig = JSON.stringify(initialConfig);
      (document.head || document.documentElement || document.body)?.appendChild(
        script,
      );
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
      chrome.storage.local.get(['rcr_settings', 'shieldEnabled'], (result) => {
        configRequestInFlight = false;
        const stored = result.rcr_settings as Partial<Settings> | undefined;
        const settings: Settings = {
          ...DEFAULT_SETTINGS,
          ...(stored ?? {}),
        };
        if (typeof result.shieldEnabled === 'boolean') {
          settings.enabled = result.shieldEnabled;
        }
        applySettings(settings);
        injectMainWorldScript(currentSettings);
      });
    } catch (_error) {
      configRequestInFlight = false;
      applySettings(DEFAULT_SETTINGS);
      injectMainWorldScript(currentSettings);
    }
  }

  function showUnlockToast() {
    const root = document.documentElement;
    if (!root) return;

    if (unlockToastTimer) clearTimeout(unlockToastTimer);
    if (unlockToastRemoveTimer) clearTimeout(unlockToastRemoveTimer);

    document.getElementById('rcr-unlock-toast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'rcr-unlock-toast';
    toast.textContent = '🔓 Right-click & selection unlocked';
    Object.assign(toast.style, {
      position: 'fixed',
      top: '18px',
      left: '50%',
      transform: 'translateX(-50%) translateY(-10px)',
      zIndex: '2147483647',
      background: 'rgba(20, 24, 35, 0.94)',
      color: '#fff',
      padding: '8px 18px',
      borderRadius: '9999px',
      font: '600 12.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
      boxShadow: '0 8px 24px rgba(0,0,0,.35)',
      border: '0.5px solid rgba(255,255,255,.25)',
      backdropFilter: 'blur(16px)',
      pointerEvents: 'none',
      transition: 'opacity .25s ease, transform .25s ease',
      opacity: '0',
    });

    root.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    unlockToastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-10px)';
      unlockToastRemoveTimer = setTimeout(() => {
        toast.remove();
        unlockToastRemoveTimer = null;
      }, 300);
      unlockToastTimer = null;
    }, 1600);
  }

  function cleanNode(node: Element) {
    if (!(node instanceof Element)) return;
    if (
      node.matches(INTERACTIVE_ELEMENTS) ||
      node.closest(INTERACTIVE_CONTAINERS)
    )
      return;

    if (currentSettings.restoreRightClick) {
      node.removeAttribute('oncontextmenu');
    }

    if (currentSettings.restoreSelection) {
      for (const attr of SCRUB_ATTRS) {
        if (attr !== 'oncontextmenu') node.removeAttribute(attr);
      }
      if (node instanceof HTMLElement) {
        if (node.style.userSelect === 'none') node.style.userSelect = 'auto';
        if (node.style.webkitUserSelect === 'none')
          node.style.webkitUserSelect = 'auto';
      }
    }
  }

  function cleanAddedNode(node: Node) {
    if (!(node instanceof Element)) return;
    cleanNode(node);
    for (const child of node.querySelectorAll(SCRUB_SELECTOR)) cleanNode(child);
  }

  function cleanDOMTree(root: ParentNode = document) {
    for (const node of root.querySelectorAll(SCRUB_SELECTOR)) cleanNode(node);
  }

  function startObserver() {
    if (observer || !document.documentElement) return;

    observer = new MutationObserver((mutations) => {
      if (!currentSettings.enabled) return;

      let processed = 0;
      for (const mutation of mutations) {
        if (processed >= 100) break;

        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (processed >= 100) break;
            cleanAddedNode(node);
            processed++;
          }
        } else if (
          mutation.type === 'attributes' &&
          mutation.target instanceof Element
        ) {
          cleanNode(mutation.target);
          processed++;
        }
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: SCRUB_ATTRS,
    });
  }

  function handleMessage(
    message: { type?: string; config?: Settings },
    sendResponse: (response?: unknown) => void,
  ) {
    if (message.type === 'RCR_FORCE_UNLOCK') {
      cleanDOMTree();
      window.dispatchEvent(new CustomEvent('__rcr_force_unlock__'));
      showUnlockToast();
      sendResponse({ status: 'unlocked' });
      return;
    }

    if (message.type === 'RCR_CONFIG_CHANGED' && message.config) {
      applySettings(message.config);
      sendResponse({ status: 'ok' });
      return;
    }

    sendResponse({ status: 'ignored' });
  }

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      handleMessage(message, sendResponse);
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

  if (document.documentElement) {
    cleanDOMTree();
    startObserver();
  } else {
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
