(() => {
  const BLOCKED_ATTRS = [
    'oncontextmenu',
    'onselectstart',
    'ondragstart',
    'oncopy',
    'oncut',
    'onmousedown',
    'onmouseup',
  ];

  function injectMainWorldScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('page-script.js');
      script.async = false;
      const target = document.head || document.documentElement || document.body;
      if (target) {
        target.appendChild(script);
        script.onload = () => script.remove();
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          (
            document.head ||
            document.documentElement ||
            document.body
          )?.appendChild(script);
          script.onload = () => script.remove();
        });
      }
    } catch (_e) {}
  }

  function cleanNode(el: Element) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    for (const attr of BLOCKED_ATTRS) {
      if (el.hasAttribute(attr)) {
        try {
          el.removeAttribute(attr);
        } catch (_e) {}
      }
    }
    // Also remove inline styles blocking selection
    if (el instanceof HTMLElement && el.style) {
      if (el.style.userSelect === 'none') el.style.userSelect = 'auto';
      if (el.style.webkitUserSelect === 'none')
        el.style.webkitUserSelect = 'auto';
    }
  }

  function cleanDOMTree(root: Element | Document = document) {
    if (root instanceof Element) cleanNode(root);
    try {
      const selector = BLOCKED_ATTRS.map((a) => `[${a}]`).join(',');
      for (const node of root.querySelectorAll(selector)) {
        cleanNode(node);
      }
    } catch (_e) {}
    try {
      for (const node of root.querySelectorAll('[style*="user-select"]')) {
        cleanNode(node);
      }
    } catch (_e) {}
  }

  // 1. Inject MAIN-world interceptor
  injectMainWorldScript();

  // 2. Initial scrub
  if (document.documentElement) {
    cleanDOMTree(document.documentElement);
  }

  // 3. Scrub on DOM ready & load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => cleanDOMTree());
  } else {
    cleanDOMTree();
  }
  window.addEventListener('load', () => cleanDOMTree());

  // 4. Observe dynamic subtree mutations and inline attribute additions
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.target instanceof Element) {
        cleanNode(m.target);
      }
      if (m.type === 'childList') {
        for (const n of m.addedNodes) {
          if (n instanceof Element) {
            cleanNode(n);
            for (const child of n.querySelectorAll('*')) {
              cleanNode(child);
            }
          }
        }
      }
    }
  });

  if (document.documentElement) {
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: BLOCKED_ATTRS,
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      obs.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: BLOCKED_ATTRS,
      });
    });
  }
})();
