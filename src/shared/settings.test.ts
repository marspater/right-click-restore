import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_SETTINGS,
  effectiveSettings,
  isDomainDisabled,
  normalizeHostname,
} from './settings';

describe('domain matching', () => {
  test('normalizes hostnames consistently', () => {
    expect(normalizeHostname('WWW.Example.COM.')).toBe('example.com');
    expect(normalizeHostname('   www.github.com   ')).toBe('github.com');
    expect(normalizeHostname('')).toBe('');
  });

  test('matches the exact domain', () => {
    expect(isDomainDisabled('example.com', ['example.com'])).toBe(true);
    expect(isDomainDisabled('www.example.com', ['example.com'])).toBe(true);
    expect(isDomainDisabled('example.com', ['www.example.com'])).toBe(true);
  });

  test('matches subdomains', () => {
    expect(isDomainDisabled('docs.example.com', ['example.com'])).toBe(true);
    expect(isDomainDisabled('api.v2.example.com', ['example.com'])).toBe(true);
  });

  test('does not match a lookalike suffix', () => {
    expect(isDomainDisabled('notexample.com', ['example.com'])).toBe(false);
    expect(isDomainDisabled('myexample.com', ['example.com'])).toBe(false);
  });

  test('handles empty and malformed domain lists safely', () => {
    expect(isDomainDisabled('', ['example.com'])).toBe(false);
    expect(isDomainDisabled('example.com', [])).toBe(false);
    expect(isDomainDisabled('example.com', ['', '   '])).toBe(false);
  });

  test('effective settings disable only the matching site', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      disabledDomains: ['example.com'],
    };

    expect(effectiveSettings(settings, 'docs.example.com').enabled).toBe(false);
    expect(effectiveSettings(settings, 'example.org').enabled).toBe(true);
  });
});
