import OSGeolocationLib
import UIKit

@objc(OSGeolocation)
class OSGeolocation: CDVPlugin {
    /// The native library's main class
    private var implementationLib: OSGeolocationLib?
    
    override func pluginInitialize() {
        self.implementationLib = .init()
    }
    
    @objc(ping:)
    func ping(command: CDVInvokedUrlCommand) {
        guard
            let argumentsModel: OSGeolocationInputArgumentsSimpleModel = self.createModel(for: command.argument(at: 0))
        else {
            return self.send(error: [
                "code": "OS-PLUG-DPL-\(String(format: "%04d", 5))",
                "message": ""
            ], for: command.callbackId)
        }
        
        self.sendSuccess(for: command.callbackId, passbackVal: ["value": self.implementationLib!.ping(argumentsModel.value)])
    }
    
}

private extension OSGeolocation {
    func createModel<T: Decodable>(for inputArgument: Any?) -> T? {
        guard let argumentsDictionary = inputArgument as? [String: Any],
              let argumentsData = try? JSONSerialization.data(withJSONObject: argumentsDictionary),
              let argumentsModel = try? JSONDecoder().decode(T.self, from: argumentsData)
        else { return nil }
        return argumentsModel
    }

    func sendSuccess(for callbackId: String, passbackVal: [String: Any]? = nil) {
        let pluginResult: CDVPluginResult
        if let passbackVal {
            pluginResult = .init(status: .ok, messageAs: passbackVal)
        } else {
            pluginResult = .init(status: .ok)
        }
        pluginResult.keepCallback = true
        self.commandDelegate.send(pluginResult, callbackId: callbackId)
    }
    
    func send(error: [String: String], for callbackId: String) {
        let pluginResult = CDVPluginResult(status: .error, messageAs: error)
        self.commandDelegate.send(pluginResult, callbackId: callbackId)
    }
}

class OSGeolocationInputArgumentsSimpleModel: Decodable {
    let value: String
}
