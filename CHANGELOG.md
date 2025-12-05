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
