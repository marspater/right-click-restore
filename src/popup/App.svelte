<script lang="ts">
import {
  DEFAULT_SETTINGS,
  type Settings,
  isDomainDisabled,
  normalizeHostname,
  validateSettings,
} from '../shared/settings';

let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
let currentHostname = $state<string>('');
let activeTabId = $state<number | null>(null);
let unlockStatus = $state<'idle' | 'unlocking' | 'success' | 'error'>('idle');

const isToggleableDomain = $derived(
  Boolean(currentHostname && normalizeHostname(currentHostname)),
);

const isSiteDisabled = $derived(
  Boolean(
    isToggleableDomain &&
      isDomainDisabled(currentHostname, settings.disabledDomains),
  ),
);

const isSiteActive = $derived(
  Boolean(settings.enabled && isToggleableDomain && !isSiteDisabled),
);

const disabledRowTooltip = $derived(
  isSiteActive
    ? undefined
    : !settings.enabled
      ? 'Extension is paused globally'
      : !isToggleableDomain
        ? 'Protection is unavailable on system pages'
        : 'Protection is disabled on this domain',
);

// Load state and active tab on mount
$effect(() => {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime?.lastError || !tabs || tabs.length === 0) {
          currentHostname = 'Active Page';
          return;
        }
        const tab = tabs[0];
        if (tab?.id) {
          activeTabId = tab.id;
          if (
            tab.url?.startsWith('http://') ||
            tab.url?.startsWith('https://')
          ) {
            try {
              currentHostname = new URL(tab.url).hostname;
            } catch (_e) {
              currentHostname = 'Active Page';
            }
          } else if (tab.url?.startsWith('file://')) {
            currentHostname = 'Local Test Page';
          } else {
            currentHostname = 'Safari Page';
          }
        }
      });
    }
  } catch (_e) {
    currentHostname = 'Active Page';
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['rcr_settings', 'shieldEnabled'], (res) => {
        if (chrome.runtime?.lastError || !res) return;
        const loadedSettings = validateSettings({
          ...DEFAULT_SETTINGS,
          ...(res.rcr_settings ?? {}),
        });
        if (typeof res.shieldEnabled === 'boolean') {
          loadedSettings.enabled = res.shieldEnabled;
        }
        settings = loadedSettings;
      });
    }
  } catch (_e) {}
});

async function saveSettings(newSettings: Settings) {
  const validated = validateSettings(newSettings);
  settings = validated;

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({
        rcr_settings: $state.snapshot(validated),
        shieldEnabled: validated.enabled,
      });
    }
  } catch (_err) {}

  try {
    if (typeof chrome !== 'undefined' && chrome.action) {
      chrome.action.setBadgeText({ text: validated.enabled ? 'ON' : 'OFF' });
      chrome.action.setBadgeBackgroundColor({
        color: validated.enabled ? '#007AFF' : '#8E8E93',
      });
    }
  } catch (_err) {}

  if (
    activeTabId &&
    typeof chrome !== 'undefined' &&
    chrome.tabs?.sendMessage
  ) {
    try {
      chrome.tabs.sendMessage(
        activeTabId,
        {
          type: 'RCR_CONFIG_CHANGED',
          config: $state.snapshot(validated),
        },
        () => {
          if (chrome.runtime?.lastError) {
            // Tab may not have content script loaded (e.g. settings page)
          }
        },
      );
    } catch (_e) {}
  }
}

function toggleGlobal() {
  saveSettings({ ...settings, enabled: !settings.enabled });
}

function toggleCurrentSite() {
  if (!currentHostname) return;
  const host = normalizeHostname(currentHostname);
  if (!host) return;

  const currentList = Array.isArray(settings.disabledDomains)
    ? [...settings.disabledDomains]
    : [];

  let list = currentList;
  if (isSiteDisabled) {
    list = list.filter((d) => {
      const norm = normalizeHostname(d);
      return norm !== host && !host.endsWith(`.${norm}`);
    });
  } else {
    if (!list.some((d) => normalizeHostname(d) === host)) {
      list.push(host);
    }
  }
  saveSettings({ ...settings, disabledDomains: list });
}

function toggleFeature(key: keyof Settings) {
  if (typeof settings[key] === 'boolean') {
    saveSettings({ ...settings, [key]: !settings[key] });
  }
}

let unlockTimeout: ReturnType<typeof setTimeout> | null = null;

const statusAnnouncement = $derived(
  unlockStatus === 'unlocking'
    ? 'Unlocking current page…'
    : unlockStatus === 'success'
      ? 'Page unlocked successfully'
      : unlockStatus === 'error'
        ? 'Unable to unlock current page'
        : '',
);

$effect(() => {
  return () => {
    if (unlockTimeout) {
      clearTimeout(unlockTimeout);
      unlockTimeout = null;
    }
  };
});

async function forceUnlockPage() {
  if (!activeTabId || !isSiteActive || unlockStatus !== 'idle') return;
  unlockStatus = 'unlocking';
  if (unlockTimeout) {
    clearTimeout(unlockTimeout);
    unlockTimeout = null;
  }

  try {
    if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
      const res = await new Promise<unknown>((resolve) => {
        chrome.tabs.sendMessage(
          activeTabId as number,
          { type: 'RCR_FORCE_UNLOCK' },
          (response) => {
            if (chrome.runtime?.lastError) {
              resolve(null);
            } else {
              resolve(response);
            }
          },
        );
      });

      if (
        res &&
        typeof res === 'object' &&
        (res as { status?: string }).status === 'unlocked'
      ) {
        unlockStatus = 'success';
      } else {
        unlockStatus = 'error';
      }
    } else {
      unlockStatus = 'error';
    }
  } catch (_err) {
    unlockStatus = 'error';
  }

  unlockTimeout = setTimeout(() => {
    unlockStatus = 'idle';
    unlockTimeout = null;
  }, 1600);
}
</script>

<main class="popover-root">
  <!-- Apple-Style Header -->
  <header class="flex items-center justify-between pb-3 select-none">
    <div class="flex items-center gap-2.5">
      <img src="../icons/icon-64.png" class={`w-7 h-7 rounded-[6px] shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-200 hover:scale-105 ${settings.enabled ? '' : 'grayscale opacity-60'}`} alt="" />
      <div>
        <h1 class="text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--text-primary)] leading-tight">
          RightClickRestore
        </h1>
        <p class="text-[10.5px] text-[var(--text-secondary)] font-normal leading-tight">
          Safari Context Menu Shield
        </p>
      </div>
    </div>

    <!-- Master Apple Switch -->
    <label class="apple-switch" title={settings.enabled ? 'Disable protection globally' : 'Enable protection globally'}>
      <input type="checkbox" role="switch" checked={settings.enabled} aria-checked={settings.enabled} onchange={toggleGlobal} aria-label="Protection globally" />
      <span class="apple-slider"></span>
    </label>
  </header>

  <!-- Active Domain Inset Card -->
  {#if isToggleableDomain}
    <label
      class={`glass-card domain-card px-3 py-2.5 mb-2 flex items-center justify-between transition-all select-none ${
        settings.enabled ? 'cursor-pointer hover:bg-[var(--bg-card-hover)]' : 'dimmed cursor-not-allowed'
      }`}
      aria-disabled={!settings.enabled}
      title={settings.enabled ? (isSiteDisabled ? `Enable protection on ${currentHostname}` : `Disable protection on ${currentHostname}`) : 'Extension is paused globally'}
    >
      <div class="flex items-center gap-2.5 min-w-0 pr-2">
        <!-- Status Beacon -->
        <div class="flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <span class="relative flex h-2.5 w-2.5 items-center justify-center">
            {#if isSiteActive}
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-green)] opacity-35"></span>
            {/if}
            <span class={`relative inline-flex rounded-full h-2 w-2 transition-all duration-200 ${
              isSiteActive
                ? 'bg-[var(--accent-green)] shadow-[0_0_6px_var(--beacon-green-glow)]'
                : settings.enabled && isSiteDisabled
                  ? 'bg-[var(--accent-orange)] shadow-[0_0_6px_var(--beacon-orange-glow)]'
                  : 'bg-[var(--text-tertiary)]'
            }`}></span>
          </span>
        </div>

        <!-- Domain Labels Stack -->
        <div class="min-w-0 flex flex-col justify-center">
          <span id="desc-domain-status" class="text-[9.5px] uppercase font-semibold tracking-wider text-[var(--text-secondary)] leading-none">
            {!settings.enabled ? 'Extension Paused' : isSiteDisabled ? 'Disabled on Domain' : 'Active on Domain'}
          </span>
          <span class="text-[12.5px] font-semibold text-[var(--text-primary)] truncate leading-snug mt-0.5" title={currentHostname}>
            {currentHostname || 'Loading…'}
          </span>
        </div>
      </div>

      <span class="apple-switch apple-switch-sm" title={isSiteDisabled ? `Enable protection on ${currentHostname}` : `Disable protection on ${currentHostname}`}>
        <input type="checkbox" role="switch" checked={!isSiteDisabled} aria-checked={!isSiteDisabled} aria-describedby="desc-domain-status" disabled={!settings.enabled} onchange={toggleCurrentSite} aria-label={`Protection on ${currentHostname}`} />
        <span class="apple-slider"></span>
      </span>
    </label>
  {:else}
    <section
      class={`glass-card domain-card px-3 py-2.5 mb-2 flex items-center justify-between transition-all ${settings.enabled ? '' : 'dimmed'}`}
      title={settings.enabled ? 'Protection is unavailable on system pages' : 'Extension is paused globally'}
    >
      <div class="flex items-center gap-2.5 min-w-0 pr-2">
        <!-- Status Beacon -->
        <div class="flex items-center justify-center flex-shrink-0" aria-hidden="true">
          <span class="relative flex h-2.5 w-2.5 items-center justify-center">
            {#if isSiteActive}
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent-green)] opacity-35"></span>
            {/if}
            <span class={`relative inline-flex rounded-full h-2 w-2 transition-all duration-200 ${
              isSiteActive
                ? 'bg-[var(--accent-green)] shadow-[0_0_6px_var(--beacon-green-glow)]'
                : settings.enabled && isSiteDisabled
                  ? 'bg-[var(--accent-orange)] shadow-[0_0_6px_var(--beacon-orange-glow)]'
                  : 'bg-[var(--text-tertiary)]'
            }`}></span>
          </span>
        </div>

        <!-- Domain Labels Stack -->
        <div class="min-w-0 flex flex-col justify-center">
          <span class="text-[9.5px] uppercase font-semibold tracking-wider text-[var(--text-secondary)] leading-none">
            {!settings.enabled ? 'Extension Paused' : 'System / Restricted Page'}
          </span>
          <span class="text-[12.5px] font-semibold text-[var(--text-primary)] truncate leading-snug mt-0.5" title={currentHostname}>
            {currentHostname || 'Loading…'}
          </span>
        </div>
      </div>

      <span class="text-[9.5px] font-medium text-[var(--text-tertiary)] bg-[var(--bg-badge)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)] flex-shrink-0 select-none" title="Per-site toggling is unavailable for system and local pages">
        Global Protection
      </span>
    </section>
  {/if}

  <!-- Settings List Group -->
  <section class={`glass-card p-1 mb-2 flex flex-col ${isSiteActive ? '' : 'dimmed'}`}>
    <!-- Feature 1: Restore Right Click -->
    <label class={`settings-row ${isSiteActive ? '' : 'is-disabled'}`} aria-disabled={!isSiteActive} title={disabledRowTooltip}>
      <div class="flex items-center gap-2.5 min-w-0">
        <div class={`setting-icon-badge w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 transition-colors ${
          isSiteActive && settings.restoreRightClick
            ? 'bg-[var(--bg-badge-active)] text-[var(--accent-blue)]'
            : 'bg-[var(--bg-badge)] text-[var(--text-secondary)]'
        }`} aria-hidden="true">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-[12px] font-medium text-[var(--text-primary)] leading-tight">Restore Right Click</div>
          <div id="desc-restore-right-click" class="text-[10px] text-[var(--text-secondary)] leading-tight">Unblocks native context menus</div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" role="switch" checked={settings.restoreRightClick} aria-checked={settings.restoreRightClick} aria-describedby="desc-restore-right-click" disabled={!isSiteActive} onchange={() => toggleFeature('restoreRightClick')} aria-label="Restore Right Click" />
        <span class="apple-slider"></span>
      </span>
    </label>

    <div class="settings-divider" aria-hidden="true"></div>

    <!-- Feature 2: Allow Selection & Copy -->
    <label class={`settings-row ${isSiteActive ? '' : 'is-disabled'}`} aria-disabled={!isSiteActive} title={disabledRowTooltip}>
      <div class="flex items-center gap-2.5 min-w-0">
        <div class={`setting-icon-badge w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 transition-colors ${
          isSiteActive && settings.restoreSelection
            ? 'bg-[var(--bg-badge-active)] text-[var(--accent-blue)]'
            : 'bg-[var(--bg-badge)] text-[var(--text-secondary)]'
        }`} aria-hidden="true">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-[12px] font-medium text-[var(--text-primary)] leading-tight">Allow Selection & Copy</div>
          <div id="desc-restore-selection" class="text-[10px] text-[var(--text-secondary)] leading-tight">Enables text highlight and <kbd class="kbd-subtext">⌘C</kbd></div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" role="switch" checked={settings.restoreSelection} aria-checked={settings.restoreSelection} aria-describedby="desc-restore-selection" disabled={!isSiteActive} onchange={() => toggleFeature('restoreSelection')} aria-label="Allow Selection & Copy" />
        <span class="apple-slider"></span>
      </span>
    </label>

    <div class="settings-divider" aria-hidden="true"></div>

    <!-- Feature 3: Anti-Shield Overlay -->
    <label class={`settings-row ${isSiteActive ? '' : 'is-disabled'}`} aria-disabled={!isSiteActive} title={disabledRowTooltip}>
      <div class="flex items-center gap-2.5 min-w-0">
        <div class={`setting-icon-badge w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 transition-colors ${
          isSiteActive && settings.antiShield
            ? 'bg-[var(--bg-badge-active)] text-[var(--accent-blue)]'
            : 'bg-[var(--bg-badge)] text-[var(--text-secondary)]'
        }`} aria-hidden="true">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-[12px] font-medium text-[var(--text-primary)] leading-tight">Anti-Shield Overlay</div>
          <div id="desc-anti-shield" class="text-[10px] text-[var(--text-secondary)] leading-tight">Pierces transparent click covers</div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" role="switch" checked={settings.antiShield} aria-checked={settings.antiShield} aria-describedby="desc-anti-shield" disabled={!isSiteActive} onchange={() => toggleFeature('antiShield')} aria-label="Anti-Shield Overlay" />
        <span class="apple-slider"></span>
      </span>
    </label>

    <div class="settings-divider" aria-hidden="true"></div>

    <label class={`settings-row ${isSiteActive ? '' : 'is-disabled'}`} aria-disabled={!isSiteActive} title={disabledRowTooltip}>
      <div class="flex items-center gap-2.5 min-w-0">
        <div class={`setting-icon-badge w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 transition-colors ${
          isSiteActive && settings.unblurVideos
            ? 'bg-[var(--bg-badge-active)] text-[var(--accent-blue)]'
            : 'bg-[var(--bg-badge)] text-[var(--text-secondary)]'
        }`} aria-hidden="true">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="5" width="14" height="14" rx="2" />
            <path d="m17 10 4-3v10l-4-3" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-[12px] font-medium text-[var(--text-primary)] leading-tight">Unblur Videos</div>
          <div id="desc-unblur-videos" class="text-[10px] text-[var(--text-secondary)] leading-tight">Removes site CSS blur; protected capture stays blocked</div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" role="switch" checked={settings.unblurVideos} aria-checked={settings.unblurVideos} aria-describedby="desc-unblur-videos" disabled={!isSiteActive} onchange={() => toggleFeature('unblurVideos')} aria-label="Unblur Videos" />
        <span class="apple-slider"></span>
      </span>
    </label>

    <div class="settings-divider" aria-hidden="true"></div>

    <!-- Feature 4: Absolute Force Mode -->
    <label class={`settings-row ${isSiteActive ? '' : 'is-disabled'}`} aria-disabled={!isSiteActive} title={disabledRowTooltip}>
      <div class="flex items-center gap-2.5 min-w-0">
        <div class={`setting-icon-badge w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 transition-colors ${
          isSiteActive && settings.absoluteForce
            ? 'bg-[var(--bg-badge-active)] text-[var(--accent-blue)]'
            : 'bg-[var(--bg-badge)] text-[var(--text-secondary)]'
        }`} aria-hidden="true">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-[12px] font-medium text-[var(--text-primary)] leading-tight">Absolute Force Mode</div>
          <div id="desc-absolute-force" class="text-[10px] text-[var(--text-secondary)] leading-tight">Overrides capture-phase event traps</div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" role="switch" checked={settings.absoluteForce} aria-checked={settings.absoluteForce} aria-describedby="desc-absolute-force" disabled={!isSiteActive} onchange={() => toggleFeature('absoluteForce')} aria-label="Absolute Force Mode" />
        <span class="apple-slider"></span>
      </span>
    </label>

    <div class="settings-divider" aria-hidden="true"></div>

    <!-- Feature 5: Modifier Key Bypass -->
    <label class={`settings-row ${isSiteActive ? '' : 'is-disabled'}`} aria-disabled={!isSiteActive} title={disabledRowTooltip}>
      <div class="flex items-center gap-2.5 min-w-0">
        <div class={`setting-icon-badge w-6 h-6 rounded-[7px] flex items-center justify-center flex-shrink-0 transition-colors ${
          isSiteActive && settings.bypassModifierKey
            ? 'bg-[var(--bg-badge-active)] text-[var(--accent-blue)]'
            : 'bg-[var(--bg-badge)] text-[var(--text-secondary)]'
        }`} aria-hidden="true">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-[12px] font-medium text-[var(--text-primary)] leading-tight">Modifier Key Bypass</div>
          <div id="desc-bypass-modifier-key" class="text-[10px] text-[var(--text-secondary)] leading-tight">Bypass with <kbd class="kbd-subtext">⇧ Shift</kbd> or <kbd class="kbd-subtext">⌥ Option</kbd></div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" role="switch" checked={settings.bypassModifierKey} aria-checked={settings.bypassModifierKey} aria-describedby="desc-bypass-modifier-key" disabled={!isSiteActive} onchange={() => toggleFeature('bypassModifierKey')} aria-label="Modifier Key Bypass" />
        <span class="apple-slider"></span>
      </span>
    </label>
  </section>

  <!-- Force Unlock Action Button -->
  <div class="mb-2">
    <button
      type="button"
      onclick={forceUnlockPage}
      disabled={!isSiteActive}
      aria-disabled={unlockStatus !== 'idle' || !isSiteActive}
      title={isSiteActive
        ? 'Force unlock context menu and selection on active page'
        : !settings.enabled
          ? 'Extension is paused globally'
          : !isToggleableDomain
            ? 'Protection is unavailable on system pages'
            : 'Protection is inactive on this domain'}
      class={`w-full py-1.5 px-3 rounded-[10px] font-medium text-[12px] transition-all flex items-center justify-center gap-1.5 cursor-pointer select-none disabled:cursor-not-allowed ${
        isSiteActive && unlockStatus === 'idle' ? 'active:scale-[0.985]' : ''
      } ${
        unlockStatus === 'unlocking'
          ? 'bg-[var(--bg-badge-active)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 shadow-sm disabled:opacity-100'
          : unlockStatus === 'success'
            ? 'bg-[var(--accent-green)] text-white shadow-sm border border-transparent disabled:opacity-100'
            : unlockStatus === 'error'
              ? 'bg-[var(--accent-red)] text-white shadow-sm border border-transparent disabled:opacity-100'
              : isSiteActive
                ? 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-[var(--shadow-btn)]'
                : 'bg-[var(--bg-card)] text-[var(--text-tertiary)] border border-[var(--border-subtle)] opacity-50'
      }`}
    >
      {#if unlockStatus === 'unlocking'}
        <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25" stroke="currentColor" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        <span>Unlocking Current Page…</span>
      {:else if unlockStatus === 'success'}
        <svg class="w-3.5 h-3.5 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Page Unlocked</span>
      {:else if unlockStatus === 'error'}
        <svg class="w-3.5 h-3.5 animate-pop-in" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Unable to Unlock Page</span>
      {:else}
        <svg class={`w-3.5 h-3.5 force-unlock-icon transition-transform duration-150 ${isSiteActive ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span>Force Unlock Page</span>
      {/if}
    </button>

    <!-- Live Region Status Announcement for Screen Readers -->
    <div class="sr-only" role="status" aria-live="polite">
      {statusAnnouncement}
    </div>
  </div>

  <!-- Footnote Tip with Dynamic Context Awareness & Quick-Action -->
  <footer class="pt-0.5 text-center select-none">
    <p class="text-[10px] text-[var(--text-tertiary)] leading-tight m-0 inline">
      {#if !settings.enabled}
        Extension is paused globally
      {:else if !isToggleableDomain}
        Protection is unavailable on system pages
      {:else if isSiteDisabled}
        Protection is disabled on this domain
      {:else if settings.bypassModifierKey}
        Tip: Hold <kbd class="kbd-subtext">⇧ Shift</kbd> or <kbd class="kbd-subtext">⌥ Option</kbd> for native menu
      {:else}
        Tip: <button
          type="button"
          onclick={() => toggleFeature('bypassModifierKey')}
          disabled={!isSiteActive}
          class="text-[var(--accent-blue)] font-medium hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-blue)] rounded-[2px] cursor-pointer inline disabled:no-underline disabled:cursor-not-allowed disabled:text-[var(--text-tertiary)]"
          title="Enable Modifier Key Bypass setting"
        >Enable Modifier Key Bypass</button> to hold <kbd class="kbd-subtext">⇧ Shift</kbd>
      {/if}
    </p>
  </footer>
</main>

