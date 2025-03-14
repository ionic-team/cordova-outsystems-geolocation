import { require as require2 } from "cordova";
function s(t) {
  t.CapacitorUtils.Synapse = new Proxy(
    {},
    {
      get(e, o) {
        return new Proxy({}, {
          get(w, r) {
            return (c, p, n) => {
              const i = t.Capacitor.Plugins[o];
              if (i === void 0) {
                n(new Error(`Capacitor plugin ${o} not found`));
                return;
              }
              if (typeof i[r] != "function") {
                n(new Error(`Method ${r} not found in Capacitor plugin ${o}`));
                return;
              }
              (async () => {
                try {
                  const a = await i[r](c);
                  p(a);
                } catch (a) {
                  n(a);
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
      get(e, o) {
        return t.cordova.plugins[o];
      }
    }
  );
}
function y(t = false) {
  window.CapacitorUtils = window.CapacitorUtils || {}, window.Capacitor !== void 0 && !t ? s(window) : window.cordova !== void 0 && u(window);
}
const CurrentPositionOptionsDefault = {
  enableHighAccuracy: false,
  timeout: 1e3,
  maximumAge: 0,
  minimumUpdateInterval: 5e3
};
const ClearWatchOptionsDefault = {
  id: "-1"
};
const WatchPositionOptionsDefault = {
  ...CurrentPositionOptionsDefault,
  ...ClearWatchOptionsDefault
};
var exec = require2("cordova/exec");
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
module.exports = {
  getCurrentPosition,
  watchPosition,
  clearWatch
};
y(true);
