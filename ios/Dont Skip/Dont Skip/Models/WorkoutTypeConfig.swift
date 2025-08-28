import Foundation

// MARK: - Workout Type Configuration
// This matches the extension's workout type system for consistency

struct WorkoutTypeConfig: Codable, Identifiable {
    let name: String
    let minDuration: Int  // minutes
    let codingHours: Double
    let workoutType: WorkoutType  // Maps to our existing WorkoutType enum

    // Computed property for Identifiable conformance
    var id: String {
        "\(workoutType.rawValue)-\(minDuration)-\(codingHours)"
    }

    var codingMinutes: Int {
        Int(codingHours * 60)
    }

    var displayDescription: String {
        "\(minDuration) min → \(Int(codingHours * 60)) min coding"
    }

    // Memberwise initializer
    init(name: String, minDuration: Int, codingHours: Double, workoutType: WorkoutType) {
        self.name = name
        self.minDuration = minDuration
        self.codingHours = codingHours
        self.workoutType = workoutType
    }

    // Create WorkoutTypeConfig from CustomWorkoutType
    init(from customType: CustomWorkoutType) {
        self.name = customType.name
        self.minDuration = customType.minDuration
        self.codingHours = customType.codingHoursEarned
        self.workoutType = customType.workoutType
    }

    static let defaultConfigs: [WorkoutTypeConfig] = [
        WorkoutTypeConfig(
            name: "Quick Stretch",
            minDuration: 5,
            codingHours: 2.0,
            workoutType: .yoga
        ),
        WorkoutTypeConfig(
            name: "Short Walk",
            minDuration: 10,
            codingHours: 2.0,
            workoutType: .walking
        ),
        WorkoutTypeConfig(
            name: "Cardio Session",
            minDuration: 20,
            codingHours: 4.0,
            workoutType: .running
        ),
        WorkoutTypeConfig(
            name: "Strength Training",
            minDuration: 45,
            codingHours: 8.0,
            workoutType: .strength
        ),
        WorkoutTypeConfig(
            name: "Long Workout",
            minDuration: 60,
            codingHours: 12.0,
            workoutType: .other
        ),
    ]

    // Find best matching config for a workout
    static func findBestMatch(
        for workoutType: WorkoutType, duration: Int, configs: [WorkoutTypeConfig] = defaultConfigs
    ) -> WorkoutTypeConfig? {
        let matchingType = configs.filter { config in
            config.workoutType == workoutType && duration >= config.minDuration
        }.sorted { $0.minDuration > $1.minDuration }  // Prefer higher requirements

        if let match = matchingType.first {
            return match
        }

        // Fallback to duration-based matching
        let durationMatches = configs.filter { duration >= $0.minDuration }
            .sorted { $0.minDuration > $1.minDuration }

        return durationMatches.first
    }
}

// MARK: - Enhanced Manual Workout Entry

struct EnhancedManualWorkoutEntry {
    var selectedConfig: WorkoutTypeConfig?
    var duration: Int = 30
    var calories: Int?
    var distance: Double?  // kilometers
    var startTime: Date = Date()

    var isValid: Bool {
        guard let config = selectedConfig else { return false }
        return duration >= config.minDuration && duration <= 480  // 5 minutes to 8 hours
    }

    var estimatedCredits: Int {
        guard let config = selectedConfig else { return 0 }

        // Calculate credits based on the selected config
        let baseCredits = config.codingMinutes

        // Apply bonus for longer workouts (similar to extension logic)
        if duration > config.minDuration * 2 {
            return Int(Double(baseCredits) * 1.5)
        }

        return baseCredits
    }

    func toWorkout() -> Workout {
        let endTime = startTime.addingTimeInterval(TimeInterval(duration * 60))

        return Workout(
            id: UUID().uuidString,
            type: selectedConfig?.workoutType ?? .other,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            calories: calories,
            heartRate: nil,
            distance: distance,
            source: .manual,
            creditsAwarded: nil,  // Backend will calculate based on user's settings
            verified: false,
            processed: nil
        )
    }
}
