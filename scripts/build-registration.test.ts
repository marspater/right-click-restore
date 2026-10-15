import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('build signing arguments configure signed vs ALLOW_UNSIGNED paths', async () => {
  const script = await Bun.file('build.sh').text();
  const signingArgsBlock = script.slice(
    script.indexOf('if [[ "${ALLOW_UNSIGNED:-0}" == "1" ]]; then'),
    script.indexOf('rm -rf "$BUILD_DIR"'),
  );

  // 1. ALLOW_UNSIGNED=1: disables signing requirements and clears identity
  const unsignedProc = Bun.spawn(
    [
      'bash',
      '-c',
      `set -eu
${signingArgsBlock}
echo "\${SIGNING_ARGS[@]}"`,
    ],
    {
      env: { ...process.env, ALLOW_UNSIGNED: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const unsignedOut = await new Response(unsignedProc.stdout).text();
  expect(await unsignedProc.exited).toBe(0);
  expect(unsignedOut).toContain('CODE_SIGNING_REQUIRED=NO');
  expect(unsignedOut).toContain('CODE_SIGNING_ALLOWED=NO');
  expect(unsignedOut).toContain('CODE_SIGN_IDENTITY=');

  // 2. Signed path without DEVELOPMENT_TEAM: exits with diagnostic error
  const missingTeamProc = Bun.spawn(
    [
      'bash',
      '-c',
      `set -eu
unset DEVELOPMENT_TEAM || true
${signingArgsBlock}
echo "\${SIGNING_ARGS[@]}"`,
    ],
    {
      env: { ...process.env, ALLOW_UNSIGNED: '0', DEVELOPMENT_TEAM: '' },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const missingTeamErr = await new Response(missingTeamProc.stderr).text();
  expect(await missingTeamProc.exited).not.toBe(0);
  expect(missingTeamErr).toContain('Set DEVELOPMENT_TEAM for a signed build');

  // 3. Signed path with DEVELOPMENT_TEAM: requires and allows manual signing
  const signedProc = Bun.spawn(
    [
      'bash',
      '-c',
      `set -eu
${signingArgsBlock}
echo "\${SIGNING_ARGS[@]}"`,
    ],
    {
      env: {
        ...process.env,
        ALLOW_UNSIGNED: '0',
        DEVELOPMENT_TEAM: 'TEAM123456',
        CODE_SIGN_IDENTITY: 'Developer ID Application',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const signedOut = await new Response(signedProc.stdout).text();
  expect(await signedProc.exited).toBe(0);
  expect(signedOut).toContain('DEVELOPMENT_TEAM=TEAM123456');
  expect(signedOut).toContain('CODE_SIGN_STYLE=Manual');
  expect(signedOut).toContain('CODE_SIGN_IDENTITY=Developer ID Application');
  expect(signedOut).toContain('CODE_SIGNING_REQUIRED=YES');
  expect(signedOut).toContain('CODE_SIGNING_ALLOWED=YES');
});

test('build post-build signing and verification distinguishes signed vs ALLOW_UNSIGNED paths', async () => {
  const script = await Bun.file('build.sh').text();
  const verifyBlock = script.slice(
    script.indexOf(
      'if [[ "${ALLOW_UNSIGNED:-0}" == "1" ]]; then\n  echo "🔏 Applying ad-hoc',
    ),
    script.indexOf('# Xcode automatically registers macOS build products.'),
  );

  // 1. ALLOW_UNSIGNED=1 path applies ad-hoc signature and verifies
  const unsignedProc = Bun.spawn(
    [
      'bash',
      '-c',
      `set -eu
ROOT_DIR=/tmp
APP_PATH=/build/app
APPEX_PATH=/build/extension
codesign() { echo "codesign $*"; }
spctl() { echo "spctl $*"; }
${verifyBlock}`,
    ],
    {
      env: { ...process.env, ALLOW_UNSIGNED: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const unsignedOut = await new Response(unsignedProc.stdout).text();
  expect(await unsignedProc.exited).toBe(0);
  expect(unsignedOut).toContain('Applying ad-hoc signature');
  expect(unsignedOut).toContain('codesign -s - --force');
  expect(unsignedOut).toContain('codesign --verify --strict /build/extension');
  expect(unsignedOut).toContain('codesign --verify --strict /build/app');
  expect(unsignedOut).not.toContain('spctl');

  // 2. Signed path performs deep strict codesign verification and Gatekeeper spctl assessment
  const signedProc = Bun.spawn(
    [
      'bash',
      '-c',
      `set -eu
ROOT_DIR=/tmp
APP_PATH=/build/app
APPEX_PATH=/build/extension
codesign() { echo "codesign $*"; }
spctl() { echo "spctl $*"; }
${verifyBlock}`,
    ],
    {
      env: { ...process.env, ALLOW_UNSIGNED: '0' },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const signedOut = await new Response(signedProc.stdout).text();
  expect(await signedProc.exited).toBe(0);
  expect(signedOut).toContain('Validating signed app bundle');
  expect(signedOut).toContain(
    'codesign --verify --deep --strict --verbose=2 /build/app',
  );
  expect(signedOut).toContain(
    'spctl --assess --type execute --verbose=2 /build/app',
  );
});

test('build cleanup targets only the build copy and honors development registration', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'rcr-registration-'));
  try {
    await mkdir(join(scratch, 'installed'));
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
    for (const [registered, matching, present, expected] of [
      ['0', '1', '1', 'plugin -r /build/extension\nservices -u /build/app\n'],
      ['1', '1', '1', ''],
      ['0', '0', '1', ''],
      ['0', '1', '0', 'services -u /build/app\n'],
    ]) {
      const child = Bun.spawn(
        [
          'bash',
          '-c',
          `set -eu
APP_PATH=/build/app
APPEX_PATH=/build/extension
plutil() { if [[ "$*" == *installed* && "$MATCHING" == 0 ]]; then echo other.id; else echo app.id; fi; }
codesign() { :; }
pluginkit() { if [[ "$1" == -m ]]; then if [[ "$PRESENT" == 1 ]]; then echo "$APPEX_PATH"; fi; else echo "plugin $*"; fi; }
lsregister() { echo "services $*"; }
${block}`,
        ],
        {
          env: {
            ...process.env,
            SCRATCH: scratch,
            REGISTER_BUILD_APP: registered,
            MATCHING: matching,
            PRESENT: present,
          },
          stdout: 'pipe',
          stderr: 'pipe',
        },
      );
      const output = await new Response(child.stdout).text();
      expect(await child.exited).toBe(0);
      expect(output).toBe(expected);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

test('installed-app cleanup proceeds non-blockingly even when installed app codesign check fails', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'rcr-codesign-verify-'));
  try {
    await mkdir(join(scratch, 'installed'));
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

    // Mock codesign failing on installed app (e.g. ad-hoc or self-signed installed app)
    const child = Bun.spawn(
      [
        'bash',
        '-c',
        `set -eu
APP_PATH=/build/app
APPEX_PATH=/build/extension
plutil() { echo app.id; }
codesign() { if [[ "$*" == *installed* ]]; then echo "code object is not signed at all" >&2; return 1; fi; }
pluginkit() { if [[ "$1" == -m ]]; then echo "$APPEX_PATH"; else echo "plugin $*"; fi; }
lsregister() { echo "services $*"; }
${block}`,
      ],
      {
        env: {
          ...process.env,
          SCRATCH: scratch,
          REGISTER_BUILD_APP: '0',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    const output = await new Response(child.stdout).text();
    const exitCode = await child.exited;

    // Must succeed without aborting due to non-blocking 2>/dev/null || true
    expect(exitCode).toBe(0);
    expect(output).toBe('plugin -r /build/extension\nservices -u /build/app\n');
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});
