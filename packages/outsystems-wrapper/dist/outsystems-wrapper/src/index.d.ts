import { ClearWatchOptions, PluginError, Position, CurrentPositionOptions, WatchPositionOptions } from '../../cordova-plugin/src/definitions';
declare class OSGeolocation {
    #private;
    constructor();
    getCurrentPosition(success: (position: Position) => void, error: (err: PluginError | GeolocationPositionError) => void, options: CurrentPositionOptions): void;
    watchPosition(success: (result: Position) => void, error: (error: PluginError | GeolocationPositionError) => void, options: WatchPositionOptions): string | number;
    /**
     * Tells whether the Location Button shows a button: AVAILABLE_SYSTEM on Android 17 and later,
     * AVAILABLE_COMPAT on older Android versions, and UNAVAILABLE on iOS, in a PWA, or when the
     * native code doesn't support the button.
     */
    getLocationButtonState(success: (state: LocationButtonStateValue) => void): void;
    /**
    * Clears the specified heading watch.
    */
    clearWatch(options: ClearWatchOptions, success?: () => void, error?: (error: PluginError | GeolocationPositionError) => void): void;
}
export declare const OSGeolocationInstance: OSGeolocation;
export type LocationButtonStateValue = "AVAILABLE_SYSTEM" | "AVAILABLE_COMPAT" | "UNAVAILABLE";
export type LocationButtonTextType = "precise-location" | "use-precise-location" | "share-precise-location" | "near-my-precise-location" | "near-your-precise-location" | "none";
export interface LocationButtonProperties {
    textType?: LocationButtonTextType;
    backgroundColor?: string;
    textColor?: string;
    iconColor?: string;
    borderColor?: string;
    cornerRadius?: number;
    borderWidth?: number;
    /** Maximum age (ms) of a cached position the button may reuse instead of fetching fresh. */
    maximumAge?: number;
    /** Timeout (ms) for the underlying location fetch. */
    timeout?: number;
    /** Whether to fall back to LocationManager if the primary provider fails. @default true */
    enableLocationFallback?: boolean;
}
export declare function mountLocationButton(containerId: string, properties: LocationButtonProperties, onGrant?: (granted: boolean) => void, onPosition?: (position: Position) => void, onError?: (reason: string, code?: string) => void): string;
export declare function updateLocationButton(handle: string, properties: LocationButtonProperties): void;
export declare function updateLocationButtonInContainer(containerId: string, properties: LocationButtonProperties): void;
export declare function destroyLocationButton(handle: string): void;
export declare function destroyLocationButtonInContainer(containerId: string): void;
export {};
