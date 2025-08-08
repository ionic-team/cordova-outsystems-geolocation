import IONGeolocationLib
import Combine
import UIKit

@objc(OSGeolocation)
final class OSGeolocation: CDVPlugin {
    private var locationService: (any IONGLOCService)?
    private var cancellables = Set<AnyCancellable>()
    private var locationCancellable: AnyCancellable?
    private var callbackManager: OSGeolocationCallbackManager?
    private var statusInitialized = false
    private var locationInitialized: Bool = false
    private var resumeWatchAfterSingleRequest: Bool = false
    
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
        handleLocationRequest(config.enableHighAccuracy, command.callbackId)
    }

    @objc(watchPosition:)
    func addWatch(command: CDVInvokedUrlCommand) {
        guard let config: OSGeolocationWatchPositionModel = createModel(for: command.argument(at: 0))
        else {
            callbackManager?.sendError(.inputArgumentsIssue(target: .watchPosition))
            return
        }
        handleLocationRequest(config.enableHighAccuracy, watchUUID: config.id, command.callbackId)
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
                
                if self?.resumeWatchAfterSingleRequest == true {
                    self?.resumeWatchAfterSingleRequest = false
                    self?.locationCancellable?.cancel()
                    self?.locationCancellable = nil
                    self?.locationInitialized = false
                    
                    self?.locationService?.stopMonitoringLocation()
                    self?.locationService?.startMonitoringLocation()
                    self?.bindLocationPublisher()
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
        self.checkIfPublisherActivated()
        
        let shouldRequestLocationMonitoring = callbackManager?.watchCallbacks.isEmpty == false
        let shouldRequestCurrentPosition = callbackManager?.locationCallbacks.isEmpty == false
        
        if shouldRequestCurrentPosition {
            if shouldRequestLocationMonitoring {
                self.resumeWatchAfterSingleRequest = true
                locationService?.stopMonitoringLocation()
                locationService?.requestSingleLocation()
            } else {
                locationService?.requestSingleLocation()
            }
        }
        
        if watchIsActive && !singleRequestNeeded {
            locationService?.startMonitoringLocation()
        }
    }
    
    func checkIfPublisherActivated(){
        if self.locationInitialized {
            self.bindLocationPublisher()
        }
    }
    
    func createModel<T: Decodable>(for inputArgument: Any?) -> T? {
        guard let argumentsDictionary = inputArgument as? [String: Any],
              let argumentsData = try? JSONSerialization.data(withJSONObject: argumentsDictionary),
              let argumentsModel = try? JSONDecoder().decode(T.self, from: argumentsData)
        else { return nil }
        return argumentsModel
    }

    func handleLocationRequest(_ enableHighAccuracy: Bool, watchUUID: String? = nil, _ callbackId: String) {
        let configurationModel = IONGLOCConfigurationModel.createWithAccuracy(enableHighAccuracy)
        locationService?.updateConfiguration(configurationModel)

        if let watchUUID {
            callbackManager?.addWatchCallback(watchUUID, callbackId)
        } else {
            callbackManager?.addLocationCallback(callbackId)
        }

        switch locationService?.authorisationStatus {
        case .authorisedAlways, .authorisedWhenInUse: requestLocation()
        case .denied: callbackManager?.sendError(.permissionDenied)
        case .restricted: callbackManager?.sendError(.permissionRestricted)
        default: break
        }
    }
}

