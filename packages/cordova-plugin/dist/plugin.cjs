"use strict";
const cordova = require("cordova");
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
var exec = cordova.require("cordova/exec");
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
