import { ClearWatchOptions, PluginError, Position, CurrentPositionOptions, WatchPositionOptions } from '../../cordova-plugin/src/definitions';
declare class OSGeolocation {
    #private;
    getCurrentPosition(success: (position: Position) => void, error: (err: PluginError | GeolocationPositionError) => void, options: CurrentPositionOptions): void;
    watchPosition(success: (result: Position) => void, error: (error: PluginError | GeolocationPositionError) => void, options: WatchPositionOptions): string | number;
    /**
    * Clears the specified heading watch.
    */
    clearWatch(options: ClearWatchOptions, success?: () => void, error?: (error: PluginError | GeolocationPositionError) => void): void;
}
export declare const OSGeolocationInstance: OSGeolocation;
export {};
