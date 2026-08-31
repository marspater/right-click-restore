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
  absoluteForce: true,
  bypassModifierKey: true,
  disabledDomains: [],
};

const hostnameCache = new Map<string, string>();
const MAX_CACHE_SIZE = 5000;

export function normalizeHostname(hostname: string): string {
  const cached = hostnameCache.get(hostname);
  if (cached !== undefined) {
    return cached;
  }

  const normalized = hostname
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '');

  if (hostnameCache.size >= MAX_CACHE_SIZE) {
    hostnameCache.clear();
  }
  hostnameCache.set(hostname, normalized);

  return normalized;
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
  return {
    ...settings,
    enabled:
      settings.enabled !== false &&
      !isDomainDisabled(hostname, settings.disabledDomains),
  };
}
