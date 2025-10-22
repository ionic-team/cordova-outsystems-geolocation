//import IONGeolocationLib

extension IONGLOCConfigurationModel {
    static func createWithAccuracy(_ isHighAccuracyEnabled: Bool) -> IONGLOCConfigurationModel {
        let minimumDistance = isHighAccuracyEnabled ?
            Constants.MinimumDistance.highAccuracy :
            Constants.MinimumDistance.lowAccuracy

        return .init(
            enableHighAccuracy: isHighAccuracyEnabled,
            minimumUpdateDistanceInMeters: minimumDistance
        )
    }
}
