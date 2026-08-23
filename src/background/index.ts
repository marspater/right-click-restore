function syncBadge(isEnabled: boolean) {
  try {
    chrome.action.setBadgeText({ text: isEnabled ? 'ON' : 'OFF' });
    chrome.action.setBadgeBackgroundColor({
      color: isEnabled ? '#007AFF' : '#8E8E93',
    });
  } catch (_e) {}
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['shieldEnabled'], (res) => {
    const isEnabled = res.shieldEnabled !== false;
    chrome.storage.local.set({ shieldEnabled: isEnabled });
    syncBadge(isEnabled);
  });
});

chrome.runtime.onStartup?.addListener(() => {
  chrome.storage.local.get(['shieldEnabled'], (res) => {
    syncBadge(res.shieldEnabled !== false);
  });
});
