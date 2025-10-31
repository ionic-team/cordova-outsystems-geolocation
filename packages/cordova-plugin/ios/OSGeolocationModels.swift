struct OSGeolocationCurrentPositionModel: Decodable {
    let enableHighAccuracy: Bool
    let timeout: Int
}

struct OSGeolocationWatchPositionModel: Decodable {
    let id: String
    let enableHighAccuracy: Bool
    let timeout: Int
}

struct OSGeolocationClearWatchModel: Decodable {
    let id: String
}
