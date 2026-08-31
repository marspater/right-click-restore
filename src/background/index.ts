export function syncBadge(isEnabled: boolean) {
  try {
    chrome.action.setBadgeText({ text: isEnabled ? 'ON' : 'OFF' });
    chrome.action.setBadgeBackgroundColor({
      color: isEnabled ? '#007AFF' : '#8E8E93',
    });
  } catch (_e) {}
}

export function handleInstalled() {
  chrome.storage.local.get(['shieldEnabled'], (res) => {
    const isEnabled = res.shieldEnabled !== false;
    chrome.storage.local.set({ shieldEnabled: isEnabled });
    syncBadge(isEnabled);
  });
}

export function handleStartup() {
  chrome.storage.local.get(['shieldEnabled'], (res) => {
    syncBadge(res.shieldEnabled !== false);
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled?.addListener(handleInstalled);
  chrome.runtime.onStartup?.addListener(handleStartup);
}
