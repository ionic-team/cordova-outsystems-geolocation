# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
