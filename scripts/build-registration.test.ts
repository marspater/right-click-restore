import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function runSigningArgs(env: Record<string, string>) {
  const script = await Bun.file('build.sh').text();
  const block = script.slice(
    script.indexOf('if [[ "${ALLOW_UNSIGNED:-0}" == "1" ]]; then'),
    script.indexOf('rm -rf "$BUILD_DIR"'),
  );
  const proc = Bun.spawn(
    ['bash', '-c', `set -eu\n${block}\necho "\${SIGNING_ARGS[@]}"`],
    {
      env: { ...process.env, ...env },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  return { code, stdout, stderr };
}

async function runVerifyBlock(env: Record<string, string>) {
  const script = await Bun.file('build.sh').text();
  const block = script.slice(
    script.indexOf(
      'if [[ "${ALLOW_UNSIGNED:-0}" == "1" ]]; then\n  echo "🔏 Applying ad-hoc',
    ),
    script.indexOf('# Xcode automatically registers macOS build products.'),
  );
  const proc = Bun.spawn(
    [
      'bash',
      '-c',
      `set -eu
ROOT_DIR=/tmp
APP_PATH=/build/app
APPEX_PATH=/build/extension
codesign() { echo "codesign $*"; }
spctl() { echo "spctl $*"; }
${block}`,
    ],
    {
      env: { ...process.env, ...env },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const stdout = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return { code, stdout };
}

async function runCleanup(
  scratch: string,
  env: Record<string, string>,
  mockCodesign = ':;',
) {
  const script = await Bun.file('build.sh').text();
  const block = script
    .slice(script.indexOf('INSTALLED_APP='), script.indexOf('\necho ""'))
    .replace(
      'INSTALLED_APP="/Applications/$APP_NAME.app"',
      'INSTALLED_APP="$SCRATCH/installed"',
    )
    .replace(
      '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',
      'lsregister',
    );

  const proc = Bun.spawn(
    [
      'bash',
      '-c',
      `set -eu
APP_PATH=/build/app
APPEX_PATH=/build/extension
plutil() { if [[ "$*" == *installed* && "\${MATCHING:-1}" == 0 ]]; then echo other.id; else echo app.id; fi; }
codesign() { ${mockCodesign} }
pluginkit() { if [[ "$1" == -m ]]; then if [[ "\${PRESENT:-1}" == 1 ]]; then echo "$APPEX_PATH"; fi; else echo "plugin $*"; fi; }
lsregister() { echo "services $*"; }
${block}`,
    ],
    {
      env: { ...process.env, SCRATCH: scratch, ...env },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const stdout = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return { code, stdout };
}

test('ALLOW_UNSIGNED=1 disables signing requirements and clears identity', async () => {
  const { code, stdout } = await runSigningArgs({ ALLOW_UNSIGNED: '1' });
  expect(code).toBe(0);
  expect(stdout).toContain('CODE_SIGNING_REQUIRED=NO');
  expect(stdout).toContain('CODE_SIGNING_ALLOWED=NO');
  expect(stdout).toContain('CODE_SIGN_IDENTITY=');
});

test('signed build without DEVELOPMENT_TEAM exits with diagnostic error', async () => {
  const { code, stderr } = await runSigningArgs({
    ALLOW_UNSIGNED: '0',
    DEVELOPMENT_TEAM: '',
  });
  expect(code).not.toBe(0);
  expect(stderr).toContain('Set DEVELOPMENT_TEAM for a signed build');
});

test('signed build with DEVELOPMENT_TEAM configures manual signing', async () => {
  const { code, stdout } = await runSigningArgs({
    ALLOW_UNSIGNED: '0',
    DEVELOPMENT_TEAM: 'TEAM123456',
    CODE_SIGN_IDENTITY: 'Developer ID Application',
  });
  expect(code).toBe(0);
  expect(stdout).toContain('DEVELOPMENT_TEAM=TEAM123456');
  expect(stdout).toContain('CODE_SIGN_STYLE=Manual');
  expect(stdout).toContain('CODE_SIGN_IDENTITY=Developer ID Application');
  expect(stdout).toContain('CODE_SIGNING_REQUIRED=YES');
  expect(stdout).toContain('CODE_SIGNING_ALLOWED=YES');
});

test('ALLOW_UNSIGNED=1 applies ad-hoc signature and verifies', async () => {
  const { code, stdout } = await runVerifyBlock({ ALLOW_UNSIGNED: '1' });
  expect(code).toBe(0);
  expect(stdout).toContain('Applying ad-hoc signature');
  expect(stdout).toContain('codesign -s - --force');
  expect(stdout).toContain('codesign --verify --strict /build/extension');
  expect(stdout).toContain('codesign --verify --strict /build/app');
  expect(stdout).not.toContain('spctl');
});

test('signed build performs deep codesign verification and spctl assessment', async () => {
  const { code, stdout } = await runVerifyBlock({ ALLOW_UNSIGNED: '0' });
  expect(code).toBe(0);
  expect(stdout).toContain('Validating signed app bundle');
  expect(stdout).toContain(
    'codesign --verify --deep --strict --verbose=2 /build/app',
  );
  expect(stdout).toContain(
    'spctl --assess --type execute --verbose=2 /build/app',
  );
});

test('build cleanup targets only the build copy and honors development registration', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'rcr-reg-'));
  try {
    await mkdir(join(scratch, 'installed'));
    for (const [registered, matching, present, expected] of [
      ['0', '1', '1', 'plugin -r /build/extension\nservices -u /build/app\n'],
      ['1', '1', '1', ''],
      ['0', '0', '1', ''],
      ['0', '1', '0', 'services -u /build/app\n'],
    ]) {
      const { code, stdout } = await runCleanup(scratch, {
        REGISTER_BUILD_APP: registered,
        MATCHING: matching,
        PRESENT: present,
      });
      expect(code).toBe(0);
      expect(stdout).toBe(expected);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('installed-app cleanup proceeds non-blockingly even when installed app codesign check fails', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'rcr-verify-'));
  try {
    await mkdir(join(scratch, 'installed'));
    const failingCodesign =
      'if [[ "$*" == *installed* ]]; then echo "unsigned" >&2; return 1; fi;';
    const { code, stdout } = await runCleanup(
      scratch,
      { REGISTER_BUILD_APP: '0' },
      failingCodesign,
    );
    expect(code).toBe(0);
    expect(stdout).toBe('plugin -r /build/extension\nservices -u /build/app\n');
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
