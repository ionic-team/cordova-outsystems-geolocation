(function(global, factory) {
  typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.OSGeolocationWrapper = {}));
})(this, function(exports2) {
  "use strict";var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

  var _lastPosition, _timers, _callbackIdsMap, _latestOrientation, _OSGeolocation_instances, updateOrientation_fn, augmentPosition_fn, createTimeout_fn, convertFromLegacy_fn, isLegacyPosition_fn, shouldUseWebApi_fn, isCapacitorPluginDefined_fn, isCordovaPluginDefined_fn, hasNativeTimeoutHandling_fn;
  const byteToHex = [];
  for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 256).toString(16).slice(1));
  }
  function unsafeStringify(arr, offset = 0) {
    return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
  }
  let getRandomValues;
  const rnds8 = new Uint8Array(16);
  function rng() {
    if (!getRandomValues) {
      if (typeof crypto === "undefined" || !crypto.getRandomValues) {
        throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
      }
      getRandomValues = crypto.getRandomValues.bind(crypto);
    }
    return getRandomValues(rnds8);
  }
  const randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
  const native = { randomUUID };
  function v4(options, buf, offset) {
    if (native.randomUUID && true && !options) {
      return native.randomUUID();
    }
    options = options || {};
    const rnds = options.random ?? options.rng?.() ?? rng();
    if (rnds.length < 16) {
      throw new Error("Random bytes length must be >= 16");
    }
    rnds[6] = rnds[6] & 15 | 64;
    rnds[8] = rnds[8] & 63 | 128;
    return unsafeStringify(rnds);
  }
  class OSGeolocation {
    constructor() {
      __privateAdd(this, _OSGeolocation_instances);
      __privateAdd(this, _lastPosition, null);
      __privateAdd(this, _timers, {});
      __privateAdd(this, _callbackIdsMap, {});
      __privateAdd(this, _latestOrientation, null);
      if (typeof window !== "undefined") {
        const win = window;
        if ("ondeviceorientationabsolute" in win) {
          win.addEventListener("deviceorientationabsolute", (event) => __privateMethod(this, _OSGeolocation_instances, updateOrientation_fn).call(this, event, true), true);
        } else if ("ondeviceorientation" in win) {
          win.addEventListener("deviceorientation", (event) => __privateMethod(this, _OSGeolocation_instances, updateOrientation_fn).call(this, event, false), true);
        }
      }
    }
    getCurrentPosition(success, error, options) {
      if (__privateMethod(this, _OSGeolocation_instances, shouldUseWebApi_fn).call(this)) {
        navigator.geolocation.getCurrentPosition(
          (pos) => success(__privateMethod(this, _OSGeolocation_instances, augmentPosition_fn).call(this, pos, false)),
          error,
          options
        );
        return;
      }
      let id = v4();
      let timeoutID;
      let hasNative = false;
      const successCallback = (position) => {
        if (!hasNative && typeof __privateGet(this, _timers)[id] == "undefined") {
          return;
        }
        if (__privateMethod(this, _OSGeolocation_instances, isLegacyPosition_fn).call(this, position)) {
          position = __privateMethod(this, _OSGeolocation_instances, convertFromLegacy_fn).call(this, position);
        }
        clearTimeout(timeoutID);
        __privateSet(this, _lastPosition, position);
        success(position);
      };
      const errorCallback = (e) => {
        if (typeof __privateGet(this, _timers)[id] !== "undefined") {
          clearTimeout(__privateGet(this, _timers)[id]);
        }
        error(e);
      };
      if (__privateGet(this, _lastPosition) && options.maximumAge && (/* @__PURE__ */ new Date()).getTime() - __privateGet(this, _lastPosition).timestamp <= options.maximumAge) {
        success(__privateGet(this, _lastPosition));
      } else if (options.timeout === 0) {
        error({
          code: "OS-PLUG-GLOC-0017",
          message: "The Timeout value in CurrentPositionOptions is set to 0 and: (1) no cached Position object available, or (2) cached Position object's age exceeds provided CurrentPositionOptions' maximumAge parameter."
        });
      } else {
        __privateMethod(this, _OSGeolocation_instances, hasNativeTimeoutHandling_fn).call(this, (nativeTimeout) => {
          hasNative = nativeTimeout;
          if (!hasNative && options.timeout !== Infinity) {
            timeoutID = __privateMethod(this, _OSGeolocation_instances, createTimeout_fn).call(this, errorCallback, options.timeout, false, id);
            __privateGet(this, _timers)[id] = timeoutID;
          }
          if (__privateMethod(this, _OSGeolocation_instances, isCapacitorPluginDefined_fn).call(this)) {
            window.CapacitorPlugins.Geolocation.getCurrentPosition(options).then(successCallback).catch(errorCallback);
          } else {
            cordova.plugins.Geolocation.getCurrentPosition(options, successCallback, errorCallback);
          }
        });
      }
    }
    watchPosition(success, error, options) {
      if (__privateMethod(this, _OSGeolocation_instances, shouldUseWebApi_fn).call(this)) {
        return navigator.geolocation.watchPosition(
          (pos) => success(__privateMethod(this, _OSGeolocation_instances, augmentPosition_fn).call(this, pos, true)),
          error,
          options
        );
      }
      let watchId = v4();
      let timeoutID;
      let hasNative = false;
      const successCallback = (res) => {
        if (!hasNative && typeof __privateGet(this, _timers)[watchId] == "undefined") {
          return;
        }
        if (__privateMethod(this, _OSGeolocation_instances, isLegacyPosition_fn).call(this, res)) {
          res = __privateMethod(this, _OSGeolocation_instances, convertFromLegacy_fn).call(this, res);
        }
        clearTimeout(__privateGet(this, _timers)[watchId]);
        __privateSet(this, _lastPosition, res);
        success(res);
      };
      const errorCallback = (e) => {
        if (typeof timeoutID !== "undefined") {
          clearTimeout(timeoutID);
        }
        error(e);
      };
      const watchAddedCallback = (callbackId) => {
        __privateGet(this, _callbackIdsMap)[watchId] = callbackId;
      };
      __privateMethod(this, _OSGeolocation_instances, hasNativeTimeoutHandling_fn).call(this, (nativeTimeout) => {
        hasNative = nativeTimeout;
        if (!hasNative && options.timeout !== Infinity) {
          timeoutID = __privateMethod(this, _OSGeolocation_instances, createTimeout_fn).call(this, errorCallback, options.timeout, true, watchId);
          __privateGet(this, _timers)[watchId] = timeoutID;
        }
        options.id = watchId;
        if (__privateMethod(this, _OSGeolocation_instances, isCapacitorPluginDefined_fn).call(this)) {
          window.CapacitorPlugins.Geolocation.watchPosition(options, (position, err) => {
            if (err) {
              errorCallback(err);
            } else if (position) {
              successCallback(position);
            }
          }).then(watchAddedCallback);
        } else {
          cordova.plugins.Geolocation.watchPosition(options, successCallback, errorCallback);
        }
      });
      return watchId;
    }
    /**
    * Clears the specified heading watch.
    */
    clearWatch(options, success = () => {
    }, error = () => {
    }) {
      if (__privateMethod(this, _OSGeolocation_instances, shouldUseWebApi_fn).call(this)) {
        navigator.geolocation.clearWatch(options.id);
        success();
        return;
      }
      clearTimeout(__privateGet(this, _timers)[options.id]);
      delete __privateGet(this, _timers)[options.id];
      let optionsWithCorrectId = options;
      if (__privateGet(this, _callbackIdsMap)[options.id]) {
        optionsWithCorrectId = { id: __privateGet(this, _callbackIdsMap)[options.id] };
      }
      const successCallback = () => {
        delete __privateGet(this, _callbackIdsMap)[options.id];
        success();
      };
      if (__privateMethod(this, _OSGeolocation_instances, isCapacitorPluginDefined_fn).call(this)) {
        window.CapacitorPlugins.Geolocation.clearWatch(optionsWithCorrectId).then(successCallback).catch(error);
      } else {
        cordova.plugins.Geolocation.clearWatch(optionsWithCorrectId, successCallback, error);
      }
    }
  }
  _lastPosition = new WeakMap();
  _timers = new WeakMap();
  _callbackIdsMap = new WeakMap();
  _latestOrientation = new WeakMap();
  _OSGeolocation_instances = new WeakSet();
  updateOrientation_fn = function(event, isAbsolute) {
    let trueHeading = null;
    let magneticHeading = null;
    let headingAccuracy = null;
    if (isAbsolute && event.alpha !== null) {
      trueHeading = (360 - event.alpha) % 360;
    } else if (event.webkitCompassHeading !== void 0 && event.webkitCompassHeading !== null) {
      magneticHeading = event.webkitCompassHeading;
      headingAccuracy = event.webkitCompassAccuracy;
    } else if (event.alpha !== null && event.absolute === true) {
      trueHeading = (360 - event.alpha) % 360;
    } else if (event.alpha !== null) {
      magneticHeading = (360 - event.alpha) % 360;
    }
    if (trueHeading !== null || magneticHeading !== null) {
      __privateSet(this, _latestOrientation, {
        trueHeading,
        magneticHeading,
        headingAccuracy
      });
    }
  };
  augmentPosition_fn = function(pos, isWatch = false) {
    const coords = pos.coords;
    const orientation = isWatch ? __privateGet(this, _latestOrientation) : null;
    const heading = orientation?.trueHeading ?? orientation?.magneticHeading ?? (isWatch ? coords.heading : null) ?? null;
    return {
      timestamp: pos.timestamp,
      coords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        altitude: coords.altitude,
        altitudeAccuracy: coords.altitudeAccuracy,
        speed: coords.speed,
        heading,
        magneticHeading: orientation?.magneticHeading ?? null,
        trueHeading: orientation?.trueHeading ?? null,
        headingAccuracy: orientation?.headingAccuracy ?? null,
        course: (isWatch ? coords.heading : null) ?? null
      }
    };
  };
  /**
   * Returns a timeout failure, closed over a specified timeout value and error callback.
   * @param onError the error callback
   * @param timeout timeout in ms
   * @param isWatch returns `true` if the caller of this function was the from the watch flow
   * @param id the watch ID
   * @returns the timeout's ID
   */
  createTimeout_fn = function(onError, timeout, isWatch, id) {
    let t = setTimeout(() => {
      if (isWatch === true) {
        this.clearWatch({ id });
      }
      onError({
        code: "OS-PLUG-GLOC-0010",
        message: "Could not obtain location in time. Try with a higher timeout."
      });
    }, timeout);
    return t;
  };
  /**
   * 
   * @param lPosition the position in its' legacy 
   * @returns new Position instance
   */
  convertFromLegacy_fn = function(lPosition) {
    return {
      coords: {
        latitude: lPosition.latitude,
        longitude: lPosition.longitude,
        altitude: lPosition.altitude,
        accuracy: lPosition.accuracy,
        heading: lPosition.heading,
        speed: lPosition.velocity,
        altitudeAccuracy: lPosition.altitudeAccuracy,
        magneticHeading: lPosition.magneticHeading,
        trueHeading: lPosition.trueHeading,
        headingAccuracy: lPosition.headingAccuracy,
        course: lPosition.course
      },
      timestamp: lPosition.timestamp
    };
  };
  /**
   * In previous versions of the plugin, the native side would return speed as `velocity`
   * From now on, it returns the same value under `speed`
   * @param position the position to verify
   * @returns true if the object contains the `velocity` property
   */
  isLegacyPosition_fn = function(position) {
    return position.velocity !== void 0;
  };
  /**
   * @returns true if should use web API, false otherwise
   */
  shouldUseWebApi_fn = function() {
    return !(__privateMethod(this, _OSGeolocation_instances, isCapacitorPluginDefined_fn).call(this) || __privateMethod(this, _OSGeolocation_instances, isCordovaPluginDefined_fn).call(this));
  };
  /**
   * Checks if @capacitor/geolocation plugin is defined
   * 
   * @returns true if geolocation capacitor plugin is available; false otherwise
   */
  isCapacitorPluginDefined_fn = function() {
    return typeof window !== "undefined" && typeof window.CapacitorPlugins !== "undefined" && typeof window.CapacitorPlugins.Geolocation !== "undefined";
  };
  /**
   * Checks if Cordova Geolocation plugin is defined
   * 
   * @returns true if geolocation cordova plugin is available; false otherwise
   */
  isCordovaPluginDefined_fn = function() {
    return typeof cordova !== "undefined" && typeof cordova.plugins !== "undefined" && typeof cordova.plugins.Geolocation !== "undefined";
  };
  /**
   * Checks whether the native Geolocation plugin supports built-in timeout handling.
   * Calls the success callback with `true` if supported, otherwise `false`.
   * 
   * @param success Callback receiving a boolean indicating if native timeout handling is available.
   */
  hasNativeTimeoutHandling_fn = function(success) {
    if (__privateMethod(this, _OSGeolocation_instances, isCapacitorPluginDefined_fn).call(this)) {
      success(true);
      return;
    }
    if (typeof cordova !== "undefined" && cordova.plugins && cordova.plugins.Geolocation && typeof cordova.plugins.Geolocation.hasNativeTimeoutHandling === "function") {
      cordova.plugins.Geolocation.hasNativeTimeoutHandling(success, () => success(false));
    } else {
      success(false);
    }
  };
  const OSGeolocationInstance = new OSGeolocation();
  exports2.OSGeolocationInstance = OSGeolocationInstance;
  Object.defineProperty(exports2, Symbol.toStringTag, { value: "Module" });
});
