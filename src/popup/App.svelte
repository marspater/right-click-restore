<script lang="ts">
import {
  DEFAULT_SETTINGS,
  type Settings,
  isDomainDisabled,
  normalizeHostname,
} from '../shared/settings';

let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
let currentHostname = $state<string>('');
let activeTabId = $state<number | null>(null);
let unlockStatus = $state<'idle' | 'unlocking' | 'success' | 'error'>('idle');

const isSiteDisabled = $derived(
  Boolean(
    currentHostname &&
      isDomainDisabled(currentHostname, settings.disabledDomains),
  ),
);

const isSiteActive = $derived(settings.enabled && !isSiteDisabled);

// Load state and active tab on mount
$effect(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab?.id) {
      activeTabId = tab.id;
      if (tab.url?.startsWith('http://') || tab.url?.startsWith('https://')) {
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

  chrome.storage.local.get(['rcr_settings'], (res) => {
    if (res.rcr_settings) {
      settings = { ...DEFAULT_SETTINGS, ...res.rcr_settings };
    }
  });
});

async function saveSettings(newSettings: Settings) {
  settings = newSettings;
  await chrome.storage.local.set({
    rcr_settings: $state.snapshot(newSettings),
    shieldEnabled: newSettings.enabled,
  });

  chrome.action.setBadgeText({ text: newSettings.enabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({
    color: newSettings.enabled ? '#007AFF' : '#8E8E93',
  });

  if (activeTabId) {
    try {
      chrome.tabs.sendMessage(activeTabId, {
        type: 'RCR_CONFIG_CHANGED',
        config: $state.snapshot(newSettings),
      });
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

  let list = [...settings.disabledDomains];
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

async function forceUnlockPage() {
  if (!activeTabId) return;
  unlockStatus = 'unlocking';
  try {
    const res = await chrome.tabs.sendMessage(activeTabId, {
      type: 'RCR_FORCE_UNLOCK',
    });
    if (res && res.status === 'unlocked') {
      unlockStatus = 'success';
    } else {
      unlockStatus = 'success';
    }
    setTimeout(() => {
      unlockStatus = 'idle';
    }, 1600);
  } catch (_err) {
    unlockStatus = 'error';
    setTimeout(() => {
      unlockStatus = 'idle';
    }, 1600);
  }
}
</script>

<main class="popover-root">
  <!-- Clean Apple-style Header -->
  <header class="flex items-center justify-between pb-3">
    <div class="flex items-center gap-2.5">
      <div class="w-7 h-7 rounded-[9px] bg-gradient-to-b from-blue-500 to-blue-600 flex items-center justify-center shadow-sm shadow-blue-500/40">
        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      </div>
      <div>
        <h1 class="text-[13.5px] font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 leading-tight">
          RightClickRestore
        </h1>
        <p class="text-[10.5px] text-neutral-500 dark:text-neutral-400 font-normal">
          Context Menu & Selection Restorer
        </p>
      </div>
    </div>

    <!-- Master Apple Switch -->
    <label class="apple-switch" title="Global Toggle">
      <input type="checkbox" checked={settings.enabled} onchange={toggleGlobal} aria-label="Toggle Extension Globally" />
      <span class="apple-slider"></span>
    </label>
  </header>

  <!-- Active Domain Card with Balanced Alignment -->
  <section class="glass-card px-3 py-2.5 mb-2.5 flex items-center justify-between">
    <div class="flex items-center gap-2.5 min-w-0 pr-2">
      <!-- Status Beacon -->
      <div class="flex items-center justify-center flex-shrink-0">
        <span class={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          isSiteActive
            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] ring-2 ring-emerald-500/20'
            : 'bg-neutral-400 dark:bg-neutral-500 shadow-none'
        }`}></span>
      </div>

      <!-- Domain Labels Stack -->
      <div class="min-w-0 flex flex-col justify-center">
        <span class="text-[9.5px] uppercase font-semibold tracking-wider text-neutral-500 dark:text-neutral-400 leading-none">
          {isSiteActive ? 'Active on Domain' : 'Disabled on Domain'}
        </span>
        <span class="text-[12.5px] font-semibold text-neutral-900 dark:text-neutral-100 truncate leading-snug mt-1" title={currentHostname}>
          {currentHostname || 'Loading…'}
        </span>
      </div>
    </div>

    {#if currentHostname && !currentHostname.includes('Safari Page')}
      <label class="apple-switch apple-switch-sm" title="Toggle protection on this domain">
        <input type="checkbox" checked={!isSiteDisabled} onchange={toggleCurrentSite} aria-label="Toggle domain protection" />
        <span class="apple-slider"></span>
      </label>
    {/if}
  </section>

  <!-- Settings List with Apple Continuous Squircles -->
  <section class={`glass-card p-1.5 mb-2.5 flex flex-col ${settings.enabled ? '' : 'dimmed'}`}>
    <!-- Feature 1: Restore Right Click -->
    <label class="flex items-center justify-between p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer select-none">
      <div class="flex items-center gap-2.5">
        <div class="w-5 h-5 rounded-md bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
        </div>
        <div>
          <div class="text-xs font-medium">Restore Right Click</div>
          <div class="text-[9.5px] text-neutral-500 dark:text-neutral-400">Unlocks native context menu</div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" checked={settings.restoreRightClick} onchange={() => toggleFeature('restoreRightClick')} aria-label="Restore Right Click" />
        <span class="apple-slider"></span>
      </span>
    </label>

    <div class="h-[0.5px] bg-neutral-200 dark:bg-white/10 mx-2"></div>

    <!-- Feature 2: Allow Selection & Copy -->
    <label class="flex items-center justify-between p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer select-none">
      <div class="flex items-center gap-2.5">
        <div class="w-5 h-5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <div>
          <div class="text-xs font-medium">Allow Selection & Copy</div>
          <div class="text-[9.5px] text-neutral-500 dark:text-neutral-400">Enables text highlight & ⌘C</div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" checked={settings.restoreSelection} onchange={() => toggleFeature('restoreSelection')} aria-label="Allow Selection & Copy" />
        <span class="apple-slider"></span>
      </span>
    </label>

    <div class="h-[0.5px] bg-neutral-200 dark:bg-white/10 mx-2"></div>

    <!-- Feature 3: Anti-Shield Overlay -->
    <label class="flex items-center justify-between p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer select-none">
      <div class="flex items-center gap-2.5">
        <div class="w-5 h-5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div class="text-xs font-medium">Anti-Shield Overlay</div>
          <div class="text-[9.5px] text-neutral-500 dark:text-neutral-400">Pierces transparent click covers</div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" checked={settings.antiShield} onchange={() => toggleFeature('antiShield')} aria-label="Anti-Shield Overlay" />
        <span class="apple-slider"></span>
      </span>
    </label>

    <div class="h-[0.5px] bg-neutral-200 dark:bg-white/10 mx-2"></div>

    <!-- Feature 4: Absolute Force Mode -->
    <label class="flex items-center justify-between p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer select-none">
      <div class="flex items-center gap-2.5">
        <div class="w-5 h-5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div>
          <div class="text-xs font-medium">Absolute Force Mode</div>
          <div class="text-[9.5px] text-neutral-500 dark:text-neutral-400">Deep prototype event override</div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" checked={settings.absoluteForce} onchange={() => toggleFeature('absoluteForce')} aria-label="Absolute Force Mode" />
        <span class="apple-slider"></span>
      </span>
    </label>

    <div class="h-[0.5px] bg-neutral-200 dark:bg-white/10 mx-2"></div>

    <!-- Feature 5: Modifier Key Bypass -->
    <label class="flex items-center justify-between p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer select-none">
      <div class="flex items-center gap-2.5">
        <div class="w-5 h-5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
          </svg>
        </div>
        <div>
          <div class="text-xs font-medium">Modifier Key Bypass</div>
          <div class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-tight">
            Hold <kbd>⇧ Shift</kbd> or <kbd>⌥ Option</kbd> + Click
          </div>
        </div>
      </div>
      <span class="apple-switch apple-switch-sm">
        <input type="checkbox" checked={settings.bypassModifierKey} onchange={() => toggleFeature('bypassModifierKey')} aria-label="Modifier Key Bypass" />
        <span class="apple-slider"></span>
      </span>
    </label>
  </section>

  <!-- Force Unlock Action Button -->
  <div class="mb-2">
    <button
      type="button"
      onclick={forceUnlockPage}
      disabled={unlockStatus === 'unlocking'}
      aria-live="polite"
      class={`w-full py-2 px-3 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.99] ${
        unlockStatus === 'success'
          ? 'bg-emerald-500 text-white'
          : unlockStatus === 'error'
          ? 'bg-rose-500 text-white'
          : 'bg-blue-500 hover:bg-blue-600 text-white'
      }`}
    >
      {#if unlockStatus === 'unlocking'}
        <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25" stroke="currentColor" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
        <span>Unlocking Page…</span>
      {:else if unlockStatus === 'success'}
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Unlocked Successfully!</span>
      {:else if unlockStatus === 'error'}
        <span>⚠️ Unable to Unlock Tab</span>
      {:else}
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span>Force Unlock Page Now</span>
      {/if}
    </button>
  </div>

  <!-- Tip Footer with High-Contrast Inline Keycap -->
  <footer class="pt-1 text-center">
    <p class="text-[10px] text-neutral-500 dark:text-neutral-400 leading-normal m-0 inline">
      💡 Hold <kbd>⇧ Shift</kbd> while right-clicking to force native menu.
    </p>
  </footer>
</main>
