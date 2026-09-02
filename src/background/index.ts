export function syncBadge(isEnabled: boolean) {
  try {
    if (typeof chrome !== 'undefined' && chrome.action) {
      chrome.action.setBadgeText({ text: isEnabled ? 'ON' : 'OFF' }, () => {
        if (chrome.runtime?.lastError) {
          // Ignore badge setting errors during window close/startup
        }
      });
      chrome.action.setBadgeBackgroundColor(
        {
          color: isEnabled ? '#007AFF' : '#8E8E93',
        },
        () => {
          if (chrome.runtime?.lastError) {
            // Ignore badge background error
          }
        },
      );
    }
  } catch (_e) {}
}

export function handleInstalled() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['shieldEnabled'], (res) => {
        if (chrome.runtime?.lastError) {
          syncBadge(true);
          return;
        }
        const isEnabled = res ? res.shieldEnabled !== false : true;
        try {
          chrome.storage.local.set({ shieldEnabled: isEnabled }, () => {
            if (chrome.runtime?.lastError) {
              // Silently handle storage write failure
            }
          });
        } catch (_err) {}
        syncBadge(isEnabled);
      });
    } else {
      syncBadge(true);
    }
  } catch (_err) {
    syncBadge(true);
  }
}

export function handleStartup() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['shieldEnabled'], (res) => {
        if (chrome.runtime?.lastError || !res) {
          syncBadge(true);
          return;
        }
        syncBadge(res.shieldEnabled !== false);
      });
    } else {
      syncBadge(true);
    }
  } catch (_err) {
    syncBadge(true);
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
  try {
    chrome.runtime.onInstalled?.addListener(handleInstalled);
    chrome.runtime.onStartup?.addListener(handleStartup);
  } catch (_err) {}
}
