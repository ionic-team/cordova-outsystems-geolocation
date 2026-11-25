import type { LocationButtonState } from './definitions';

interface CordovaWindow {
  cordova?: {
    exec?: (
      success: (value: unknown) => void,
      error: (value: unknown) => void,
      service: string,
      action: string,
      args: unknown[],
    ) => void;
    platformId?: string;
  };
}

export function getLocationButtonState(): Promise<LocationButtonState> {
  const cordova = typeof window === 'undefined' ? undefined : (window as CordovaWindow).cordova;
  const exec = cordova?.exec;
  if (cordova?.platformId !== 'android' || !exec) return Promise.resolve({ state: 'unavailable' });
  return new Promise((resolve) => {
    exec(
      (value) => {
        const state = (value as { state?: unknown } | undefined)?.state;
        resolve({ state: state === 'system' || state === 'compat' ? state : 'unavailable' });
      },
      // Native code without the method, such as an older binary, can't tell.
      () => resolve({ state: 'unavailable' }),
      'OSGeolocationIslands',
      'getLocationButtonState',
      [],
    );
  });
}
