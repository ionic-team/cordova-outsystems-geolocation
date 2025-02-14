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

--------------------

### Type Aliases


#### CurrentPositionOptions

<code>{  enableHighAccuracy?: boolean;  timeout?: number; maximumAge?: number; minimumUpdateInterval?: number; }
</code>

#### Position

<code>{ timestamp: number; coords: {
    latitude: number; 
    longitude: number; 
    accuracy: number; 
    altitudeAccuracy: number | null;
    altitude: number | null;
     speed: number | null;
     heading: number | null; }; }</code>


#### PluginError

<code>{ code: string, message: string }</code>


#### WatchPositionOptions

<code><a href="#currentpositionoptions">CurrentPositionOptions</a> & <a href="#clearwatchoptions">ClearWatchOptions</a></code>


#### ClearWatchOptions

<code>{ id: string; }</code>

</docgen-api>