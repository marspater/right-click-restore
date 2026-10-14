import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
