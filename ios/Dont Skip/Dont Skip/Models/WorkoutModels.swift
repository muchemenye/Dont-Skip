import Foundation
import HealthKit

// MARK: - Core Models

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let settings: UserSettings
    let createdAt: Date
    let lastActive: Date
}

struct UserSettings: Codable {
    let workoutCreditRatio: Double
    let maxDailyCredits: Int
    let emergencyCredits: Int
    let creditExpiration: Int
    let enabledIntegrations: [String]
    let lockoutEnabled: Bool
    let workoutTypes: [CustomWorkoutType]?
}

struct CustomWorkoutType: Codable, Identifiable {
    let name: String
    let minDuration: Int
    let codingHoursEarned: Double

    var id: String {
        "\(name)-\(minDuration)-\(codingHoursEarned)"
    }

    var codingMinutes: Int {
        Int(codingHoursEarned * 60)
    }

    var displayDescription: String {
        "\(minDuration) min → \(Int(codingHoursEarned * 60)) min coding"
    }

    // Map custom workout type name to WorkoutType enum
    var workoutType: WorkoutType {
        let lowercased = name.lowercased()

        if lowercased.contains("run") || lowercased.contains("cardio") {
            return .running
        } else if lowercased.contains("walk") || lowercased.contains("hike") {
            return .walking
        } else if lowercased.contains("strength") || lowercased.contains("weight")
            || lowercased.contains("gym")
        {
            return .strength
        } else if lowercased.contains("yoga") || lowercased.contains("stretch")
            || lowercased.contains("flexibility")
        {
            return .yoga
        } else if lowercased.contains("swim") {
            return .swimming
        } else if lowercased.contains("cycle") || lowercased.contains("bike") {
            return .cycling
        } else if lowercased.contains("hiit") || lowercased.contains("interval") {
            return .hiit
        } else {
            return .other
        }
    }
}

struct CreditBalance: Codable {
    let availableCredits: Int  // in minutes
    let emergencyCredits: Int
    let totalEarned: Int
    let totalSpent: Int
    let lastUpdated: Date

    var availableHours: Double {
        return Double(availableCredits) / 60.0
    }
}

struct Workout: Codable, Identifiable {
    let id: String
    let type: WorkoutType
    let startTime: Date
    let endTime: Date
    let duration: Int  // minutes
    let calories: Int?
    let heartRate: HeartRateData?
    let distance: Double?  // meters
    let source: WorkoutSource
    let creditsAwarded: Int?

    // Computed property for UI display - can still show "earned" to users
    var creditsEarned: Int {
        // If we have actual awarded credits, use those
        if let awarded = creditsAwarded {
            return awarded
        }

        // For manual workouts without awarded credits, estimate based on duration
        // This handles the case where the backend response didn't include creditsAwarded
        if source == .manual {
            // Use the same 2:1 ratio as other parts of the app (2 minutes coding per minute workout)
            return duration * 2
        }

        return 0
    }
    let verified: Bool
    let processed: Bool?

    var durationString: String {
        let hours = duration / 60
        let minutes = duration % 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }
}

struct HeartRateData: Codable {
    let average: Int?
    let maximum: Int?
}

enum WorkoutType: String, Codable, CaseIterable {
    case running = "running"
    case cycling = "cycling"
    case walking = "walking"
    case strength = "strength"
    case yoga = "yoga"
    case swimming = "swimming"
    case hiit = "hiit"
    case other = "other"

    var displayName: String {
        switch self {
        case .running: return "Running"
        case .cycling: return "Cycling"
        case .walking: return "Walking"
        case .strength: return "Strength Training"
        case .yoga: return "Yoga"
        case .swimming: return "Swimming"
        case .hiit: return "HIIT"
        case .other: return "Other"
        }
    }

    var emoji: String {
        switch self {
        case .running: return "🏃‍♂️"
        case .cycling: return "🚴‍♂️"
        case .walking: return "🚶‍♂️"
        case .strength: return "🏋️‍♂️"
        case .yoga: return "🧘‍♂️"
        case .swimming: return "🏊‍♂️"
        case .hiit: return "💪"
        case .other: return "🏃‍♂️"
        }
    }

    var healthKitType: HKWorkoutActivityType {
        switch self {
        case .running: return .running
        case .cycling: return .cycling
        case .walking: return .walking
        case .strength: return .functionalStrengthTraining
        case .yoga: return .yoga
        case .swimming: return .swimming
        case .hiit: return .highIntensityIntervalTraining
        case .other: return .other
        }
    }
}

enum WorkoutSource: String, Codable {
    case manual = "manual"
    case healthKit = "healthkit"
    case strava = "strava"
    case whoop = "whoop"
    case fitbit = "fitbit"

    var displayName: String {
        switch self {
        case .manual: return "Manual Entry"
        case .healthKit: return "Apple Health"
        case .strava: return "Strava"
        case .whoop: return "Whoop"
        case .fitbit: return "Fitbit"
        }
    }
}

// MARK: - API Response Models

struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let error: String?
}

struct AuthResponse: Codable {
    let token: String
    let user: User
    let mfaRequired: Bool
}

struct WorkoutSyncResponse: Codable {
    let workouts: [Workout]
    let creditsAwarded: Int
    let message: String
}

// MARK: - Manual Workout Entry

struct ManualWorkoutEntry {
    var type: WorkoutType = .running
    var duration: Int = 30  // minutes
    var calories: Int?
    var distance: Double?  // kilometers
    var startTime: Date = Date()

    var isValid: Bool {
        return duration >= 5 && duration <= 480  // 5 minutes to 8 hours
    }

    func toWorkout() -> Workout {
        let endTime = startTime.addingTimeInterval(TimeInterval(duration * 60))
        // Don't calculate credits here - let the backend handle it

        return Workout(
            id: UUID().uuidString,
            type: type,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            calories: calories,
            heartRate: nil,
            distance: distance,
            source: .manual,
            creditsAwarded: nil,  // Backend will calculate and return this
            verified: false,
            processed: nil
        )
    }
}
