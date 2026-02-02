import IONGeolocationLib

extension IONGLOCPositionModel {
    func toResultDictionary() -> [String: Any] {
        let headingValue = trueHeading != -1.0 ? trueHeading : (magneticHeading != -1.0 ? magneticHeading : course)
        return [
            Constants.Position.altitude: altitude,
            Constants.Position.heading: headingValue != -1.0 ? headingValue : NSNull(),
            Constants.Position.magneticHeading: magneticHeading != -1.0 ? magneticHeading : NSNull(),
            Constants.Position.trueHeading: trueHeading != -1.0 ? trueHeading : NSNull(),
            Constants.Position.headingAccuracy: headingAccuracy != -1.0 ? headingAccuracy : NSNull(),
            Constants.Position.course: course,
            Constants.Position.accuracy: horizontalAccuracy,
            Constants.Position.latitude: latitude,
            Constants.Position.longitude: longitude,
            Constants.Position.speed: speed,
            Constants.Position.timestamp: timestamp,
            Constants.Position.altitudeAccuracy: verticalAccuracy
        ]
    }
}
