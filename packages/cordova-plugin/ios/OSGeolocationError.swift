enum OSGeolocationMethod: String {
    case getCurrentPosition
    case watchPosition
    case clearWatch
}

enum OSGeolocationError: Error {
    case locationServicesDisabled
    case permissionDenied
    case permissionRestricted
    case positionUnavailable
    case inputArgumentsIssue(target: OSGeolocationMethod)
    case timeout

    func toDictionary() -> [String: String] {
        [
            "code": "OS-PLUG-GLOC-\(String(format: "%04d", code))",
            "message": description
        ]
    }
}

private extension OSGeolocationError {
    var code: Int {
        switch self {
        case .positionUnavailable: 2
        case .permissionDenied: 3
        case .locationServicesDisabled: 7
        case .permissionRestricted: 8
        case .inputArgumentsIssue(let target):
            switch target {
            case .getCurrentPosition: 4
            case .watchPosition: 5
            case .clearWatch: 6
            }
        case .timeout: 10
        }
    }

    var description: String {
        switch self {
        case .positionUnavailable: "There was en error trying to obtain the location."
        case .permissionDenied: "Location permission request was denied."
        case .locationServicesDisabled: "Location services are not enabled."
        case .permissionRestricted: "Application's use of location services was restricted."
        case .inputArgumentsIssue(let target): "The '\(target.rawValue)' input parameters aren't valid."
        case .timeout: "Could not obtain location in time. Try with a higher timeout."
        }
    }
}
