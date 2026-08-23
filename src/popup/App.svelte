<script lang="ts">
interface Settings {
  enabled: boolean;
  restoreRightClick: boolean;
  restoreSelection: boolean;
  antiShield: boolean;
  absoluteForce: boolean;
  bypassModifierKey: boolean;
  disabledDomains: string[];
}

const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  restoreRightClick: true,
  restoreSelection: true,
  antiShield: true,
  absoluteForce: true,
  bypassModifierKey: true,
  disabledDomains: [],
};

let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
let currentHostname = $state<string>('');
let activeTabId = $state<number | null>(null);
let unlockStatus = $state<'idle' | 'unlocking' | 'success' | 'error'>('idle');

const isSiteDisabled = $derived(
  Boolean(
    currentHostname && settings.disabledDomains.includes(currentHostname),
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
          currentHostname = 'Active Webpage';
        }
      } else if (tab.url?.startsWith('file://')) {
        currentHostname = 'Local File Page';
      } else {
        currentHostname = 'Special Safari Page';
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
  const list = [...settings.disabledDomains];
  if (isSiteDisabled) {
    const index = list.indexOf(currentHostname);
    if (index !== -1) list.splice(index, 1);
  } else {
    if (!list.includes(currentHostname)) list.push(currentHostname);
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
    await chrome.tabs.sendMessage(activeTabId, { type: 'RCR_FORCE_UNLOCK' });
    unlockStatus = 'success';
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

<main class="liquid-glass-shell p-3.5 text-neutral-900 dark:text-neutral-100 rounded-3xl relative overflow-hidden">
  <!-- Header -->
  <header class="flex items-center justify-between pb-3 px-1">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 p-0.5 shadow-md shadow-blue-500/30 flex items-center justify-center">
        <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      </div>
      <div>
        <div class="flex items-center gap-1.5">
          <h1 class="text-sm font-bold tracking-tight">RightClickRestore</h1>
          <span class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">macOS 27</span>
        </div>
        <p class="text-[10.5px] text-neutral-500 dark:text-neutral-400">Liquid Glass Shield Engine</p>
      </div>
    </div>

    <!-- Master Switch -->
    <label class="switch" title="Global On/Off Switch">
      <input type="checkbox" checked={settings.enabled} onchange={toggleGlobal} />
      <span class="slider"></span>
    </label>
  </header>

  <!-- Active Domain Card -->
  <section class="liquid-card rounded-2xl p-2.5 mb-2.5 flex items-center justify-between transition-all">
    <div class="flex items-center gap-2.5 min-w-0 pr-2">
      <div class={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all ${
        isSiteActive
          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
          : 'bg-neutral-500 shadow-none'
      }`}></div>
      <div class="min-w-0">
        <div class="text-[10px] uppercase font-semibold tracking-wider text-neutral-500 dark:text-neutral-400">
          {isSiteActive ? 'Active on Domain' : 'Disabled on Domain'}
        </div>
        <div class="text-xs font-semibold truncate max-w-[190px]" title={currentHostname}>
          {currentHostname || 'Loading…'}
        </div>
      </div>
    </div>

    {#if currentHostname && !currentHostname.includes('Special Safari')}
      <label class="switch small-switch" title="Toggle protection on this site">
        <input type="checkbox" checked={!isSiteDisabled} onchange={toggleCurrentSite} />
        <span class="slider"></span>
      </label>
    {/if}
  </section>

  <!-- Settings Grid -->
  <section class={`liquid-card rounded-2xl p-2 mb-2.5 flex flex-col gap-1 ${settings.enabled ? '' : 'dimmed'}`}>
    <!-- Feature 1: Restore Right Click -->
    <div class="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/5 transition-colors">
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
        </div>
        <div>
          <div class="text-xs font-semibold">Restore Right Click</div>
          <div class="text-[10px] text-neutral-500 dark:text-neutral-400">Unlocks native context menu</div>
        </div>
      </div>
      <label class="switch small-switch">
        <input type="checkbox" checked={settings.restoreRightClick} onchange={() => toggleFeature('restoreRightClick')} />
        <span class="slider"></span>
      </label>
    </div>

    <div class="h-px bg-white/10 mx-1"></div>

    <!-- Feature 2: Allow Selection & Copy -->
    <div class="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/5 transition-colors">
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-400 flex items-center justify-center">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <div>
          <div class="text-xs font-semibold">Allow Selection & Copy</div>
          <div class="text-[10px] text-neutral-500 dark:text-neutral-400">Enables text highlight & ⌘C</div>
        </div>
      </div>
      <label class="switch small-switch">
        <input type="checkbox" checked={settings.restoreSelection} onchange={() => toggleFeature('restoreSelection')} />
        <span class="slider"></span>
      </label>
    </div>

    <div class="h-px bg-white/10 mx-1"></div>

    <!-- Feature 3: Anti-Shield Overlay -->
    <div class="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/5 transition-colors">
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div class="text-xs font-semibold">Anti-Shield Overlay</div>
          <div class="text-[10px] text-neutral-500 dark:text-neutral-400">Pierces invisible click covers</div>
        </div>
      </div>
      <label class="switch small-switch">
        <input type="checkbox" checked={settings.antiShield} onchange={() => toggleFeature('antiShield')} />
        <span class="slider"></span>
      </label>
    </div>

    <div class="h-px bg-white/10 mx-1"></div>

    <!-- Feature 4: Absolute Force Mode -->
    <div class="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/5 transition-colors">
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div>
          <div class="text-xs font-semibold">Absolute Force Mode</div>
          <div class="text-[10px] text-neutral-500 dark:text-neutral-400">Deep prototype event override</div>
        </div>
      </div>
      <label class="switch small-switch">
        <input type="checkbox" checked={settings.absoluteForce} onchange={() => toggleFeature('absoluteForce')} />
        <span class="slider"></span>
      </label>
    </div>

    <div class="h-px bg-white/10 mx-1"></div>

    <!-- Feature 5: Modifier Key Bypass -->
    <div class="flex items-center justify-between p-1.5 rounded-xl hover:bg-white/5 transition-colors">
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.001M10 8h.001M14 8h.001M18 8h.001M8 12h.001M12 12h.001M16 12h.001M7 16h10" />
          </svg>
        </div>
        <div>
          <div class="text-xs font-semibold">Modifier Key Bypass</div>
          <div class="text-[10px] text-neutral-500 dark:text-neutral-400">Hold <kbd>Shift</kbd> or <kbd>⌥</kbd> + Click</div>
        </div>
      </div>
      <label class="switch small-switch">
        <input type="checkbox" checked={settings.bypassModifierKey} onchange={() => toggleFeature('bypassModifierKey')} />
        <span class="slider"></span>
      </label>
    </div>
  </section>

  <!-- Force Unlock Action Button -->
  <div class="mb-2.5">
    <button
      type="button"
      onclick={forceUnlockPage}
      disabled={unlockStatus === 'unlocking'}
      class={`w-full py-2 px-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.98] ${
        unlockStatus === 'success'
          ? 'bg-emerald-500 text-white shadow-emerald-500/30'
          : unlockStatus === 'error'
          ? 'bg-rose-500 text-white shadow-rose-500/30'
          : 'bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 text-white shadow-blue-500/30 hover:opacity-95'
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
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span>Force Unlock Page Now</span>
      {/if}
    </button>
  </div>

  <!-- Tip Footer -->
  <footer class="text-[10px] text-center text-neutral-500 dark:text-neutral-400 px-1 leading-tight">
    💡 Hold <kbd>Shift</kbd> while right-clicking anywhere to force native menu.
  </footer>
</main>
