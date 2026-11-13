import { expect, test } from 'bun:test';
import { Window } from 'happy-dom';

test('video unblur follows site mutations and restores filters when disabled', async () => {
  const result = await Bun.build({
    entrypoints: ['src/content/index.ts'],
    target: 'browser',
    format: 'iife',
  });
  expect(result.success).toBe(true);
  const window = new Window({ url: 'https://example.com/' });
  let listener: (
    message: unknown,
    sender: unknown,
    reply: (response: unknown) => void,
  ) => void;
  Object.assign(window, {
    chrome: {
      runtime: {
        id: 'rcr-test',
        onMessage: {
          addListener: (callback: typeof listener) => {
            listener = callback;
          },
        },
      },
      storage: {
        local: {
          get: (_keys: unknown, callback: (value: unknown) => void) =>
            callback({}),
        },
        onChanged: { addListener: () => {} },
      },
    },
  });
  window.document.body.innerHTML = `
    <style>.recording { filter: brightness(0.8) blur(12px) !important; }</style>
    <div class="recording"><video style="filter: contrast(1.2) blur(8px) !important"></video><button>Play</button></div>
    <aside style="filter: blur(6px)">Unrelated content</aside>`;
  const setupWindowGlobals = () => {
    Object.assign(globalThis, {
      window,
      document: window.document,
      Document: window.Document,
      Node: window.Node,
      Element: window.Element,
      HTMLElement: window.HTMLElement,
      MutationObserver: window.MutationObserver,
      CustomEvent: window.CustomEvent,
      MouseEvent: window.MouseEvent,
      Event: window.Event,
      location: window.location,
      chrome: (window as unknown as Record<string, unknown>).chrome,
      requestAnimationFrame: window.requestAnimationFrame.bind(window),
    });
  };
  setupWindowGlobals();
  // biome-ignore lint/security/noGlobalEval: test helper for executing bundled scripts
  const globalEval = globalThis.eval;
  (window as unknown as Record<string, unknown>).eval = (code: string) => {
    setupWindowGlobals();
    return globalEval(code);
  };
  try {
    window.eval(await result.outputs[0].text());
    const video = window.document.querySelector('video');
    const player = window.document.querySelector('div');
    const aside = window.document.querySelector('aside');
    const button = window.document.querySelector('button');
    if (!video || !player || !aside || !button)
      throw new Error('Missing video fixture');
    const configure = (config: Record<string, unknown>) => {
      listener?.(
        { type: 'RCR_CONFIG_CHANGED', config },
        { id: 'rcr-test' },
        () => {},
      );
    };
    expect(video.style.filter).toBe('contrast(1.2) blur(8px)');
    configure({ unblurVideos: true });
    await window.happyDOM.whenAsyncComplete();
    expect(video.style.filter).toBe('contrast(1.2) blur(0px)');
    expect(video.style.getPropertyPriority('filter')).toBe('important');
    expect(player.style.filter).toBe('brightness(0.8) blur(0px)');
    expect(aside.style.filter).toBe('blur(6px)');
    expect(button.hasAttribute('style')).toBe(false);

    video.style.setProperty('filter', 'contrast(1.5) blur(20px)', 'important');
    await window.happyDOM.whenAsyncComplete();
    expect(video.style.filter).toBe('contrast(1.5) blur(0px)');
    player.className = '';
    await window.happyDOM.whenAsyncComplete();
    expect(player.style.filter).toBe('');
    player.className = 'recording';
    await window.happyDOM.whenAsyncComplete();
    expect(player.style.filter).toBe('brightness(0.8) blur(0px)');

    const addedVideo = window.document.createElement('video');
    addedVideo.style.filter = 'blur(4px)';
    player.append(addedVideo);
    await window.happyDOM.whenAsyncComplete();
    expect(addedVideo.style.filter).toBe('blur(0px)');
    addedVideo.remove();
    await window.happyDOM.whenAsyncComplete();
    expect(addedVideo.style.filter).toBe('blur(4px)');

    configure({ unblurVideos: false });
    await window.happyDOM.whenAsyncComplete();
    expect(video.style.filter).toBe('contrast(1.5) blur(20px)');
    expect(video.style.getPropertyPriority('filter')).toBe('important');
    expect(player.style.filter).toBe('');
    expect(window.getComputedStyle(player).filter).toBe(
      'brightness(0.8) blur(12px)',
    );
    configure({ unblurVideos: true });
    configure({ unblurVideos: true, enabled: false });
    await window.happyDOM.whenAsyncComplete();
    expect(video.style.filter).toBe('contrast(1.5) blur(20px)');
    configure({ unblurVideos: true, disabledDomains: ['example.com'] });
    await window.happyDOM.whenAsyncComplete();
    expect(video.style.filter).toBe('contrast(1.5) blur(20px)');

    // Verify DOM clobbering resistance on video ownerDocument property
    const clobberedInput = window.document.createElement('input');
    clobberedInput.name = 'ownerDocument';
    video.appendChild(clobberedInput);
    expect(video.ownerDocument).toBeDefined();
  } finally {
    await window.happyDOM.close();
  }
});

test('bundled content script handles Force Unlock through its registered listener', async () => {
  const result = await Bun.build({
    entrypoints: ['src/content/index.ts', 'src/page-script/index.ts'],
    target: 'browser',
    format: 'iife',
  });
  expect(result.success).toBe(true);
  const window = new Window({ url: 'https://example.com/' });
  let listener: (
    message: unknown,
    sender: unknown,
    reply: (response: unknown) => void,
  ) => void;
  Object.assign(window, {
    chrome: {
      runtime: {
        id: 'rcr-test',
        onMessage: {
          addListener: (callback: typeof listener) => {
            listener = callback;
          },
        },
      },
      storage: {
        local: {
          get: (_keys: unknown, callback: (value: unknown) => void) =>
            callback({ rcr_settings: { enabled: false } }),
        },
        onChanged: { addListener: () => {} },
      },
    },
  });
  window.document.body.innerHTML =
    '<p oncontextmenu="return false">Blocked</p><div class="html5-video-player"><video oncontextmenu="return false"></video><div class="cover"></div><button>Play</button></div><input>';
  const pageScript = result.outputs.find((output) =>
    output.path.endsWith('page-script/index.js'),
  );
  const contentScript = result.outputs.find((output) =>
    output.path.endsWith('content/index.js'),
  );
  if (!pageScript || !contentScript)
    throw new Error('Missing bundled runtime scripts');
  const setupWindowGlobals = () => {
    Object.assign(globalThis, {
      window,
      document: window.document,
      Document: window.Document,
      Node: window.Node,
      Element: window.Element,
      HTMLElement: window.HTMLElement,
      MutationObserver: window.MutationObserver,
      CustomEvent: window.CustomEvent,
      MouseEvent: window.MouseEvent,
      Event: window.Event,
      location: window.location,
      chrome: (window as unknown as Record<string, unknown>).chrome,
    });
  };
  setupWindowGlobals();
  // biome-ignore lint/security/noGlobalEval: test helper for executing bundled scripts
  const globalEval = globalThis.eval;
  (window as unknown as Record<string, unknown>).eval = (code: string) => {
    setupWindowGlobals();
    return globalEval(code);
  };
  window.eval(await pageScript.text());
  window.eval(await contentScript.text());
  const video = window.document.querySelector('video');
  const cover = window.document.querySelector('.cover');
  const button = window.document.querySelector('button');
  const input = window.document.querySelector('input');
  if (!video || !cover || !button || !input)
    throw new Error('Missing runtime elements');
  window.document.addEventListener(
    'contextmenu',
    (event) => event.preventDefault(),
    true,
  );
  const disabledEvent = new window.MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
  });
  video.dispatchEvent(disabledEvent);
  expect(disabledEvent.defaultPrevented).toBe(true);
  let response: unknown;
  listener?.({ type: 'RCR_FORCE_UNLOCK' }, { id: 'rcr-test' }, (value) => {
    response = value;
  });
  expect(response).toEqual({ status: 'unlocked' });
  const toastHost = window.document.getElementById('__rcr_toast_host__');
  expect(toastHost).not.toBeNull();
  expect(
    window.document.querySelector('p')?.hasAttribute('oncontextmenu'),
  ).toBe(false);
  expect(video.hasAttribute('oncontextmenu')).toBe(false);
  const mediaEvent = new window.MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
  });
  video.dispatchEvent(mediaEvent);
  expect(mediaEvent.defaultPrevented).toBe(false);
  const controlEvent = new window.MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
  });
  button.dispatchEvent(controlEvent);
  expect(controlEvent.defaultPrevented).toBe(true);
  const modifierEvent = new window.MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    shiftKey: true,
  });
  button.dispatchEvent(modifierEvent);
  expect(modifierEvent.defaultPrevented).toBe(false);
  input.addEventListener('copy', (event) => event.preventDefault());
  const copyEvent = new window.Event('copy', { cancelable: true });
  input.dispatchEvent(copyEvent);
  expect(copyEvent.defaultPrevented).toBe(true);
  cover.style.setProperty('pointer-events', 'auto', 'important');
  Object.defineProperty(
    Object.getPrototypeOf(window.document),
    'elementsFromPoint',
    {
      value: () => [cover, video],
    },
  );
  cover.dispatchEvent(
    new window.MouseEvent('mousemove', {
      bubbles: true,
      clientX: 10,
      clientY: 10,
    }),
  );
  expect(cover.style.pointerEvents).toBe('none');
  cover.dispatchEvent(
    new window.MouseEvent('mousemove', {
      bubbles: true,
      clientX: 10,
      clientY: 10,
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 1050));
  expect(cover.style.pointerEvents).toBe('auto');
  expect(cover.style.getPropertyPriority('pointer-events')).toBe('important');
  await window.happyDOM.close();
});
