import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import tailwindcss from '@tailwindcss/postcss';
import esbuild from 'esbuild';
import esbuildSvelte from 'esbuild-svelte';
import postcss from 'postcss';

const isWatch = process.argv.includes('--watch');
const projectRoot = resolve(import.meta.dir, '..');
const srcDir = resolve(projectRoot, 'src');
const outDir = resolve(
  projectRoot,
  'SafariExtension/RightClickRestore/Shared (Extension)/Resources',
);

// 1. Build Popup CSS via Tailwind CSS v4 & PostCSS
async function buildCss() {
  const srcPath = resolve(srcDir, 'popup/popup.css');
  const destPath = resolve(outDir, 'popup/popup.css');
  const cssContent = await Bun.file(srcPath).text();
  const result = await postcss([tailwindcss()]).process(cssContent, {
    from: srcPath,
    to: destPath,
  });
  await mkdir(dirname(destPath), { recursive: true });
  await Bun.write(destPath, result.css);
}

// 2. Configure esbuild compilation context
const context = await esbuild.context({
  entryPoints: {
    background: resolve(srcDir, 'background/index.ts'),
    content: resolve(srcDir, 'content/index.ts'),
    'page-script': resolve(srcDir, 'page-script/index.ts'),
    'popup/popup': resolve(srcDir, 'popup/main.ts'),
  },
  outdir: outDir,
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  format: 'iife',
  target: ['safari18'],
  plugins: [
    esbuildSvelte({
      compilerOptions: { runes: true },
    }),
  ],
});

// 3. Asset Synchronization
async function copyAssets() {
  await mkdir(outDir, { recursive: true });
  await cp(resolve(srcDir, 'manifest.json'), resolve(outDir, 'manifest.json'));
  await mkdir(resolve(outDir, 'popup'), { recursive: true });
  await cp(
    resolve(srcDir, 'popup/index.html'),
    resolve(outDir, 'popup/index.html'),
  );
  await cp(
    resolve(srcDir, 'content/styles.css'),
    resolve(outDir, 'content.css'),
  );
  await cp(resolve(srcDir, 'icons'), resolve(outDir, 'icons'), {
    recursive: true,
  });
}

await copyAssets();
await buildCss();
await context.rebuild();

if (isWatch) {
  console.log('   Watching for changes...');
  await context.watch();
} else {
  console.log('✅ Build complete -> Resources/');
  await context.dispose();
}
