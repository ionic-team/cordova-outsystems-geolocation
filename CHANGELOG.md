## [1.3.2](https://github.com/ionic-team/cordova-outsystems-geolocation/compare/1.3.1...1.3.2) (2026-08-05)


### Bug Fixes

* stop losing location results when calls overlap ([#26](https://github.com/ionic-team/cordova-outsystems-geolocation/issues/26)) ([5fc1a60](https://github.com/ionic-team/cordova-outsystems-geolocation/commit/5fc1a60090f9ade5a2c1acfaa94c450494ae3ce2))

## [1.3.1](https://github.com/ionic-team/cordova-outsystems-geolocation/compare/1.3.0...1.3.1) (2026-08-05)


### Bug Fixes

* **ios:** Correct error when location services are off ([#27](https://github.com/ionic-team/cordova-outsystems-geolocation/issues/27)) ([f603879](https://github.com/ionic-team/cordova-outsystems-geolocation/commit/f603879c98334e6cd587fff85bc6ee6b8fc73af1))

## [1.3.0](https://github.com/ionic-team/cordova-outsystems-geolocation/compare/1.2.0...1.3.0) (2026-07-14)


### Bug Fixes

* **android:** Return error when user rejects request to turn on location with `enableLocationManagerFallback=true` ([#24](https://github.com/ionic-team/cordova-outsystems-geolocation/issues/24)) ([9544119](https://github.com/ionic-team/cordova-outsystems-geolocation/commit/95441198ec507b6783bc4077d894bc13a28c0ae2))
* **android:** Remove kapt and custom maven repo ([#25](https://github.com/ionic-team/cordova-outsystems-geolocation/issues/25)) ([87c6d64](https://github.com/ionic-team/cordova-outsystems-geolocation/commit/61da66f5c127c53614c0a2949df7dc17e11b77b6))


### Features

* **android:** Allow removal of location permissions from manifest ([#23](https://github.com/ionic-team/cordova-outsystems-geolocation/issues/23)) ([435758c](https://github.com/ionic-team/cordova-outsystems-geolocation/commit/435758cee6edc8064a6a997b4e718bf14583ecf2))

## [Unreleased]

- Add `<os-location-button>` with an Android native implementation and browser
  fallback without changing the existing Geolocation actions.
- Include Native Islands within Geolocation so applications do not install it
  separately.
- Add Location Button lifecycle helpers to the OutSystems wrapper.

## [1.2.0]

## 2026-03-10

- feature: Added support for accurate heading information across iOS and Android (available for `watchPosition` only).
- feature: The `heading` property now prioritizes actual compass bearing (true/magnetic heading) when available during active watches, falling back to direction of travel (course).
- feature: Added `magneticHeading`, `trueHeading`, `headingAccuracy`, and `course` to the coordinates object.
- chore(ios): Update native library IONGeolocationLib to version 2.1.1.
- chore(android): Update native library ion-android-geolocation to version 2.2.0.

## [1.1.2]

## 2026-01-13

- chore(android): remove unused dependencies to `oscore` and `oscordova` libs.

## [1.1.1]

## 2025-11-21

- fix(android): Native timeout in `watchPosition`

## 2025-10-20

- Chore(iOS): update native library IONGeolocationLib to version 2.0.0
- Fix(iOS): This version introduces native timeout handling for location requests, replacing the previous `outsystems-wrapper` timeout.

## [1.1.0]

## 2025-10-03

- Feature(android): Location fallback in case of Play Services failure or airplane mode.

## [1.0.3]

### 2025-08-11
- Fix(ios): fixes an issue where the plugin stops receiving location updates after calling the clearWatch method.
- Chore(iOS): update native library IONGeolocationLib to version 1.0.1

## [1.0.2]

### 2025-07-08
- Fix(ios): Location watch callbacks recovery after backgrounding.

### 2025-07-01

- Fix: getting watch id for Capacitor in OutSystems Wrapper.

### 2025-04-17

- Fix: Properly check if synapse is defined.

## [1.0.1]

### 2025-02-14

- Fix: plugin declaration in `plugin.xml`.
- Chore: Update Synapse dependency.

## [1.0.0]

### 2025-01-10
- Feat: Add implementation for `getCurrentPosition`, `watchPosition`, and `clearWatch` on both Android and iOS.
