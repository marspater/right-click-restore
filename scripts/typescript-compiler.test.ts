import { expect, test } from 'bun:test';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dir, '..');

test('TypeScript configuration has modern compiler options', async () => {
  const tsconfigPath = resolve(projectRoot, 'tsconfig.json');
  const tsconfig = await Bun.file(tsconfigPath).json();
  const opts = tsconfig.compilerOptions;

  expect(opts.target).toBe('ESNext');
  expect(opts.verbatimModuleSyntax).toBe(true);
  expect(opts.erasableSyntaxOnly).toBe(true);
  expect(opts.moduleResolution).toBe('bundler');
  expect(opts.strict).toBe(true);
  expect(opts.isolatedModules).toBe(true);
  expect(opts.types).toContain('bun');
  expect(opts.types).toContain('chrome');
  expect(opts.types).toContain('svelte');
});

test('compile the complete TypeScript project with the new compiler options with zero errors', async () => {
  const proc = Bun.spawn(['bunx', 'tsc', '--noEmit'], {
    cwd: projectRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  expect(exitCode).toBe(0);
  expect(stdout.trim()).toBe('');
  expect(stderr.trim()).toBe('');
});
