/**
 * Right Click & Selection Restorer - macOS 27 Host App Script
 */

function initPlatform(platform) {
  document.body.classList.add('platform-' + platform);
}

function updateStatus(isEnabled, state) {
  const dot = document.getElementById('status-dot');
  const title = document.getElementById('status-title');
  const desc = document.getElementById('status-desc');

  if (!dot || !title || !desc) return;

  if (isEnabled) {
    dot.className = 'status-glow-dot active';
    title.textContent = 'Extension is Active in Safari';
    desc.textContent =
      'Right-click and text selection protections are active across the web.';
  } else if (state === 'ready') {
    dot.className = 'status-glow-dot disabled';
    title.textContent = 'Extension is Turned Off in Safari';
    desc.textContent =
      'Click "Open Safari Settings…" below to toggle the extension on.';
  } else {
    dot.className = 'status-glow-dot';
    title.textContent = 'Awaiting Safari Setup';
    desc.textContent =
      'Check "Allow Unsigned Extensions" in Safari\'s Develop menu.';
  }
}

function logSandbox(msg) {
  const box = document.getElementById('sandbox-log');
  if (!box) return;
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. Dynamic Specular Mouse Tracking on Liquid Cards
  const cards = document.querySelectorAll('.liquid-card');
  document.addEventListener('mousemove', (e) => {
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', `${x}%`);
      card.style.setProperty('--mouse-y', `${y}%`);
    });
  });

  // 2. Tab Navigation
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => (p.style.display = 'none'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.style.display = 'block';
      }
    });
  });

  // 3. Button Actions
  const btnOpenPreferences = document.getElementById('btn-open-preferences');
  const btnOpenTest = document.getElementById('btn-open-test');
  const btnRefresh = document.getElementById('btn-refresh');

  if (btnOpenPreferences) {
    btnOpenPreferences.addEventListener('click', () => {
      if (window.webkit?.messageHandlers?.controller) {
        window.webkit.messageHandlers.controller.postMessage(
          'open-preferences',
        );
      }
    });
  }

  if (btnOpenTest) {
    btnOpenTest.addEventListener('click', () => {
      if (window.webkit?.messageHandlers?.controller) {
        window.webkit.messageHandlers.controller.postMessage('open-test-suite');
      }
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      if (window.webkit?.messageHandlers?.controller) {
        window.webkit.messageHandlers.controller.postMessage('check-status');
      }
    });
  }

  // 4. Sandbox Listeners
  const sandboxListenerBox = document.getElementById('sandbox-listener-box');
  if (sandboxListenerBox) {
    sandboxListenerBox.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      logSandbox('Website called e.preventDefault() on contextmenu');
    });
  }
});
