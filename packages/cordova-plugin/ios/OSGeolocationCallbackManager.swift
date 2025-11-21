import IONGeolocationLib

private enum OSGeolocationCallbackType {
    case location
    case watch

    var shouldKeepCallback: Bool {
        self == .watch
    }

    var shouldClearAfterSending: Bool {
        self == .location
    }
}

private struct OSGeolocationCallbackGroup {
    let ids: [String]
    let type: OSGeolocationCallbackType
}

final class OSGeolocationCallbackManager {
    private(set) var locationCallbacks: [String]
    private(set) var watchCallbacks: [String: String]
    private(set) var timeout: Int?
    private let commandDelegate: CDVCommandDelegate

    private var allCallbackGroups: [OSGeolocationCallbackGroup] {
        [
            .init(ids: locationCallbacks, type: .location),
            .init(ids: Array(watchCallbacks.values), type: .watch)
        ]
    }

    init(commandDelegate: CDVCommandDelegate) {
        self.commandDelegate = commandDelegate
        self.locationCallbacks = []
        self.watchCallbacks = [:]

    }
    
    func addLocationCallback(timeout: Int? = nil, _ callbackId: String) {
        locationCallbacks.append(callbackId)
        self.timeout = timeout
    }
    
    func addWatchCallback(_ watchId: String, timeout: Int? = nil, _ callbackId: String) {
        watchCallbacks[watchId] = callbackId
        self.timeout = timeout
    }
    
    func clearWatchCallbackIfExists(_ watchId: String) {
        if watchCallbacks.keys.contains(watchId) {
            watchCallbacks.removeValue(forKey: watchId)
        }
    }

    func sendSuccess(_ callbackId: String) {
        let result = CDVPluginResult(status: .ok)
        commandDelegate.send(result, callbackId: callbackId)
    }

    func sendSuccess(with position: IONGLOCPositionModel) {
        createPluginResult(status: .ok, message: position.toResultDictionary())
    }

    func sendError(_ error: OSGeolocationError) {
        createPluginResult(status: .error, message: error.toDictionary())
        
        if case .timeout = error {
            watchCallbacks.keys.forEach { clearWatchCallbackIfExists($0) }
        }
    }
}

private extension OSGeolocationCallbackManager {
    func createPluginResult(status: CDVCommandStatus, message: [String: Any]) {
        let result = CDVPluginResult(status: status, messageAs: message)
        allCallbackGroups.forEach { group in
            let resultToSend = result.map { configureResult($0, for: group.type) }
            send(resultToSend, to: group)
        }
    }

    func configureResult(_ result: CDVPluginResult, for type: OSGeolocationCallbackType) -> CDVPluginResult {
        result.keepCallback = NSNumber(booleanLiteral: type.shouldKeepCallback)
        return result
    }

    func send(_ result: CDVPluginResult?, to group: OSGeolocationCallbackGroup) {
        group.ids.forEach { callbackId in
            commandDelegate.send(result, callbackId: callbackId)
        }

        if group.type.shouldClearAfterSending {
            clearCallbacks(for: group.type)
        }
    }

    func clearCallbacks(for type: OSGeolocationCallbackType) {
        if case .location = type {
            locationCallbacks.removeAll()
        }
    }
}
