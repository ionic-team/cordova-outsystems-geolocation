# GeolocationPlugin-Cordova

*This plugin is SUPPORTED by OutSystems. Customers entitled to Support Services may obtain assistance through Support.*

## Installation

```console
cordova plugin add <path-to-repo-local-clone>
```

## API

<docgen-index>

* [`getCurrentPosition(...)`](#getcurrentposition)
* [`watchPosition(...)`](#watchposition)
* [`clearWatch(...)`](#clearwatch)
* [Interfaces](#interfaces)
* [Type Aliases](#type-aliases)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### getCurrentPosition(...)

```typescript
getCurrentPosition(options: CurrentPositionOptions, success: (output: Position) => void, error: (error: PluginError) => void) => void
```

Get the current GPS location of the device

| Param         | Type                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| **`options`** | <code><a href="#currentpositionoptions">CurrentPositionOptions</a></code> |
| **`success`** | <code>(output: <a href="#position">Position</a>) =&gt; void</code>        |
| **`error`**   | <code>(error: <a href="#pluginerror">PluginError</a>) =&gt; void</code>   |

**Since:** 1.0.0

--------------------


### watchPosition(...)

```typescript
watchPosition(options: WatchPositionOptions, success: (output: Position) => void, error: (error: PluginError) => void) => void
```

Set up a watch for location changes. Note that watching for location changes
can consume a large amount of energy. Be smart about listening only when you need to.

| Param         | Type                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| **`options`** | <code><a href="#watchpositionoptions">WatchPositionOptions</a></code>   |
| **`success`** | <code>(output: <a href="#position">Position</a>) =&gt; void</code>      |
| **`error`**   | <code>(error: <a href="#pluginerror">PluginError</a>) =&gt; void</code> |

**Since:** 1.0.0

--------------------


### clearWatch(...)

```typescript
clearWatch(options: ClearWatchOptions, success: () => void, error: (error: PluginError) => void) => void
```

Clear a given watch

| Param         | Type                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| **`options`** | <code><a href="#clearwatchoptions">ClearWatchOptions</a></code>         |
| **`success`** | <code>() =&gt; void</code>                                              |
| **`error`**   | <code>(error: <a href="#pluginerror">PluginError</a>) =&gt; void</code> |

**Since:** 1.0.0

--------------------


### Interfaces


#### Position

| Prop         | Type                | Description |
| ------------ | ------------------- | ----------- |
| **`line`**   | <code>number</code> | &gt;= 1     |
| **`column`** | <code>number</code> | &gt;= 0     |


### Type Aliases


#### CurrentPositionOptions

<code>{ /** * High accuracy mode (such as GPS, if available) * * On Android 12+ devices it will be ignored if users didn't grant * ACCESS_FINE_LOCATION permissions (can be checked with location alias). * * @default false * @since 1.0.0 */ enableHighAccuracy?: boolean; /** * The maximum wait time in milliseconds for location updates. * * In Android, since version 4.0.0 of the plugin, timeout gets ignored for getCurrentPosition. * * @default 10000 * @since 1.0.0 */ timeout?: number; /** * The maximum age in milliseconds of a possible cached position that is acceptable to return * * @default 0 * @since 1.0.0 */ maximumAge?: number; /** * The minumum update interval for location updates. * * If location updates are available faster than this interval then an update * will only occur if the minimum update interval has expired since the last location update. * * This parameter is only available for Android. It has no effect on iOS or Web platforms. * * @default 5000 * @since 1.0.0 */ minimumUpdateInterval?: number; /** * This option applies to Android only. * * Whether to fall back to the Android framework's `LocationManager` in case Google Play Service's location settings checks fail. * This can happen for multiple reasons - e.g. device has no Play Services or device has no network connection (Airplane Mode) * If set to `false`, failures are propagated to the caller. * Note that `LocationManager` may not be as effective as Google Play Services implementation. * If the device's in airplane mode, only the GPS provider is used, which may take longer to return a location, depending on GPS signal. * This means that to receive location in such circumstances, you may need to provide a higher timeout. * * @default true * @since 1.1.0 */ enableLocationFallback?: boolean }</code>


#### Position

<code>{ /** * Creation timestamp for coords * * @since 1.0.0 */ timestamp: number; /** * The GPS coordinates along with the accuracy of the data * * @since 1.0.0 */ coords: { /** * Latitude in decimal degrees * * @since 1.0.0 */ latitude: number; /** * longitude in decimal degrees * * @since 1.0.0 */ longitude: number; /** * Accuracy level of the latitude and longitude coordinates in meters * * @since 1.0.0 */ accuracy: number; /** * Accuracy level of the altitude coordinate in meters, if available. * * Available on all iOS versions and on Android 8.0+. * * @since 1.0.0 */ altitudeAccuracy: number | null; /** * The altitude the user is at (if available) * * @since 1.0.0 */ altitude: number | null; /** * The speed the user is traveling (if available) * * @since 1.0.0 */ speed: number | null; /** * The heading the user is facing (if available) * * @since 1.0.0 */ heading: number | null; }; }</code>


#### PluginError

<code>{ code: string, message: string }</code>


#### WatchPositionOptions

<code><a href="#currentpositionoptions">CurrentPositionOptions</a> & <a href="#clearwatchoptions">ClearWatchOptions</a></code>


#### ClearWatchOptions

<code>{ id: string; }</code>

</docgen-api>