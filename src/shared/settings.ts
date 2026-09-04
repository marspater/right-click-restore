export interface Settings {
  enabled: boolean;
  restoreRightClick: boolean;
  restoreSelection: boolean;
  antiShield: boolean;
  absoluteForce: boolean;
  bypassModifierKey: boolean;
  disabledDomains: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  restoreRightClick: true,
  restoreSelection: true,
  antiShield: true,
  absoluteForce: false, // Default to false for reduced blast radius; opt-in escalation
  bypassModifierKey: true,
  disabledDomains: [],
};

const hostnameCache = new Map<string, string>();
const MAX_CACHE_SIZE = 5000;
const MAX_DOMAINS_COUNT = 500;
const MAX_HOSTNAME_LENGTH = 253;

export function normalizeHostname(hostname: string): string {
  if (typeof hostname !== 'string') return '';
  const cached = hostnameCache.get(hostname);
  if (cached !== undefined) {
    return cached;
  }

  const normalized = hostname
    .trim()
    .toLowerCase()
    .slice(0, MAX_HOSTNAME_LENGTH)
    .replace(/^www\./, '')
    .replace(/\.$/, '');

  if (hostnameCache.size >= MAX_CACHE_SIZE) {
    hostnameCache.clear();
  }
  hostnameCache.set(hostname, normalized);

  return normalized;
}

export function validateSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS };
  }

  const obj = raw as Record<string, unknown>;

  // Security Hardening: Ensure own properties only and block dangerous prototype keys
  const getOwnProperty = (key: string): unknown => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return Object.prototype.hasOwnProperty.call(obj, key)
      ? obj[key]
      : undefined;
  };

  const sanitizeBool = (key: string, fallback: boolean): boolean => {
    const val = getOwnProperty(key);
    return typeof val === 'boolean' ? val : fallback;
  };

  const sanitizeDomains = (val: unknown): string[] => {
    if (!Array.isArray(val)) return [];
    const validDomains = new Set<string>();
    for (let i = 0; i < val.length; i++) {
      if (validDomains.size >= MAX_DOMAINS_COUNT) break;
      const item = val[i];
      if (
        typeof item === 'string' &&
        item.length > 0 &&
        item.length <= MAX_HOSTNAME_LENGTH
      ) {
        const norm = normalizeHostname(item);
        if (norm) validDomains.add(norm);
      }
    }
    return Array.from(validDomains);
  };

  return {
    enabled: sanitizeBool('enabled', DEFAULT_SETTINGS.enabled),
    restoreRightClick: sanitizeBool(
      'restoreRightClick',
      DEFAULT_SETTINGS.restoreRightClick,
    ),
    restoreSelection: sanitizeBool(
      'restoreSelection',
      DEFAULT_SETTINGS.restoreSelection,
    ),
    antiShield: sanitizeBool('antiShield', DEFAULT_SETTINGS.antiShield),
    absoluteForce: sanitizeBool(
      'absoluteForce',
      DEFAULT_SETTINGS.absoluteForce,
    ),
    bypassModifierKey: sanitizeBool(
      'bypassModifierKey',
      DEFAULT_SETTINGS.bypassModifierKey,
    ),
    disabledDomains: sanitizeDomains(getOwnProperty('disabledDomains')),
  };
}

export function isDomainDisabled(
  hostname: string,
  disabledDomains: string[],
): boolean {
  if (!hostname || !disabledDomains || disabledDomains.length === 0) {
    return false;
  }

  const host = normalizeHostname(hostname);
  if (!host) return false;

  for (let i = 0; i < disabledDomains.length; i++) {
    const domain = disabledDomains[i];
    if (!domain) continue;

    const disabled = normalizeHostname(domain);
    if (disabled && (disabled === host || host.endsWith(`.${disabled}`))) {
      return true;
    }
  }

  return false;
}

export function effectiveSettings(
  settings: Settings,
  hostname: string,
): Settings {
  const validated = validateSettings(settings);
  return {
    ...validated,
    enabled:
      validated.enabled !== false &&
      !isDomainDisabled(hostname, validated.disabledDomains),
  };
}
