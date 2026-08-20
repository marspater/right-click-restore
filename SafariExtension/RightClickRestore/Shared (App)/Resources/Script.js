/**
 * Right Click & Selection Restorer - Host App Controller Script
 */

function initPlatform(platform) {
  document.body.classList.add('platform-' + platform);
}

function updateStatus(isEnabled, state) {
  const dot = document.getElementById('status-dot');
  const title = document.getElementById('status-title');
  const desc = document.getElementById('status-desc');

  if (isEnabled) {
    dot.className = 'status-dot active';
    title.textContent = 'Extension is Active in Safari';
    desc.textContent = 'Right-click and text selection protections are restored.';
  } else if (state === 'ready') {
    dot.className = 'status-dot disabled';
    title.textContent = 'Extension is Turned Off in Safari';
    desc.textContent = 'Open Safari Settings to enable the extension.';
  } else {
    dot.className = 'status-dot';
    title.textContent = 'Extension Awaiting Setup';
    desc.textContent = 'Enable "Allow Unsigned Extensions" in Safari Develop menu.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btnOpenPreferences = document.getElementById('btn-open-preferences');
  const btnOpenTest = document.getElementById('btn-open-test');
  const btnRefresh = document.getElementById('btn-refresh');

  if (btnOpenPreferences) {
    btnOpenPreferences.addEventListener('click', () => {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.controller) {
        window.webkit.messageHandlers.controller.postMessage('open-preferences');
      }
    });
  }

  if (btnOpenTest) {
    btnOpenTest.addEventListener('click', () => {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.controller) {
        window.webkit.messageHandlers.controller.postMessage('open-test-suite');
      }
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.controller) {
        window.webkit.messageHandlers.controller.postMessage('check-status');
      }
    });
  }

  // Attach sandbox blocker listener
  const sandboxListener = document.getElementById('sandbox-listener');
  if (sandboxListener) {
    sandboxListener.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }
});
