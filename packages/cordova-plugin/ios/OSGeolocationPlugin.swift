import IONGeolocationLib
import Combine
import UIKit

@objc(OSGeolocation)
final class OSGeolocation: CDVPlugin {
    private var locationService: (any IONGLOCService)?
    private var cancellables = Set<AnyCancellable>()
    private var locationCancellable: AnyCancellable?
    private var timeoutCancellable: AnyCancellable?
    private var callbackManager: OSGeolocationCallbackManager?
    private var statusInitialized = false
    private var locationInitialized: Bool = false

    override func pluginInitialize() {
        self.locationService = IONGLOCManagerWrapper()
        self.callbackManager = .init(commandDelegate: commandDelegate)
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        
        setupBindings()
    }

    @objc private func appDidBecomeActive() {
        if let watchCallbacksEmpty = callbackManager?.watchCallbacks.isEmpty, !watchCallbacksEmpty {
            print("App became active. Restarting location monitoring for watch callbacks.")
            locationCancellable?.cancel()
            locationCancellable = nil
            timeoutCancellable?.cancel()
            timeoutCancellable = nil
            locationInitialized = false
            
            locationService?.stopMonitoringLocation()
            locationService?.startMonitoringLocation()
            bindLocationPublisher()
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc(getCurrentPosition:)
    func getLocation(command: CDVInvokedUrlCommand) {
        guard let config: OSGeolocationCurrentPositionModel = createModel(for: command.argument(at: 0))
        else {
            callbackManager?.sendError(.inputArgumentsIssue(target: .getCurrentPosition))
            return
        }
        
        handleLocationRequest(config.enableHighAccuracy, timeout: config.timeout, command.callbackId)
    }

    @objc(watchPosition:)
    func addWatch(command: CDVInvokedUrlCommand) {
        guard let config: OSGeolocationWatchPositionModel = createModel(for: command.argument(at: 0))
        else {
            callbackManager?.sendError(.inputArgumentsIssue(target: .watchPosition))
            return
        }
        
        handleLocationRequest(config.enableHighAccuracy, watchUUID: config.id, timeout: config.timeout, command.callbackId)
    }

    @objc(clearWatch:)
    func clearWatch(command: CDVInvokedUrlCommand) {
        guard let config: OSGeolocationClearWatchModel = createModel(for: command.argument(at: 0))
        else {
            callbackManager?.sendError(.inputArgumentsIssue(target: .clearWatch))
            return
        }
        callbackManager?.clearWatchCallbackIfExists(config.id)

        if (callbackManager?.watchCallbacks.isEmpty) ?? false {
            locationService?.stopMonitoringLocation()
            locationCancellable?.cancel()
            locationCancellable = nil
            timeoutCancellable?.cancel()
            timeoutCancellable = nil
            locationInitialized = false
        }

        callbackManager?.sendSuccess(command.callbackId)
    }
}

private extension OSGeolocation {
    func setupBindings() {
        bindAuthorisationStatusPublisher()
        bindLocationPublisher()
    }

    func bindAuthorisationStatusPublisher() {
        guard !statusInitialized else { return }
        statusInitialized = true
        locationService?.authorisationStatusPublisher
            .sink { [weak self] status in
                guard let self else { return }

                switch status {
                case .denied:
                    self.callbackManager?.sendError(.permissionDenied)
                case .notDetermined:
                    self.requestLocationAuthorisation(type: .whenInUse)
                case .restricted:
                    self.callbackManager?.sendError(.permissionRestricted)
                case .authorisedAlways, .authorisedWhenInUse:
                    self.requestLocation()
                @unknown default: break
                }
            }
            .store(in: &cancellables)
    }
    
    func bindLocationPublisher() {
        guard !locationInitialized else { return }
        locationInitialized = true
        locationCancellable = locationService?.currentLocationPublisher
            .catch { [weak self] error -> AnyPublisher<IONGLOCPositionModel, Never> in
                print("An error was found while retrieving the location: \(error)")
                
                if case IONGLOCLocationError.locationUnavailable = error {
                    print("Location unavailable (likely due to backgrounding). Keeping watch callbacks alive.")
                    self?.callbackManager?.sendError(.positionUnavailable)
                    return Empty<IONGLOCPositionModel, Never>()
                        .eraseToAnyPublisher()
                } else {
                    self?.callbackManager?.sendError(.positionUnavailable)
                    return Empty<IONGLOCPositionModel, Never>()
                        .eraseToAnyPublisher()
                }
            }
            .sink(receiveValue: { [weak self] position in
                self?.callbackManager?.sendSuccess(with: position)
            })
        
        timeoutCancellable = locationService?.locationTimeoutPublisher
            .sink(receiveValue: { [weak self] error in
                if case .timeout = error {
                    self?.callbackManager?.sendError(.timeout)
                } else {
                    self?.callbackManager?.sendError(.positionUnavailable)
                }
            })
    }

    func requestLocationAuthorisation(type requestType: IONGLOCAuthorisationRequestType) {
        commandDelegate.run { [weak self] in
            guard let self else { return }

            guard locationService?.areLocationServicesEnabled() ?? false else {
                self.callbackManager?.sendError(.locationServicesDisabled)
                return
            }
            self.locationService?.requestAuthorisation(withType: requestType)
        }
    }

    func requestLocation() {
        // should request if callbacks exist and are not empty
        let shouldRequestCurrentPosition = callbackManager?.locationCallbacks.isEmpty == false
        let shouldRequestLocationMonitoring = callbackManager?.watchCallbacks.isEmpty == false

        if shouldRequestCurrentPosition {
            locationService?.requestSingleLocation(options: IONGLOCRequestOptionsModel(timeout: callbackManager?.timeout))
        }
        if shouldRequestLocationMonitoring {
            locationService?.startMonitoringLocation(options: IONGLOCRequestOptionsModel(timeout: callbackManager?.timeout))
        }
    }

    func createModel<T: Decodable>(for inputArgument: Any?) -> T? {
        guard let argumentsDictionary = inputArgument as? [String: Any],
              let argumentsData = try? JSONSerialization.data(withJSONObject: argumentsDictionary),
              let argumentsModel = try? JSONDecoder().decode(T.self, from: argumentsData)
        else { return nil }
        return argumentsModel
    }

    func handleLocationRequest(_ enableHighAccuracy: Bool, watchUUID: String? = nil, timeout: Int? = nil, _ callbackId: String) {
        bindLocationPublisher()
        let configurationModel = IONGLOCConfigurationModel.createWithAccuracy(enableHighAccuracy)
        locationService?.updateConfiguration(configurationModel)

        if let watchUUID {
            callbackManager?.addWatchCallback(watchUUID, timeout: timeout, callbackId)
        } else {
            callbackManager?.addLocationCallback(timeout: timeout, callbackId)
        }

        switch locationService?.authorisationStatus {
        case .authorisedAlways, .authorisedWhenInUse: requestLocation()
        case .denied: callbackManager?.sendError(.permissionDenied)
        case .restricted: callbackManager?.sendError(.permissionRestricted)
        default: break
        }
    }
}
