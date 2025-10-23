# [2.0.0](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/compare/1.2.1...2.0.0) (2025-10-23)


### Features

* Use different name for timestamp ([99730fa](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/commit/99730fad5c85eb45955636b531ebb780ac9041fc))


### BREAKING CHANGES

* The timestamp property name was changed, changes required when updating to this version.

## [1.2.1](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/compare/1.2.0...1.2.1) (2025-10-23)


### Bug Fixes

* use npm ci ([ea349fd](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/commit/ea349fdded40219532ea1fbe2f97bcf609de6e31))

# [1.2.0](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/compare/1.1.2...1.2.0) (2025-10-23)


### Features

* Proper indentation on plugin.xml ([1e8bf4e](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/commit/1e8bf4e7e9e596164f3f207211555d6d9f8442d7))

## [1.1.2](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/compare/1.1.1...1.1.2) (2025-10-23)


### Bug Fixes

* detect identation in plugin.xml for release updates ([2656ad9](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/commit/2656ad9f5c1ee285e6217b87bd61cab3cb8ed685))

## [1.1.1](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/compare/1.1.0...1.1.1) (2025-10-23)


### Bug Fixes

* outsystems-wrapper build (again) ([32327d1](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/commit/32327d1f9deee6940fc7ecc42c985fc65c344cb2))
* update outsystems-wrapper ([d7e285e](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/commit/d7e285e7f758875892742fd01fb1a567d9b2ebb7))
* use cjs instead of js for release config ([82a1c4a](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/commit/82a1c4a6cc6c526cc675eb0120aee4b39240abc4))


### Reverts

* debug, mac-os and npm ci ([80d9a3c](https://github.com/OS-pedrogustavobilro/cordova-outsystems-geolocation/commit/80d9a3c2a9b290b08bfa9e7fe89777e1d2dffff6))


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
