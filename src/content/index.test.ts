import { beforeEach, describe, expect, test } from 'bun:test';
import { DEFAULT_SETTINGS, type Settings } from '../shared/settings';
import { applySettings, getCurrentSettings } from './index';

describe('applySettings', () => {
  let dispatchedEvents: CustomEvent[] = [];
  let datasetMock: Record<string, string> = {};

  beforeEach(() => {
    dispatchedEvents = [];
    datasetMock = {};

    // Setup global window and document mock
    const mockWindow = {
      location: {
        hostname: 'example.com',
      },
      dispatchEvent: (event: CustomEvent) => {
        dispatchedEvents.push(event);
        return true;
      },
    };

    const mockDocument = {
      documentElement: {
        dataset: datasetMock,
      },
    };

    // @ts-ignore
    globalThis.window = mockWindow;
    // @ts-ignore
    globalThis.document = mockDocument;
    // Ensure CustomEvent is available
    if (typeof globalThis.CustomEvent === 'undefined') {
      // @ts-ignore
      globalThis.CustomEvent = class CustomEvent {
        type: string;
        detail: unknown;
        constructor(type: string, options?: { detail?: unknown }) {
          this.type = type;
          this.detail = options?.detail;
        }
      };
    }
  });

  test('updates document root dataset attributes based on settings', () => {
    const customSettings: Settings = {
      ...DEFAULT_SETTINGS,
      enabled: true,
      restoreRightClick: true,
      restoreSelection: false,
      antiShield: true,
      absoluteForce: false,
      bypassModifierKey: true,
    };

    applySettings(customSettings);

    expect(datasetMock.rcrEnabled).toBe('true');
    expect(datasetMock.rcrRightClick).toBe('true');
    expect(datasetMock.rcrSelection).toBe('false');
    expect(datasetMock.rcrAntiShield).toBe('true');
    expect(datasetMock.rcrForceMode).toBe('false');
    expect(datasetMock.rcrModifierBypass).toBe('true');
  });

  test('sets rcrEnabled to false when current hostname is in disabledDomains', () => {
    const disabledSettings: Settings = {
      ...DEFAULT_SETTINGS,
      enabled: true,
      disabledDomains: ['example.com'],
    };

    applySettings(disabledSettings);

    expect(datasetMock.rcrEnabled).toBe('false');
    expect(getCurrentSettings().enabled).toBe(false);
  });

  test('dispatches __rcr_update_config CustomEvent with current effective settings', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      restoreRightClick: false,
    };

    applySettings(settings);

    expect(dispatchedEvents.length).toBe(1);
    expect(dispatchedEvents[0].type).toBe('__rcr_update_config');
    expect(dispatchedEvents[0].detail).toEqual({
      ...settings,
      enabled: true,
    });
  });
});
