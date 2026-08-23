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
        siteDomain.textContent = 'Special Safari Page';
        siteToggle.disabled = true;
      }
    }
  } catch (err) {
    siteDomain.textContent = 'Active Page';
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

    const isSiteDisabled =
      currentHostname && currentSettings.disabledDomains?.includes(currentHostname);
    siteToggle.checked = !isSiteDisabled;

    const isActive = currentSettings.enabled && !isSiteDisabled;
    if (isActive) {
      siteStatusDot.classList.remove('disabled');
    } else {
      siteStatusDot.classList.add('disabled');
    }

    // Bug 10/14 Fix: Dim feature controls when global toggle is off
    const container = document.querySelector('.popup-container');
    if (container) {
      if (!currentSettings.enabled) {
        container.classList.add('popup-disabled');
      } else {
        container.classList.remove('popup-disabled');
      }
    }
  }

  updateUI();

  // 4. Save and broadcast settings change
  async function persistAndBroadcast() {
    await chrome.storage.local.set({ rcr_settings: currentSettings });

    try {
      chrome.runtime.sendMessage({ type: 'RCR_SETTINGS_UPDATED' });
    } catch (e) {}

    if (activeTabId) {
      try {
        await chrome.tabs.sendMessage(activeTabId, {
          type: 'RCR_CONFIG_CHANGED',
          config: currentSettings
        });
      } catch (e) {}
    }
    updateUI();
  }

  // 5. Event Listeners
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

  // Force Unlock button with smooth SVG state updates
  btnForceUnlock.addEventListener('click', async () => {
    if (!activeTabId) return;

    try {
      btnForceUnlock.disabled = true;
      btnForceUnlock.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
          <line x1="12" y1="2" x2="12" y2="6"></line>
          <line x1="12" y1="18" x2="12" y2="22"></line>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
          <line x1="2" y1="12" x2="6" y2="12"></line>
          <line x1="18" y1="12" x2="22" y2="12"></line>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
        </svg>
        <span>Unlocking Page…</span>
      `;

      await chrome.tabs.sendMessage(activeTabId, { type: 'RCR_FORCE_UNLOCK' });

      btnForceUnlock.classList.add('success');
      btnForceUnlock.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>Unlocked Successfully!</span>
      `;

      setTimeout(() => {
        btnForceUnlock.classList.remove('success');
        btnForceUnlock.disabled = false;
        btnForceUnlock.innerHTML = `
          <svg class="btn-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span class="btn-text">Force Unlock Page Now</span>
        `;
      }, 1500);
    } catch (e) {
      btnForceUnlock.innerHTML = `<span>⚠️ Unable to Unlock</span>`;
      setTimeout(() => {
        btnForceUnlock.disabled = false;
        btnForceUnlock.innerHTML = `
          <svg class="btn-icon-svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <span class="btn-text">Force Unlock Page Now</span>
        `;
      }, 1500);
    }
  });
});
