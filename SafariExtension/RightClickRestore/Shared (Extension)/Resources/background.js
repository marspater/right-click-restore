/**
 * Right Click & Selection Restorer - Background Service Worker
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  restoreRightClick: true,
  restoreSelection: true,
  antiShield: true,
  absoluteForce: true,
  bypassModifierKey: true,
  disabledDomains: []
};

// Initialize default settings on install or update
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const data = await chrome.storage.local.get('rcr_settings');
    if (!data || !data.rcr_settings) {
      await chrome.storage.local.set({ rcr_settings: DEFAULT_SETTINGS });
    }
  } catch (err) {
    console.error('[RCR Background] Failed initializing settings:', err);
  }
});

// Update badge status based on active tab and settings
async function updateBadge(tabId, url) {
  if (!tabId || !url || url.startsWith('chrome://') || url.startsWith('safari-extension://') || url.startsWith('about:')) {
    try {
      await chrome.action.setBadgeText({ tabId, text: '' });
    } catch (e) {}
    return;
  }

  try {
    const data = await chrome.storage.local.get('rcr_settings');
    const settings = { ...DEFAULT_SETTINGS, ...(data?.rcr_settings || {}) };

    let isEnabled = settings.enabled;
    if (isEnabled && url) {
      try {
        const hostname = new URL(url).hostname;
        if (settings.disabledDomains?.some((d) => hostname === d || hostname.endsWith('.' + d))) {
          isEnabled = false;
        }
      } catch (e) {}
    }

    if (isEnabled) {
      await chrome.action.setBadgeText({ tabId, text: 'ON' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#007AFF' });
    } else {
      await chrome.action.setBadgeText({ tabId, text: 'OFF' });
      await chrome.action.setBadgeBackgroundColor({ tabId, color: '#8E8E93' });
    }
  } catch (err) {
    // Ignore errors when tab is closed
  }
}

// Listen for tab activation and URL updates to refresh badge
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab?.url) {
      await updateBadge(activeInfo.tabId, tab.url);
    }
  } catch (e) {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab?.url) {
    await updateBadge(tabId, tab.url);
  }
});

// Listen for settings change notifications to update all tabs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'RCR_SETTINGS_UPDATED') {
    // Bug 11 Fix: Respond immediately, update badges fire-and-forget
    sendResponse({ status: 'ok' });
    (async () => {
      try {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id && tab.url) {
            await updateBadge(tab.id, tab.url);
          }
        }
      } catch (e) {}
    })();
    return false; // No need to keep channel open
  }
});
