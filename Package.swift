// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "com.outsystems.plugins.geolocation",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "com.outsystems.plugins.geolocation",
            targets: ["OSGeolocationPlugin"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/apache/cordova-ios.git", branch: "master"),
        .package(url: "https://github.com/ionic-team/ion-ios-geolocation.git", exact: "3.0.0")
    ],
    targets: [
        .target(
            name: "OSGeolocationPlugin",
            dependencies: [
                .product(name: "Cordova", package: "cordova-ios"),
                .product(name: "IONGeolocationLib", package: "ion-ios-geolocation")
            ],
            path: "packages/cordova-plugin/ios"
        )
    ]
)
