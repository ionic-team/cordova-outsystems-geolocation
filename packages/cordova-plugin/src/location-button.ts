import {
  defineNativeIsland,
  initializeNativeIslands,
  NATIVE_ISLANDS_TRANSPORT_PRIORITY,
  type NativeIslandsEnvelope,
  type NativeIslandsEvent,
  type NativeIslandsTransport,
} from '@capacitor/native-islands/internal/runtime';

import type { OSGLOCPosition, PluginError, Position } from './definitions';

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

type LocationButtonPlatform = 'android' | 'ios' | 'web';

const SERVICE = 'OSGeolocationIslands';
const eventListeners = new Map<string, Set<(event: NativeIslandsEvent) => void>>();
let eventChannelOpen = false;
let runtimeInitialized = false;

function cordovaWindow(): CordovaWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as CordovaWindow);
}

function platform(): LocationButtonPlatform {
  const id = cordovaWindow()?.cordova?.platformId?.toLowerCase();
  if (id === 'android' || id === 'ios') return id;
  return 'web';
}

function bridgeError(value: unknown): Error & { code?: string } {
  if (value instanceof Error) return value;
  const payload =
    typeof value === 'object' && value !== null
      ? (value as { code?: unknown; message?: unknown })
      : undefined;
  const error = new Error(
    typeof payload?.message === 'string'
      ? payload.message
      : typeof value === 'string'
        ? value
        : 'Native component command failed.',
  ) as Error & { code?: string };
  if (typeof payload?.code === 'string') error.code = payload.code;
  return error;
}

function call(
  action: 'applyLayout' | 'applyScrollOffsets' | 'command' | 'reset',
  payload: NativeIslandsEnvelope,
): Promise<void> {
  const exec = cordovaWindow()?.cordova?.exec;
  if (!exec) {
    return Promise.reject(
      Object.assign(new Error('Cordova is not available.'), {
        code: 'unavailable',
      }),
    );
  }

  return new Promise((resolve, reject) => {
    exec(
      () => resolve(),
      (error) => reject(bridgeError(error)),
      SERVICE,
      action,
      [payload],
    );
  });
}

function createCordovaTransport(): NativeIslandsTransport {
  const exec = cordovaWindow()?.cordova?.exec;
  return {
    available: Boolean(exec),
    innerScrollMode:
      platform() === 'ios' ? 'native' : platform() === 'android' ? 'presentation' : 'unsupported',

    applyLayout(payload) {
      return call('applyLayout', payload);
    },

    applyScrollOffsets(payload) {
      return call('applyScrollOffsets', payload);
    },

    async command(request) {
      await call('command', request);
    },

    reset(envelope) {
      void call('reset', envelope).catch(() => undefined);
    },

    on(eventName, envelope, listener) {
      const listeners = eventListeners.get(eventName) ?? new Set();
      listeners.add(listener);
      eventListeners.set(eventName, listeners);

      if (!eventChannelOpen && exec) {
        eventChannelOpen = true;
        exec(
          (value) => {
            const message = value as
              | { event?: string; data?: NativeIslandsEvent }
              | undefined;
            if (!message?.event || !message.data) return;
            for (const handler of eventListeners.get(message.event) ?? []) {
              handler(message.data);
            }
          },
          () => {
            eventChannelOpen = false;
          },
          SERVICE,
          'events',
          [envelope],
        );
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) eventListeners.delete(eventName);
      };
    },
  };
}

function requiresUnobscuredSurface(): Promise<boolean> {
  const exec = cordovaWindow()?.cordova?.exec;
  if (!exec) return Promise.resolve(true);
  return new Promise((resolve) => {
    exec(
      (value) => {
        const capabilities = value as { requiresUnobscuredSurface?: unknown } | undefined;
        resolve(capabilities?.requiresUnobscuredSurface !== false);
      },
      () => resolve(true),
      SERVICE,
      'capabilities',
      [],
    );
  });
}

function initializeCordovaRuntime(): void {
  if (runtimeInitialized || platform() !== 'android') return;
  const transport = createCordovaTransport();
  if (!transport.available) return;
  runtimeInitialized = true;
  initializeNativeIslands(transport, {
    identity: 'com.outsystems.plugins.geolocation/location-button',
    priority: NATIVE_ISLANDS_TRANSPORT_PRIORITY.carrier,
  });
}

export interface LocationButtonGrantDetail {
  granted: boolean;
}

export interface LocationButtonPositionDetail {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface LocationButtonErrorDetail {
  reason: string;
}

declare global {
  interface HTMLElementEventMap {
    'location-grant': CustomEvent<LocationButtonGrantDetail>;
    'location-position': CustomEvent<LocationButtonPositionDetail>;
    'location-error': CustomEvent<LocationButtonErrorDetail>;
  }
}

const TEXT_LABELS: Record<string, string> = {
  'use-precise-location': 'Use precise location',
  'share-precise-location': 'Share precise location',
  'near-my-precise-location': 'Near my precise location',
  'near-your-precise-location': 'Near your precise location',
  'precise-location': 'Precise location',
  none: 'Share location',
};

const STYLE_PROPERTIES = {
  backgroundColor: 'background-color',
  textColor: 'color',
  iconTint: '--os-location-button-icon-color',
  strokeColor: 'border-top-color',
  strokeWidth: 'border-top-width',
  pressedCornerRadius: '--os-location-button-pressed-corner-radius',
  clickablePadding: '--os-location-button-clickable-padding',
} as const;
const OBSERVED_ATTRIBUTES = ['text-type'];
const OBSERVED_STYLES = [
  STYLE_PROPERTIES.backgroundColor,
  STYLE_PROPERTIES.textColor,
  STYLE_PROPERTIES.iconTint,
  STYLE_PROPERTIES.strokeColor,
  STYLE_PROPERTIES.strokeWidth,
  STYLE_PROPERTIES.pressedCornerRadius,
  STYLE_PROPERTIES.clickablePadding,
  'border-top-left-radius',
];

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const RGB_COLOR = /^rgba?\((.+)\)$/;

function textType(element: HTMLElement): string {
  const value = element.getAttribute('text-type') ?? 'precise-location';
  return value in TEXT_LABELS ? value : 'precise-location';
}

function colorStyle(style: CSSStyleDeclaration, name: string, fallback: string): string {
  const value = style.getPropertyValue(name).trim();
  if (HEX_COLOR.test(value)) return value.toUpperCase();
  const match = value.match(RGB_COLOR);
  if (!match) return fallback;
  const channels = match[1].match(/\d+(?:\.\d+)?/g)?.map(Number);
  if (!channels || channels.length < 3 || channels.slice(0, 3).some((channel) => channel < 0 || channel > 255)) {
    return fallback;
  }
  if (channels.length > 3 && channels[3] < 1) return fallback;
  return `#${channels
    .slice(0, 3)
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function pixelStyle(
  style: CSSStyleDeclaration,
  name: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const value = style.getPropertyValue(name).trim();
  if (!value.endsWith('px')) return fallback;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : fallback;
}

function clampedPixelStyle(
  style: CSSStyleDeclaration,
  name: string,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const value = style.getPropertyValue(name).trim();
  if (!value.endsWith('px')) return fallback;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function dispatch<T>(element: HTMLElement, type: string, detail: T): void {
  element.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

function dispatchPosition(element: HTMLElement, position: Position): void {
  dispatch<LocationButtonPositionDetail>(element, 'location-position', {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  });
}

function requestNativeFallback(element: HTMLElement): void {
  const exec = cordovaWindow()?.cordova?.exec;
  if (!exec) {
    dispatch<LocationButtonErrorDetail>(element, 'location-error', {
      reason: 'Cordova is not available',
    });
    return;
  }
  exec(
    (value) => {
      const position = value as OSGLOCPosition;
      dispatch<LocationButtonGrantDetail>(element, 'location-grant', {
        granted: true,
      });
      dispatch<LocationButtonPositionDetail>(element, 'location-position', {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        timestamp: position.timestamp,
      });
    },
    (value) => {
      const error = value as PluginError | undefined;
      if (error?.code === 'OS-PLUG-GLOC-0003' || error?.code === 'OS-PLUG-GLOC-0008') {
        dispatch<LocationButtonGrantDetail>(element, 'location-grant', {
          granted: false,
        });
      }
      dispatch<LocationButtonErrorDetail>(element, 'location-error', {
        reason: error?.message || 'Location request failed',
      });
    },
    'OSGeolocation',
    'getCurrentPosition',
    [{ enableHighAccuracy: true }],
  );
}

function renderFallback(element: HTMLElement): void {
  element.dataset.osLocationButtonFallbackFace = '';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'os-location-button-fallback';
  const normalizedTextType = textType(element);
  const label = TEXT_LABELS[normalizedTextType];
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.classList.add('os-location-button-fallback__icon');
  icon.setAttribute('viewBox', '0 0 960 960');
  icon.setAttribute('aria-hidden', 'true');
  const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  iconPath.setAttribute(
    'd',
    'M440 918v-80q-125-14-214.5-103.5T122 520H42v-80h80q14-125 103.5-214.5T440 122V42h80v80q125 14 214.5 103.5T838 440h80v80h-80q-14 125-103.5 214.5T520 838v80h-80Zm40-158q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560 480q0-33-23.5-56.5T480 400q-33 0-56.5 23.5T400 480q0 33 23.5 56.5T480 560Z',
  );
  icon.append(iconPath);
  const text = document.createElement('span');
  text.className = normalizedTextType === 'none' ? 'os-location-button-fallback__visually-hidden' : '';
  text.textContent = label;
  button.append(icon, text);
  button.setAttribute('aria-label', label);
  button.addEventListener('click', () => {
    const currentPlatform = platform();
    if (currentPlatform !== 'web') {
      requestNativeFallback(element);
      return;
    }
    if (!navigator.geolocation) {
      dispatch<LocationButtonErrorDetail>(element, 'location-error', {
        reason: 'Browser geolocation is unavailable',
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        dispatch<LocationButtonGrantDetail>(element, 'location-grant', {
          granted: true,
        });
        dispatchPosition(element, position);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          dispatch<LocationButtonGrantDetail>(element, 'location-grant', {
            granted: false,
          });
        }
        dispatch<LocationButtonErrorDetail>(element, 'location-error', {
          reason: error.message || 'Browser location request failed',
        });
      },
      { enableHighAccuracy: true },
    );
  });
  element.replaceChildren(button);
}

function installFallbackStyles(): void {
  if (document.querySelector('style[data-os-location-button]')) return;

  const style = document.createElement('style');
  style.dataset.osLocationButton = '';
  style.textContent = `
    :where(os-location-button) {
      display: inline-block;
      inline-size: min(100%, 22rem);
      min-inline-size: 3rem;
      block-size: 3.25rem;
      min-block-size: 3rem;
      max-block-size: 136px;
      box-sizing: border-box;
      overflow: hidden;
      border: 0 solid #000000;
      border-radius: 22px;
      background-color: #0b57d0;
      color: #ffffff;
    }

    :where([data-os-location-button-fallback-face]) {
      background-clip: text !important;
      border-image-source: linear-gradient(transparent, transparent) !important;
      border-image-slice: 1 !important;
    }

    .os-location-button-fallback {
      position: relative;
      isolation: isolate;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      inline-size: 100%;
      block-size: 100%;
      min-inline-size: 3rem;
      min-block-size: 3rem;
      padding-inline: calc(1rem + clamp(4px, var(--os-location-button-clickable-padding, 6px), 8px));
      border: inherit;
      border-image-source: linear-gradient(transparent, transparent);
      border-image-slice: 1;
      border-radius: inherit;
      background-color: inherit;
      background-clip: text;
      color: inherit;
      font: 500 0.875rem/1.25rem Roboto, system-ui, sans-serif;
      letter-spacing: 0.007142857em;
    }

    .os-location-button-fallback::before {
      content: '';
      position: absolute;
      inset: clamp(4px, var(--os-location-button-clickable-padding, 6px), 8px);
      z-index: 0;
      box-sizing: border-box;
      border-width: inherit;
      border-style: inherit;
      border-color: inherit;
      border-radius: inherit;
      background-color: inherit;
    }

    .os-location-button-fallback:active::before {
      border-radius: clamp(0px, var(--os-location-button-pressed-corner-radius, 12px), 68px);
    }

    .os-location-button-fallback > * {
      position: relative;
      z-index: 1;
    }

    .os-location-button-fallback__icon {
      color: var(--os-location-button-icon-color, currentColor);
      inline-size: 1.25rem;
      block-size: 1.25rem;
      flex: 0 0 auto;
      fill: currentColor;
    }

    .os-location-button-fallback__visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
  `;
  document.head.append(style);
}

function registerLocationButton(protectedSurface: boolean): void {
  if (
    typeof document === 'undefined' ||
    typeof HTMLElement === 'undefined' ||
    typeof customElements === 'undefined' ||
    customElements.get('os-location-button')
  ) {
    return;
  }

  installFallbackStyles();

  if (platform() === 'ios') {
    class OsLocationButtonFallback extends HTMLElement {
      private connected = false;

      static get observedAttributes(): string[] {
        return OBSERVED_ATTRIBUTES;
      }

      connectedCallback(): void {
        if (this.connected) return;
        this.connected = true;
        renderFallback(this);
      }

      attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
        if (this.connected && oldValue !== newValue) renderFallback(this);
      }
    }

    customElements.define('os-location-button', OsLocationButtonFallback);
    return;
  }

  defineNativeIsland({
    tagName: 'os-location-button',
    nativeComponent: 'os.locationButton',
    isInteractive: true,
    accessibility: 'native',
    requiresUnobscuredSurface: protectedSurface,
    observedAttributes: OBSERVED_ATTRIBUTES,
    observedStyles: OBSERVED_STYLES,
    getProperties: (element) => {
      const style = getComputedStyle(element);
      const cornerRadius = pixelStyle(style, 'border-top-left-radius', 0, 68, 22);
      const textColor = colorStyle(style, STYLE_PROPERTIES.textColor, '#FFFFFF');
      return {
        textType: textType(element),
        backgroundColor: colorStyle(style, STYLE_PROPERTIES.backgroundColor, '#0B57D0'),
        textColor,
        iconTint: colorStyle(style, STYLE_PROPERTIES.iconTint, textColor),
        strokeColor: colorStyle(style, STYLE_PROPERTIES.strokeColor, '#000000'),
        cornerRadius,
        pressedCornerRadius: pixelStyle(style, STYLE_PROPERTIES.pressedCornerRadius, 0, 68, 12),
        strokeWidth: pixelStyle(style, STYLE_PROPERTIES.strokeWidth, 0, 3, 0),
        clickablePadding: clampedPixelStyle(style, STYLE_PROPERTIES.clickablePadding, 4, 8, 6),
      };
    },
    renderFallback,
    events: {
      grant: 'location-grant',
      position: 'location-position',
      buttonError: 'location-error',
    },
  });
}

function boot(): void {
  initializeCordovaRuntime();
  if (platform() === 'android') {
    installFallbackStyles();
    void requiresUnobscuredSurface().then(registerLocationButton);
    return;
  }
  registerLocationButton(false);
}

if (cordovaWindow()?.cordova && !cordovaWindow()?.cordova?.platformId) {
  document.addEventListener('deviceready', boot, { once: true });
} else {
  boot();
}
