import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const transport = readFileSync(new URL('../src/location-button.ts', import.meta.url), 'utf8');

test('Cordova queues its event channel before location-button layout work', () => {
  const channel = transport.slice(transport.indexOf('on(eventName, envelope, listener)'));
  const boot = transport.slice(transport.indexOf('function boot(): void'));

  assert.match(channel, /eventChannelOpen = true;\s*exec\([\s\S]*SERVICE,\s*["']events["']/);
  assert.ok(boot.indexOf('initializeCordovaRuntime();') >= 0);
  assert.ok(
    boot.indexOf('requiresUnobscuredSurface().then(registerLocationButton)') >
      boot.indexOf('initializeCordovaRuntime();'),
  );
});
