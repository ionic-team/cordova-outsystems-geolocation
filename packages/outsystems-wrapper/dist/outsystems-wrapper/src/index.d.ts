import { ClearWatchOptions, PluginError, Position, CurrentPositionOptions, WatchPositionOptions } from '../../cordova-plugin/src/definitions';
declare class OSGeolocation {
    #private;
    constructor();
    getCurrentPosition(success: (position: Position) => void, error: (err: PluginError | GeolocationPositionError) => void, options: CurrentPositionOptions): void;
    watchPosition(success: (result: Position) => void, error: (error: PluginError | GeolocationPositionError) => void, options: WatchPositionOptions): string | number;
    /**
    * Clears the specified heading watch.
    */
    clearWatch(options: ClearWatchOptions, success?: () => void, error?: (error: PluginError | GeolocationPositionError) => void): void;
}
export declare const OSGeolocationInstance: OSGeolocation;
export type LocationButtonTextType = "precise-location" | "use-precise-location" | "share-precise-location" | "near-my-precise-location" | "near-your-precise-location" | "none";
export interface LocationButtonProperties {
    textType?: LocationButtonTextType;
    backgroundColor?: string;
    textColor?: string;
    iconColor?: string;
    borderColor?: string;
    cornerRadius?: number;
    borderWidth?: number;
}
export interface LocationButtonPosition {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}
export declare function mountLocationButton(containerId: string, properties: LocationButtonProperties, onGrant?: (granted: boolean) => void, onPosition?: (position: LocationButtonPosition) => void, onError?: (reason: string) => void): string;
export declare function updateLocationButton(handle: string, properties: LocationButtonProperties): void;
export declare function destroyLocationButton(handle: string): void;
export {};
