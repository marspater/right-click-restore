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

export function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.$/, '');
}

export function isDomainDisabled(
  hostname: string,
  disabledDomains: string[],
): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return false;

  return disabledDomains.some((domain) => {
    const disabled = normalizeHostname(domain);
    return disabled === host || host.endsWith(`.${disabled}`);
  });
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
