import { mount } from 'svelte';
import App from './App.svelte';

function initApp() {
  try {
    let target = document.getElementById('app');
    if (!target) {
      target = document.createElement('div');
      target.id = 'app';
      document.body.appendChild(target);
    }
    return mount(App, { target });
  } catch (err) {
    console.error('[RightClickRestore] Failed to mount popup UI:', err);
    return null;
  }
}

const app = initApp();
export default app;
