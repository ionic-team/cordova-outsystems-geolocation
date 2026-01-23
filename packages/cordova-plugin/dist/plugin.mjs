import { require as require$1 } from "cordova";
function s(t) {
  t.CapacitorUtils.Synapse = new Proxy(
    {},
    {
      get(e, n) {
        return new Proxy({}, {
          get(w, o) {
            return (c, p, r) => {
              const i = t.Capacitor.Plugins[n];
              if (i === void 0) {
                r(new Error(`Capacitor plugin ${n} not found`));
                return;
              }
              if (typeof i[o] != "function") {
                r(new Error(`Method ${o} not found in Capacitor plugin ${n}`));
                return;
              }
              (async () => {
                try {
                  const a = await i[o](c);
                  p(a);
                } catch (a) {
                  r(a);
                }
              })();
            };
          }
        });
      }
    }
  );
}
function u(t) {
  t.CapacitorUtils.Synapse = new Proxy(
    {},
    {
      get(e, n) {
        return t.cordova.plugins[n];
      }
    }
  );
}
function f(t = false) {
  typeof window > "u" || (window.CapacitorUtils = window.CapacitorUtils || {}, window.Capacitor !== void 0 && !t ? s(window) : window.cordova !== void 0 && u(window));
}
const CurrentPositionOptionsDefault = {
  enableHighAccuracy: false,
  timeout: 1e3,
  maximumAge: 0,
  minimumUpdateInterval: 5e3,
  enableLocationFallback: true
};
const ClearWatchOptionsDefault = {
  id: "-1"
};
const WatchPositionOptionsDefault = {
  ...CurrentPositionOptionsDefault,
  ...ClearWatchOptionsDefault
};
var exec = require$1("cordova/exec");
function getCurrentPosition(options, success, error) {
  options = { ...CurrentPositionOptionsDefault, ...options };
  let convertOnSuccess = (position) => {
    let convertedPosition = {
      coords: {
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude,
        accuracy: position.accuracy,
        heading: position.heading,
        speed: position.speed,
        altitudeAccuracy: position.altitudeAccuracy
      },
      timestamp: position.timestamp
    };
    success(convertedPosition);
  };
  exec(convertOnSuccess, error, "OSGeolocation", "getCurrentPosition", [options]);
}
function watchPosition(options, success, error) {
  options = { ...WatchPositionOptionsDefault, ...options };
  let convertOnSuccess = (position) => {
    let convertedPosition = {
      coords: {
        latitude: position.latitude,
        longitude: position.longitude,
        altitude: position.altitude,
        accuracy: position.accuracy,
        heading: position.heading,
        speed: position.speed,
        altitudeAccuracy: position.altitudeAccuracy
      },
      timestamp: position.timestamp
    };
    success(convertedPosition);
  };
  exec(convertOnSuccess, error, "OSGeolocation", "watchPosition", [options]);
}
function clearWatch(options, success, error) {
  options = { ...ClearWatchOptionsDefault, ...options };
  exec(success, error, "OSGeolocation", "clearWatch", [options]);
}
function hasNativeTimeoutHandling(success, error) {
  exec(success, error, "OSGeolocation", "hasNativeTimeoutHandling", []);
}
module.exports = {
  getCurrentPosition,
  watchPosition,
  clearWatch,
  hasNativeTimeoutHandling
};
f(true);
