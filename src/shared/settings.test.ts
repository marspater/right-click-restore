import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_SETTINGS,
  effectiveSettings,
  getDomainStatusLabel,
  isDomainDisabled,
  isLocalFileHost,
  isSystemPageHost,
  normalizeHostname,
  validateSettings,
} from './settings';

describe('settings & domain matching', () => {
  test('normalizes hostnames consistently', () => {
    expect(normalizeHostname('example.com')).toBe('example.com');
    expect(normalizeHostname('WWW.Example.COM')).toBe('example.com');
    expect(normalizeHostname('sub.domain.example.com.')).toBe(
      'sub.domain.example.com',
    );
    expect(normalizeHostname('   blog.example.org   ')).toBe(
      'blog.example.org',
    );
    expect(normalizeHostname(123 as unknown as string)).toBe('');
  });

  test('sanitizes hostnames containing schemes, ports, and invalid characters', () => {
    expect(normalizeHostname('https://evil.com/path')).toBe('evil.com');
    expect(normalizeHostname('http://sub.evil.com:8080')).toBe('sub.evil.com');
    expect(normalizeHostname('evil.com\0extra')).toBe('evil.comextra');
    expect(normalizeHostname('bad_domain!@#$')).toBe('');
  });

  test('caps oversized hostname inputs to prevent DoS attacks', () => {
    const hugeHostname = `${'a'.repeat(10000)}.example.com`;
    expect(() => normalizeHostname(hugeHostname)).not.toThrow();
    expect(normalizeHostname(hugeHostname)).toBe('a'.repeat(253));
  });

  test('matches the exact domain', () => {
    expect(isDomainDisabled('example.com', ['example.com'])).toBe(true);
    expect(isDomainDisabled('www.example.com', ['example.com'])).toBe(true);
    expect(isDomainDisabled('other.com', ['example.com'])).toBe(false);
  });

  test('matches subdomains', () => {
    expect(isDomainDisabled('sub.example.com', ['example.com'])).toBe(true);
    expect(isDomainDisabled('deep.sub.example.com', ['example.com'])).toBe(
      true,
    );
  });

  test('does not match a lookalike suffix', () => {
    expect(isDomainDisabled('badexample.com', ['example.com'])).toBe(false);
    expect(isDomainDisabled('fake-example.com', ['example.com'])).toBe(false);
  });

  test('handles empty and malformed domain lists safely', () => {
    expect(isDomainDisabled('example.com', [])).toBe(false);
    expect(
      isDomainDisabled('example.com', [null as unknown as string, '']),
    ).toBe(false);
  });

  test('effective settings disable only the matching site', () => {
    const custom = {
      ...DEFAULT_SETTINGS,
      disabledDomains: ['blocked.com'],
    };

    const disabledSite = effectiveSettings(custom, 'blocked.com');
    const allowedSite = effectiveSettings(custom, 'allowed.com');

    expect(disabledSite.enabled).toBe(false);
    expect(allowedSite.enabled).toBe(true);
  });

  test('validateSettings returns default settings on null or non-object input', () => {
    expect(validateSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings('invalid')).toEqual(DEFAULT_SETTINGS);
    expect(validateSettings([1, 2, 3])).toEqual(DEFAULT_SETTINGS);
  });

  test('validateSettings sanitizes corrupted types and bounds arrays', () => {
    const hostile = {
      enabled: 'true', // invalid type
      restoreRightClick: false,
      restoreSelection: null, // invalid type
      antiShield: true,
      absoluteForce: 123, // invalid type
      bypassModifierKey: false,
      disabledDomains: [
        'valid.com',
        123,
        null,
        'www.OTHER.com',
        'a'.repeat(300), // exceeds max hostname length
      ],
    };

    const result = validateSettings(hostile);

    expect(result.enabled).toBe(DEFAULT_SETTINGS.enabled);
    expect(result.restoreRightClick).toBe(false);
    expect(result.restoreSelection).toBe(DEFAULT_SETTINGS.restoreSelection);
    expect(result.antiShield).toBe(true);
    expect(result.absoluteForce).toBe(DEFAULT_SETTINGS.absoluteForce);
    expect(result.bypassModifierKey).toBe(false);
    expect(result.disabledDomains).toEqual(['valid.com', 'other.com']);
  });

  test('validateSettings resists prototype pollution and prototype key properties', () => {
    const protoObj = { enabled: false };
    const inherited = Object.create(protoObj);

    const validatedInherited = validateSettings(inherited);
    // Should ignore inherited properties and use default
    expect(validatedInherited.enabled).toBe(DEFAULT_SETTINGS.enabled);

    const payload = JSON.parse(
      '{"__proto__": {"polluted": true, "enabled": false}, "constructor": {"prototype": {"polluted": true}}}',
    );

    const validated = validateSettings(payload);

    expect(
      (Object.prototype as unknown as Record<string, unknown>).polluted,
    ).toBeUndefined();
    expect(validated.enabled).toBe(DEFAULT_SETTINGS.enabled);
  });

  test('identifies system pages and local files correctly', () => {
    expect(isSystemPageHost('Safari Page')).toBe(true);
    expect(isSystemPageHost('Active Page')).toBe(true);
    expect(isSystemPageHost('example.com')).toBe(false);

    expect(isLocalFileHost('Local Test Page')).toBe(true);
    expect(isLocalFileHost('file:///Users/test/index.html')).toBe(true);
    expect(isLocalFileHost('example.com')).toBe(false);
  });

  test('computes domain status labels accurately', () => {
    expect(getDomainStatusLabel(false, 'example.com', [])).toBe(
      'Extension Paused',
    );
    expect(getDomainStatusLabel(true, 'Safari Page', [])).toBe('System Page');
    expect(getDomainStatusLabel(true, 'Local Test Page', [])).toBe(
      'Active on Local Page',
    );
    expect(getDomainStatusLabel(true, 'example.com', ['example.com'])).toBe(
      'Disabled on Domain',
    );
    expect(getDomainStatusLabel(true, 'example.com', [])).toBe(
      'Active on Domain',
    );
  });
});
