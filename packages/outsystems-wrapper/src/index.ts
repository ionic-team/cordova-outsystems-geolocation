import { ClearWatchOptions, OSGLOCPosition, PluginError, Position, CurrentPositionOptions, WatchPositionOptions } from "../../cordova-plugin/src/definitions"
import { v4 as uuidv4 } from 'uuid'

class OSGeolocation {
    #lastPosition: Position | null = null
    #timers: { [key: string]: ReturnType<typeof setTimeout> | undefined } = {}
    #callbackIdsMap: { [watchId: string]: string } = {}

    getCurrentPosition(success: (position: Position) => void, error: (err: PluginError | GeolocationPositionError) => void, options: CurrentPositionOptions): void {
        if (this.#shouldUseWebApi()) {
            // if we're not in a native mobile app, we call the good old bridge or web api 
            // (it's the same clobber)
            navigator.geolocation.getCurrentPosition(success, error, options)
            return
        }

        let id = uuidv4()
        let timeoutID: ReturnType<typeof setTimeout> | undefined
        const successCallback = (position: Position | OSGLOCPosition) => {
            if (typeof (this.#timers[id]) == 'undefined') {
                // Timeout already happened, or native fired error callback for
                // this geo request.
                // Don't continue with success callback.
                return
            }

            if (this.#isLegacyPosition(position)) {
                position = this.#convertFromLegacy(position)
            }
            clearTimeout(timeoutID)

            this.#lastPosition = position
            success(position)
        }

        const errorCallback = (e: PluginError) => {
            if (typeof (this.#timers[id]) !== 'undefined') {
                clearTimeout(this.#timers[id])
            }
            error(e)
        }

        // Check our cached position, if its timestamp difference with current time is less than the maximumAge, then just
        // fire the success callback with the cached position.
        if (this.#lastPosition && options.maximumAge && (((new Date()).getTime() - this.#lastPosition.timestamp) <= options.maximumAge)) {
            success(this.#lastPosition)
            // If the cached position check failed and the timeout was set to 0, error out with a TIMEOUT error object.
        } else if (options.timeout === 0) {
            error({
                code: "OS-PLUG-GLOC-0017",
                message: "The Timeout value in CurrentPositionOptions is set to 0 and: (1) no cached Position object available, or (2) cached Position object's age exceeds provided CurrentPositionOptions' maximumAge parameter."
            })
            // Otherwise we have to call into native to retrieve a position.
        } else {
            if (options.timeout !== Infinity) {
                // If the timeout value was not set to Infinity (default), then
                // set up a timeout function that will fire the error callback
                // if no successful position was retrieved before timeout expired.
                timeoutID = this.#createTimeout(errorCallback, options.timeout, false, id)
                this.#timers[id] = timeoutID
            }

            if (this.#isSynapseDefined()) {
                // @ts-ignore
                CapacitorUtils.Synapse.Geolocation.getCurrentPosition(options, successCallback, errorCallback)
            } else {
                // currently Synapse doesn't work in MABS 12 builds with Capacitor npm package
                //  But it works with cordova via Github repository
                //  So we need to call the Capacitor plugin directly
                // @ts-ignore
                Capacitor.Plugins.Geolocation.getCurrentPosition(options)
                    .then(successCallback)
                    .catch(errorCallback);
            }
        }
    }

    watchPosition(success: (result: Position) => void, error: (error: PluginError | GeolocationPositionError) => void, options: WatchPositionOptions): string | number {
        if (this.#shouldUseWebApi()) {
            // if we're not in a native mobile app, we call the good old bridge or web api 
            // (it's the same clobber)
            return navigator.geolocation.watchPosition(success, error, options)
        }

        let watchId = uuidv4()
        let timeoutID: ReturnType<typeof setTimeout> | undefined
        const successCallback = (res: Position | OSGLOCPosition) => {
            if (typeof (this.#timers[watchId]) == 'undefined') {
                // Timeout already happened, or native fired error callback for
                // this geo request.
                // Don't continue with success callback.
                return
            }

            if (this.#isLegacyPosition(res)) {
                res = this.#convertFromLegacy(res)
            }
            clearTimeout(this.#timers[watchId])

            this.#lastPosition = res
            success(res)
        }
        const errorCallback = (e: PluginError) => {
            if (typeof (timeoutID) !== 'undefined') {
                clearTimeout(timeoutID)
            }
            error(e)
        }
        const watchAddedCallback = (callbackId: string) => {
            this.#callbackIdsMap[watchId] = callbackId;
        }

        if (options.timeout !== Infinity) {
            // If the timeout value was not set to Infinity (default), then
            // set up a timeout function that will fire the error callback
            // if no successful position was retrieved before timeout expired.
            timeoutID = this.#createTimeout(errorCallback, options.timeout, true, watchId)
            this.#timers[watchId] = timeoutID
        }
        options.id = watchId

        if (this.#isCapacitorPluginDefined()) {
            // For the case of watch location, capacitor returns a callback id that should be stored on the wrapper to make sure watches are cleared properly
            //  So in other words, Synapse can't be used in watchPosition for Capacitor.
            // @ts-ignore
            Capacitor.Plugins.Geolocation.watchPosition(
                options, 
                (position: Position | OSGLOCPosition, err?: any) => {
                    if (err) {
                        errorCallback(err);
                    }
                    else if (position) {
                        successCallback(position)
                    }
                }
            ).then(watchAddedCallback);
        } else {
            // @ts-ignore
            cordova.plugins.Geolocation.watchPosition(options, successCallback, errorCallback)
        }
        return watchId;
    }

    /**
    * Clears the specified heading watch.
    */
    clearWatch(options: ClearWatchOptions, success: () => void = () => { }, error: (error: PluginError | GeolocationPositionError) => void = () => { }): void {
        if (this.#shouldUseWebApi()) {
            // if we're not in a native mobile app, we call the good old bridge or web api 
            // @ts-ignore
            navigator.geolocation.clearWatch(options.id)
            success()
            return
        }

        clearTimeout(this.#timers[options.id])
        delete this.#timers[options.id]

        let optionsWithCorrectId = options;
        if (this.#callbackIdsMap[options.id]) {
            // Capacitor uses a different a callback id instead of the watch id generated here in the wrapper
            optionsWithCorrectId = { id: this.#callbackIdsMap[options.id] }
        }
        const successCallback = () => {
            delete this.#callbackIdsMap[options.id];
            success()
        }
        if (this.#isSynapseDefined()) {
            // @ts-ignore
            CapacitorUtils.Synapse.Geolocation.clearWatch(optionsWithCorrectId, successCallback, error)
        } else {
            // currently Synapse doesn't work in MABS 12 builds with Capacitor npm package
            //  But it works with cordova via Github repository
            //  So we need to call the Capacitor plugin directly
            // @ts-ignore
            Capacitor.Plugins.Geolocation.clearWatch(optionsWithCorrectId)
                .then(successCallback)
                .catch(error);
        }
    }


    /**
     * Returns a timeout failure, closed over a specified timeout value and error callback.
     * @param onError the error callback
     * @param timeout timeout in ms
     * @param isWatch returns `true` if the caller of this function was the from the watch flow
     * @param id the watch ID
     * @returns the timeout's ID
     */
    #createTimeout(onError: (error: PluginError) => void, timeout: number | undefined, isWatch: boolean, id: string): ReturnType<typeof setTimeout> {

        let t = setTimeout(() => {
            if (isWatch === true) {
                this.clearWatch({ id })
            }
            onError({
                code: "OS-PLUG-GLOC-0010",
                message: "Could not obtain location in time. Try with a higher timeout."
            })
        }, timeout)
        return t
    }

    /**
     * 
     * @param lPosition the position in its' legacy 
     * @returns new Position instance
     */
    #convertFromLegacy(lPosition: OSGLOCPosition): Position {
        return {
            coords: {
                latitude: lPosition.latitude,
                longitude: lPosition.longitude,
                altitude: lPosition.altitude,
                accuracy: lPosition.accuracy,
                heading: lPosition.heading,
                speed: lPosition.velocity,
                altitudeAccuracy: lPosition.altitudeAccuracy
            },
            timestamp: lPosition.timestamp,
        }
    }

    /**
     * In previous versions of the plugin, the native side would return speed as `velocity`
     * From now on, it returns the same value under `speed`
     * @param position the position to verify
     * @returns true if the object contains the `velocity` property
     */
    #isLegacyPosition(position: Position | OSGLOCPosition): position is OSGLOCPosition {
        return (position as OSGLOCPosition).velocity !== undefined
    }

    /**
     * @returns true if should use web API, false otherwise
     */
    #shouldUseWebApi(): boolean {
        // @ts-ignore
        if (this.#isSynapseDefined()) {
            // synapse is defined, which means the app is a native mobile app (PWAs don't need synapse)
            return false
        }
        // TODO once synapse dependency is correctly installed in MABS 12
        //  we can remove the if specific to capacitor here
        if (this.#isCapacitorPluginDefined()) {
            // @ts-ignore
            const platform = Capacitor.getPlatform() 
            return platform === "web"
        }
        return true
    }

    /**
     * Checks if @capacitor/geolocation plugin is defined
     * 
     * @returns true if geolocation capacitor plugin is available; false otherwise
     */
    #isCapacitorPluginDefined(): boolean {
        // @ts-ignore
        return (typeof(Capacitor) !== "undefined" && typeof(Capacitor.Plugins) !== "undefined" && typeof(Capacitor.Plugins.Geolocation) !== "undefined")
    }

    /**
     * @returns true if synapse is defined, false otherwise
     */
    #isSynapseDefined(): boolean {
        // @ts-ignore
        return typeof (CapacitorUtils) !== "undefined"
    }
}

export const OSGeolocationInstance = new OSGeolocation()