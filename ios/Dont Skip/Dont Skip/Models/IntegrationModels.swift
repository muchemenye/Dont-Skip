import Foundation
import SwiftUI

// MARK: - Integration Models

struct Integration: Codable, Identifiable {
    let id: String
    let type: IntegrationType
    let isConnected: Bool
    let lastSync: Date?
    let syncStatus: SyncStatus
    let workoutCount: Int
    let creditsEarned: Int
    let settings: IntegrationSettings?
    
    var displayName: String {
        return type.displayName
    }
    
    var iconName: String {
        return type.iconName
    }
    
    var color: String {
        return type.color
    }
    
    var systemColor: Color {
        return type.systemColor
    }
}

enum IntegrationType: String, Codable, CaseIterable {
    case healthKit = "healthkit"
    case strava = "strava"
    case fitbit = "fitbit"
    case whoop = "whoop"
    case garmin = "garmin"
    case polar = "polar"
    
    var displayName: String {
        switch self {
        case .healthKit: return "Apple Health"
        case .strava: return "Strava"
        case .fitbit: return "Fitbit"
        case .whoop: return "WHOOP"
        case .garmin: return "Garmin Connect"
        case .polar: return "Polar Flow"
        }
    }
    
    var iconName: String {
        switch self {
        case .healthKit: return "heart.fill"
        case .strava: return "figure.run"
        case .fitbit: return "watch"
        case .whoop: return "waveform.path.ecg"
        case .garmin: return "location.fill"
        case .polar: return "snow"
        }
    }
    
    var color: String {
        switch self {
        case .healthKit: return "systemRed"
        case .strava: return "systemOrange"
        case .fitbit: return "systemBlue"
        case .whoop: return "systemPurple"
        case .garmin: return "systemBlue"
        case .polar: return "systemTeal"
        }
    }
    
    var systemColor: Color {
        switch self {
        case .healthKit: return Color(.systemRed)
        case .strava: return Color(.systemOrange)
        case .fitbit: return Color(.systemBlue)
        case .whoop: return Color(.systemPurple)
        case .garmin: return Color(.systemBlue)
        case .polar: return Color(.systemTeal)
        }
    }
    
    var description: String {
        switch self {
        case .healthKit: return "Sync workouts from Apple Health automatically"
        case .strava: return "Connect your Strava activities and earn credits"
        case .fitbit: return "Import workouts from your Fitbit device"
        case .whoop: return "Sync recovery and strain data from WHOOP"
        case .garmin: return "Connect Garmin Connect for comprehensive tracking"
        case .polar: return "Import training data from Polar Flow"
        }
    }
    
    var authURL: String {
        switch self {
        case .healthKit: return "" // Native integration
        case .strava: return "https://www.strava.com/oauth/authorize"
        case .fitbit: return "https://www.fitbit.com/oauth2/authorize"
        case .whoop: return "https://api.prod.whoop.com/oauth/oauth2/auth"
        case .garmin: return "https://connect.garmin.com/oauth/authorize"
        case .polar: return "https://flow.polar.com/oauth2/authorization"
        }
    }
    
    var requiresOAuth: Bool {
        return self != .healthKit
    }
}

enum SyncStatus: String, Codable {
    case idle = "idle"
    case syncing = "syncing"
    case success = "success"
    case error = "error"
    case unauthorized = "unauthorized"
    
    var displayName: String {
        switch self {
        case .idle: return "Ready"
        case .syncing: return "Syncing..."
        case .success: return "Up to date"
        case .error: return "Error"
        case .unauthorized: return "Needs authorization"
        }
    }
    
    var color: String {
        switch self {
        case .idle: return "systemGray"
        case .syncing: return "systemBlue"
        case .success: return "systemGreen"
        case .error: return "systemRed"
        case .unauthorized: return "systemOrange"
        }
    }
    
    var systemColor: Color {
        switch self {
        case .idle: return Color(.systemGray)
        case .syncing: return Color(.systemBlue)
        case .success: return Color(.systemGreen)
        case .error: return Color(.systemRed)
        case .unauthorized: return Color(.systemOrange)
        }
    }
}

struct IntegrationSettings: Codable {
    let autoSync: Bool
    let syncFrequency: SyncFrequency
    let workoutTypes: [WorkoutType]
    let creditMultiplier: Double
    let lastSyncDate: Date?
}

enum SyncFrequency: String, Codable, CaseIterable {
    case realtime = "realtime"
    case hourly = "hourly"
    case daily = "daily"
    case manual = "manual"
    
    var displayName: String {
        switch self {
        case .realtime: return "Real-time"
        case .hourly: return "Every hour"
        case .daily: return "Daily"
        case .manual: return "Manual only"
        }
    }
    
    var interval: TimeInterval {
        switch self {
        case .realtime: return 0
        case .hourly: return 3600
        case .daily: return 86400
        case .manual: return 0
        }
    }
}

// MARK: - OAuth Models

struct OAuthRequest {
    let integrationType: IntegrationType
    let clientId: String
    let redirectURI: String
    let scopes: [String]
    let state: String
    
    var authURL: URL? {
        var components = URLComponents(string: integrationType.authURL)
        components?.queryItems = [
            URLQueryItem(name: "client_id", value: clientId),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: scopes.joined(separator: " ")),
            URLQueryItem(name: "state", value: state)
        ]
        return components?.url
    }
}

struct OAuthResponse {
    let code: String
    let state: String
    let integrationType: IntegrationType
}