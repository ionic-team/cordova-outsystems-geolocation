//import IONGeolocationLib

extension IONGLOCPositionModel {
    func toResultDictionary() -> [String: Double] {
        [
            Constants.Position.altitude: altitude,
            Constants.Position.heading: course,
            Constants.Position.accuracy: horizontalAccuracy,
            Constants.Position.latitude: latitude,
            Constants.Position.longitude: longitude,
            Constants.Position.speed: speed,
            Constants.Position.timestamp: timestamp,
            Constants.Position.altitudeAccuracy: verticalAccuracy
        ]
    }
}
