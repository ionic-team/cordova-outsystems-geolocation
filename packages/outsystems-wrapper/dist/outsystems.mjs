var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _lastPosition, _callbackIdsMap, _OSGeolocation_instances, convertFromLegacy_fn, isLegacyPosition_fn, shouldUseWebApi_fn, isCapacitorPluginDefined_fn, isSynapseDefined_fn;
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
    __privateAdd(this, _callbackIdsMap, {});
  }
  getCurrentPosition(success, error, options) {
    if (__privateMethod(this, _OSGeolocation_instances, shouldUseWebApi_fn).call(this)) {
      navigator.geolocation.getCurrentPosition(success, error, options);
      return;
    }
    const successCallback = (position) => {
      if (__privateMethod(this, _OSGeolocation_instances, isLegacyPosition_fn).call(this, position)) {
        position = __privateMethod(this, _OSGeolocation_instances, convertFromLegacy_fn).call(this, position);
      }
      __privateSet(this, _lastPosition, position);
      success(position);
    };
    const errorCallback = (e) => {
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
      if (__privateMethod(this, _OSGeolocation_instances, isSynapseDefined_fn).call(this)) {
        CapacitorUtils.Synapse.Geolocation.getCurrentPosition(options, successCallback, errorCallback);
      } else {
        Capacitor.Plugins.Geolocation.getCurrentPosition(options).then(successCallback).catch(errorCallback);
      }
    }
  }
  watchPosition(success, error, options) {
    if (__privateMethod(this, _OSGeolocation_instances, shouldUseWebApi_fn).call(this)) {
      return navigator.geolocation.watchPosition(success, error, options);
    }
    let watchId = v4();
    const successCallback = (res) => {
      if (__privateMethod(this, _OSGeolocation_instances, isLegacyPosition_fn).call(this, res)) {
        res = __privateMethod(this, _OSGeolocation_instances, convertFromLegacy_fn).call(this, res);
      }
      __privateSet(this, _lastPosition, res);
      success(res);
    };
    const errorCallback = (e) => {
      if (e.code === "OS-PLUG-GLOC-0010") {
        this.clearWatch({ id: watchId });
      }
      error(e);
    };
    const watchAddedCallback = (callbackId) => {
      __privateGet(this, _callbackIdsMap)[watchId] = callbackId;
    };
    options.id = watchId;
    if (__privateMethod(this, _OSGeolocation_instances, isCapacitorPluginDefined_fn).call(this)) {
      Capacitor.Plugins.Geolocation.watchPosition(
        options,
        (position, err) => {
          if (err) {
            errorCallback(err);
          } else if (position) {
            successCallback(position);
          }
        }
      ).then(watchAddedCallback);
    } else {
      cordova.plugins.Geolocation.watchPosition(options, successCallback, errorCallback);
    }
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
    let optionsWithCorrectId = options;
    if (__privateGet(this, _callbackIdsMap)[options.id]) {
      optionsWithCorrectId = { id: __privateGet(this, _callbackIdsMap)[options.id] };
    }
    const successCallback = () => {
      delete __privateGet(this, _callbackIdsMap)[options.id];
      success();
    };
    if (__privateMethod(this, _OSGeolocation_instances, isSynapseDefined_fn).call(this)) {
      CapacitorUtils.Synapse.Geolocation.clearWatch(optionsWithCorrectId, successCallback, error);
    } else {
      Capacitor.Plugins.Geolocation.clearWatch(optionsWithCorrectId).then(successCallback).catch(error);
    }
  }
}
_lastPosition = new WeakMap();
_callbackIdsMap = new WeakMap();
_OSGeolocation_instances = new WeakSet();
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
      altitudeAccuracy: lPosition.altitudeAccuracy
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
  if (__privateMethod(this, _OSGeolocation_instances, isSynapseDefined_fn).call(this)) {
    return false;
  }
  if (__privateMethod(this, _OSGeolocation_instances, isCapacitorPluginDefined_fn).call(this)) {
    const platform = Capacitor.getPlatform();
    return platform === "web";
  }
  return true;
};
/**
 * Checks if @capacitor/geolocation plugin is defined
 * 
 * @returns true if geolocation capacitor plugin is available; false otherwise
 */
isCapacitorPluginDefined_fn = function() {
  return typeof Capacitor !== "undefined" && typeof Capacitor.Plugins !== "undefined" && typeof Capacitor.Plugins.Geolocation !== "undefined";
};
/**
 * @returns true if synapse is defined, false otherwise
 */
isSynapseDefined_fn = function() {
  return typeof CapacitorUtils !== "undefined" && typeof CapacitorUtils.Synapse !== "undefined" && typeof CapacitorUtils.Synapse.Geolocation !== "undefined";
};
const OSGeolocationInstance = new OSGeolocation();
export {
  OSGeolocationInstance
};
