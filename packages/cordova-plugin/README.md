# GeolocationPlugin-Cordova

*This plugin is SUPPORTED by OutSystems. Customers entitled to Support Services may obtain assistance through Support.*

## Installation

```console
cordova plugin add <path-to-repo-local-clone>
```

## Location Button

The plugin registers `<os-location-button>` automatically and includes its Native
Islands runtime. The button is Android only: Android 17 and later show the system
location button, and older versions show Google's compatibility button. It uses
`androidx.core.locationbutton` 1.0.0-alpha01, an alpha AndroidX library.

```html
<os-location-button text-type="use-precise-location"></os-location-button>
```

The element emits `location-grant`, `location-position`, and `location-error` DOM
events.

Use [`getLocationButtonState()`](#getlocationbuttonstate) to decide what to show.
Where it returns `unavailable` (iOS, the browser, or native code without the
button), the element is hidden and renders nothing, so show your own control there:

```js
const { state } = await cordova.plugins.Geolocation.getLocationButtonState();
if (state === 'unavailable') {
  // Show your own control.
}
```

To grant precise location only through the button, set `LOCATION_PERMISSION_TYPE`
to `ONLY_FOR_LOCATION_BUTTON`. It keeps `ACCESS_COARSE_LOCATION` and declares
`ACCESS_FINE_LOCATION` with `android:usesPermissionFlags="onlyForLocationButton"`.
On Android 17 and later, the plugin's other methods then get approximate location
until the user taps the button and allows precise location. Older Android versions
ignore the flag.

```xml
<platform name="android">
  <preference name="LOCATION_PERMISSION_TYPE" value="ONLY_FOR_LOCATION_BUTTON" />
</platform>
```

Style the element with ordinary CSS. The icon can inherit `color` or use its
component-specific custom property:

```css
os-location-button {
  background-color: #0b57d0;
  color: #ffffff;
  --os-location-button-icon-color: #ffffff;
  border-color: #000000;
  border-width: 1px;
  border-radius: 16px;
  z-index: 2;
}
```

The native button supports opaque hexadecimal and RGB colors. Border width supports
`0px` through `3px`; the corner radius supports `0px` through `68px`. Android draws
no button smaller than 48 by 48 pixels or taller than 136 pixels, and the system
translates the label, so it can differ from the app's language.

## API

<docgen-index>

* [`getCurrentPosition(...)`](#getcurrentposition)
* [`watchPosition(...)`](#watchposition)
* [`clearWatch(...)`](#clearwatch)
* [`hasNativeTimeoutHandling(...)`](#hasnativetimeouthandling)
* [`getLocationButtonState()`](#getlocationbuttonstate)
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


### hasNativeTimeoutHandling(...)

```typescript
hasNativeTimeoutHandling(success: (value: boolean) => void, error: (error: PluginError) => void) => void
```

Returns true if the plugin version supports native timeout handling.

| Param         | Type                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| **`success`** | <code>(value: boolean) =&gt; void</code>                                |
| **`error`**   | <code>(error: <a href="#pluginerror">PluginError</a>) =&gt; void</code> |

**Since:** 1.2.0

--------------------


### getLocationButtonState()

```typescript
getLocationButtonState() => Promise<LocationButtonState>
```

Tells whether the `os-location-button` element shows a button on this device.

The button is Android only. Use this to show your own control where it is `unavailable`, or to
hide the `compat` button on older Android versions.

**Returns:** <code>Promise&lt;<a href="#locationbuttonstate">LocationButtonState</a>&gt;</code>

**Since:** 1.4.0

--------------------


### Interfaces


#### Position

| Prop         | Type                | Description |
| ------------ | ------------------- | ----------- |
| **`line`**   | <code>number</code> | &gt;= 1     |
| **`column`** | <code>number</code> | &gt;= 0     |


#### LocationButtonState

| Prop        | Type                                               | Description                                                                                                                                                                                                                                                                                             | Since |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **`state`** | <code>'system' \| 'compat' \| 'unavailable'</code> | `system` on Android 17 and later, where the system draws the button. `compat` on older Android versions, which show Google's compatibility button. `unavailable` on iOS and in the browser, or when the native code doesn't support the button, where the `os-location-button` element renders nothing. | 1.4.0 |


### Type Aliases


#### CurrentPositionOptions

<code>{ /** * High accuracy mode (such as GPS, if available) * * On Android 12+ devices it will be ignored if users didn't grant * ACCESS_FINE_LOCATION permissions (can be checked with location alias). * * @default false * @since 1.0.0 */ enableHighAccuracy?: boolean; /** * The maximum wait time in milliseconds for location updates. * * In Android, since version 4.0.0 of the plugin, timeout gets ignored for getCurrentPosition. * * @default 10000 * @since 1.0.0 */ timeout?: number; /** * The maximum age in milliseconds of a possible cached position that is acceptable to return * * @default 0 * @since 1.0.0 */ maximumAge?: number; /** * The minumum update interval for location updates. * * If location updates are available faster than this interval then an update * will only occur if the minimum update interval has expired since the last location update. * * This parameter is only available for Android. It has no effect on iOS or Web platforms. * * @default 5000 * @since 1.0.0 */ minimumUpdateInterval?: number; /** * This option applies to Android only. * * Whether to fall back to the Android framework's `LocationManager` in case Google Play Service's location settings checks fail. * This can happen for multiple reasons - e.g. device has no Play Services or device has no network connection (Airplane Mode) * If set to `false`, failures are propagated to the caller. * Note that `LocationManager` may not be as effective as Google Play Services implementation. * If the device's in airplane mode, only the GPS provider is used, which may take longer to return a location, depending on GPS signal. * This means that to receive location in such circumstances, you may need to provide a higher timeout. * * @default true * @since 1.1.0 */ enableLocationFallback?: boolean; }</code>


#### Position

<code>{ /** * Creation timestamp for coords * * @since 1.0.0 */ timestamp: number; /** * The GPS coordinates along with the accuracy of the data * * @since 1.0.0 */ coords: { /** * Latitude in decimal degrees * * @since 1.0.0 */ latitude: number; /** * longitude in decimal degrees * * @since 1.0.0 */ longitude: number; /** * Accuracy level of the latitude and longitude coordinates in meters * * @since 1.0.0 */ accuracy: number; /** * Accuracy level of the altitude coordinate in meters, if available. * * Available on all iOS versions and on Android 8.0+. * * @since 1.0.0 */ altitudeAccuracy: number | null; /** * The altitude the user is at (if available) * * @since 1.0.0 */ altitude: number | null; /** * The speed the user is traveling (if available) * * @since 1.0.0 */ speed: number | null; /** * The heading the user is facing (if available). * * Historically, this field returned the direction of travel (course) on iOS and Android. * It now prioritizes the compass heading (true or magnetic) if available, falling back * to the direction of travel (course). * * Only available when using `watchPosition`. * * @since 1.0.0 */ heading: number | null; /** * The heading (measured in degrees) relative to magnetic north. * * Only available when using `watchPosition`. * * @since 1.2.0 */ magneticHeading?: number | null; /** * The heading (measured in degrees) relative to true north. * * Only available when using `watchPosition`. * * @since 1.2.0 */ trueHeading?: number | null; /** * The maximum deviation (measured in degrees) between the reported heading and the true geomagnetic heading. * * Only available when using `watchPosition`. * * @since 1.2.0 */ headingAccuracy?: number | null; /** * The direction in which the device is travelling, measured in degrees and relative to due north. * * Only available when using `watchPosition`. * * @since 1.2.0 */ course?: number | null; }; }</code>


#### PluginError

<code>{ code: string; message: string; }</code>


#### WatchPositionOptions

<code><a href="#currentpositionoptions">CurrentPositionOptions</a> & <a href="#clearwatchoptions">ClearWatchOptions</a></code>


#### ClearWatchOptions

<code>{ id: string; }</code>

</docgen-api>
