chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ shieldEnabled: true });
  chrome.action.setBadgeText({ text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ color: '#007AFF' });
});
