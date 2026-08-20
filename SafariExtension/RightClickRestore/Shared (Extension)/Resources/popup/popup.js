/**
 * Right Click & Selection Restorer - Popup Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  const globalToggle = document.getElementById('global-toggle');
  const siteToggle = document.getElementById('site-toggle');
  const siteDomain = document.getElementById('site-domain');
  const siteStatusDot = document.getElementById('site-status-dot');

  const toggleRightClick = document.getElementById('toggle-right-click');
  const toggleSelection = document.getElementById('toggle-selection');
  const toggleAntiShield = document.getElementById('toggle-anti-shield');
  const toggleAbsoluteForce = document.getElementById('toggle-absolute-force');
  const toggleModifierBypass = document.getElementById('toggle-modifier-bypass');

  const btnForceUnlock = document.getElementById('btn-force-unlock');

  const DEFAULT_SETTINGS = {
    enabled: true,
    restoreRightClick: true,
    restoreSelection: true,
    antiShield: true,
    absoluteForce: true,
    bypassModifierKey: true,
    disabledDomains: []
  };

  let currentSettings = { ...DEFAULT_SETTINGS };
  let currentHostname = '';
  let activeTabId = null;

  // 1. Get current active tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      activeTabId = tab.id;
      if (tab.url.startsWith('http://') || tab.url.startsWith('https://')) {
        currentHostname = new URL(tab.url).hostname;
        siteDomain.textContent = currentHostname;
      } else {
        siteDomain.textContent = 'Special Page';
        siteToggle.disabled = true;
      }
    }
  } catch (err) {
    siteDomain.textContent = 'Unknown Page';
  }

  // 2. Load stored settings
  try {
    const stored = await chrome.storage.local.get('rcr_settings');
    if (stored && stored.rcr_settings) {
      currentSettings = { ...DEFAULT_SETTINGS, ...stored.rcr_settings };
    }
  } catch (err) {
    console.error('Failed to retrieve settings:', err);
  }

  // 3. Update UI to match settings
  function updateUI() {
    globalToggle.checked = !!currentSettings.enabled;
    toggleRightClick.checked = !!currentSettings.restoreRightClick;
    toggleSelection.checked = !!currentSettings.restoreSelection;
    toggleAntiShield.checked = !!currentSettings.antiShield;
    toggleAbsoluteForce.checked = !!currentSettings.absoluteForce;
    toggleModifierBypass.checked = !!currentSettings.bypassModifierKey;

    const isSiteDisabled = currentHostname && currentSettings.disabledDomains?.includes(currentHostname);
    siteToggle.checked = !isSiteDisabled;

    const isActive = currentSettings.enabled && !isSiteDisabled;
    if (isActive) {
      siteStatusDot.classList.remove('disabled');
    } else {
      siteStatusDot.classList.add('disabled');
    }
  }

  updateUI();

  // 4. Save and broadcast settings change
  async function persistAndBroadcast() {
    await chrome.storage.local.set({ rcr_settings: currentSettings });

    // Notify background worker
    try {
      chrome.runtime.sendMessage({ type: 'RCR_SETTINGS_UPDATED' });
    } catch (e) {}

    // Notify active tab content script
    if (activeTabId) {
      try {
        await chrome.tabs.sendMessage(activeTabId, {
          type: 'RCR_CONFIG_CHANGED',
          config: currentSettings
        });
      } catch (e) {
        // Tab might not have content script (e.g., settings page)
      }
    }
    updateUI();
  }

  // 5. Setup event listeners
  globalToggle.addEventListener('change', async () => {
    currentSettings.enabled = globalToggle.checked;
    await persistAndBroadcast();
  });

  siteToggle.addEventListener('change', async () => {
    if (!currentHostname) return;
    let list = currentSettings.disabledDomains || [];
    if (!siteToggle.checked) {
      if (!list.includes(currentHostname)) list.push(currentHostname);
    } else {
      list = list.filter((d) => d !== currentHostname);
    }
    currentSettings.disabledDomains = list;
    await persistAndBroadcast();
  });

  toggleRightClick.addEventListener('change', async () => {
    currentSettings.restoreRightClick = toggleRightClick.checked;
    await persistAndBroadcast();
  });

  toggleSelection.addEventListener('change', async () => {
    currentSettings.restoreSelection = toggleSelection.checked;
    await persistAndBroadcast();
  });

  toggleAntiShield.addEventListener('change', async () => {
    currentSettings.antiShield = toggleAntiShield.checked;
    await persistAndBroadcast();
  });

  toggleAbsoluteForce.addEventListener('change', async () => {
    currentSettings.absoluteForce = toggleAbsoluteForce.checked;
    await persistAndBroadcast();
  });

  toggleModifierBypass.addEventListener('change', async () => {
    currentSettings.bypassModifierKey = toggleModifierBypass.checked;
    await persistAndBroadcast();
  });

  // Force Unlock button
  btnForceUnlock.addEventListener('click', async () => {
    if (!activeTabId) return;

    try {
      btnForceUnlock.disabled = true;
      btnForceUnlock.innerHTML = '<span>⏳</span> Unlocking...';

      await chrome.tabs.sendMessage(activeTabId, { type: 'RCR_FORCE_UNLOCK' });

      btnForceUnlock.classList.add('success');
      btnForceUnlock.innerHTML = '<span>✅</span> Unlocked!';

      setTimeout(() => {
        btnForceUnlock.classList.remove('success');
        btnForceUnlock.disabled = false;
        btnForceUnlock.innerHTML = '<span class="btn-icon">⚡</span> Force Unlock Page';
      }, 1400);
    } catch (e) {
      btnForceUnlock.innerHTML = '<span>⚠️</span> Unable to Unlock';
      setTimeout(() => {
        btnForceUnlock.disabled = false;
        btnForceUnlock.innerHTML = '<span class="btn-icon">⚡</span> Force Unlock Page';
      }, 1400);
    }
  });
});
