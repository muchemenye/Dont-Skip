import Foundation

struct Config {
    // MARK: - App Information

    static let appVersion: String = {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }()

    static let buildNumber: String = {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }()

    // MARK: - Credit System

    static let defaultWorkoutCreditRatio: Double = 2.0  // 2 credits per minute
    static let maxDailyCredits: Int = 480  // 8 hours worth
    static let emergencyCredits: Int = 60  // 1 hour
    static let creditExpirationDays: Int = 30

    // MARK: - Workout Settings

    static let minWorkoutDuration: Int = 5  // minutes
    static let maxWorkoutDuration: Int = 480  // 8 hours
    static let defaultSyncFrequency: Int = 60  // minutes

    // MARK: - API Configuration

    static let baseURL: String = {
        #if DEBUG
            return "http://localhost:3000/api"
        #else
            return "https://api.dontskip.app/api"
        #endif
    }()

    static let apiTimeout: TimeInterval = 30.0

    // MARK: - HealthKit Configuration

    static let healthKitSyncDays: Int = 7
    static let backgroundSyncInterval: TimeInterval = 3600  // 1 hour

    // MARK: - Premium Features

    static let freeIntegrationLimit: Int = 1  // Only HealthKit for free users
    static let freeWorkoutHistoryLimit: Int = 50
    static let freeSyncFrequency: TimeInterval = 3600  // 1 hour
    static let premiumSyncFrequency: TimeInterval = 600  // 10 minutes (changed from 5 minutes)
    static let balanceRefreshInterval: TimeInterval = 10.0  // 10 seconds for balance updates

    // MARK: - OAuth URLs

    static let stravaAuthURL: String = "https://www.strava.com/oauth/authorize"
    static let fitbitAuthURL: String = "https://www.fitbit.com/oauth2/authorize"
    static let whoopAuthURL: String = "https://api.prod.whoop.com/oauth/oauth2/auth"
}
