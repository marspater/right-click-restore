import { expect, test } from 'bun:test';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dir, '..');
const popupCssPath = resolve(projectRoot, 'src/popup/popup.css');
const tailwindBin = resolve(projectRoot, 'node_modules/.bin/tailwindcss');

test('popup.css declares required semantic theme tokens in @theme block', async () => {
  const cssContent = await Bun.file(popupCssPath).text();
  const themeMatch = cssContent.match(/@theme\s*\{([^}]+)\}/);
  expect(themeMatch).not.toBeNull();
  const themeBody = themeMatch ? themeMatch[1] : '';

  const expectedTokens = [
    '--color-popover: var(--bg-popover);',
    '--color-card: var(--bg-card);',
    '--color-card-hover: var(--bg-card-hover);',
    '--color-row-hover: var(--bg-row-hover);',
    '--color-badge: var(--bg-badge);',
    '--color-badge-active: var(--bg-badge-active);',
    '--color-kbd: var(--bg-kbd);',
    '--color-border-subtle: var(--border-subtle);',
    '--color-border-divider: var(--border-divider);',
    '--color-border-kbd: var(--border-kbd);',
    '--color-text-primary: var(--text-primary);',
    '--color-text-secondary: var(--text-secondary);',
    '--color-text-tertiary: var(--text-tertiary);',
    '--color-accent-blue: var(--accent-blue);',
    '--color-accent-green: var(--accent-green);',
    '--color-accent-orange: var(--accent-orange);',
    '--color-accent-red: var(--accent-red);',
    '--radius-card: 12px;',
    '--radius-btn: 10px;',
    '--radius-icon: 8px;',
    '--radius-kbd: 5px;',
  ];

  for (const token of expectedTokens) {
    expect(themeBody).toContain(token);
  }
});

test('popup.css preserves light and dark mode variable values', async () => {
  const cssContent = await Bun.file(popupCssPath).text();

  // Verify light mode values in :root
  expect(cssContent).toContain('--bg-popover: rgba(246, 246, 248, 0.92);');
  expect(cssContent).toContain('--text-primary: #1c1c1e;');
  expect(cssContent).toContain('--border-subtle: rgba(0, 0, 0, 0.08);');
  expect(cssContent).toContain('--accent-blue: #007aff;');

  // Verify dark mode values in @media (prefers-color-scheme: dark)
  expect(cssContent).toContain('@media (prefers-color-scheme: dark)');
  expect(cssContent).toContain('--bg-popover: rgba(30, 30, 32, 0.9);');
  expect(cssContent).toContain('--text-primary: #ffffff;');
  expect(cssContent).toContain('--border-subtle: rgba(255, 255, 255, 0.09);');
  expect(cssContent).toContain('--accent-blue: #0a84ff;');
});

test('Tailwind v4 CLI compiles popup CSS and generates theme token utilities', async () => {
  const proc = Bun.spawn([tailwindBin, '-i', popupCssPath, '--minify'], {
    cwd: projectRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  expect(exitCode).toBe(0);

  // Verify theme layer and semantic tokens
  expect(stdout).toContain('--color-popover:var(--bg-popover)');
  expect(stdout).toContain('--color-card:var(--bg-card)');
  expect(stdout).toContain('--color-text-primary:var(--text-primary)');
  expect(stdout).toContain('--radius-card:12px');

  // Verify utility generation from semantic theme tokens
  expect(stdout).toContain(
    '.bg-popover{background-color:var(--color-popover)}',
  );
  expect(stdout).toContain('.text-accent-blue{color:var(--color-accent-blue)}');
  expect(stdout).toContain('.rounded-card{border-radius:var(--radius-card)}');

  // Verify light and dark mode variable values
  expect(stdout).toContain('--bg-popover:#f6f6f8eb');
  expect(stdout).toContain('--bg-popover:#1e1e20e6');
});
