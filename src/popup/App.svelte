<script lang="ts">
let isEnabled = $state(true);

$effect(() => {
  chrome.storage.local.get(['shieldEnabled'], (res) => {
    if (res.shieldEnabled !== undefined) {
      isEnabled = res.shieldEnabled;
    }
  });
});

// biome-ignore lint/correctness/noUnusedVariables: used in svelte template
async function toggleShield() {
  isEnabled = !isEnabled;
  await chrome.storage.local.set({ shieldEnabled: isEnabled });
  chrome.action.setBadgeText({ text: isEnabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: '#007AFF' });
}
</script>

<main class="p-4 rounded-2xl liquid-glass text-neutral-900 dark:text-neutral-100">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-sm font-semibold tracking-tight">RightClickRestore</h1>
      <p class="text-[11px] text-neutral-500 dark:text-neutral-400">Context menu unblocker</p>
    </div>
    <button
      type="button"
      onclick={toggleShield}
      class={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
        isEnabled
          ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/50'
          : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500'
      }`}
    >
      {isEnabled ? 'ACTIVE' : 'OFF'}
    </button>
  </div>
</main>
