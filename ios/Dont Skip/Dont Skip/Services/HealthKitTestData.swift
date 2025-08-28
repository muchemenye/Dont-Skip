import Foundation
import HealthKit

// MARK: - Mock Data Structure
struct MockHKWorkout {
    let id: String
    let workoutActivityType: HKWorkoutActivityType
    let startDate: Date
    let endDate: Date
    let duration: TimeInterval  // in seconds
    let totalEnergyBurned: Double?  // calories
    let totalDistance: Double?  // meters

    /// Computed property to match HKWorkout's duration calculation
    var durationInMinutes: Int {
        return Int(duration / 60)
    }
}

// MARK: - Test Data Provider
class HealthKitTestData {

    /// Evidence-based mock workouts with realistic time distribution
    static func generateMockWorkouts() -> [MockHKWorkout] {
        let now = Date()
        let calendar = Calendar.current

        return [
            // TODAY - Morning walk (light movement) - 15 minutes -> 120 minutes coding
            MockHKWorkout(
                id: "mock-walk-today",
                workoutActivityType: .walking,
                startDate: calendar.date(byAdding: .hour, value: -8, to: now)!,
                endDate: calendar.date(
                    byAdding: .hour, value: -8,
                    to: calendar.date(byAdding: .minute, value: -15, to: now)!)!,
                duration: 15 * 60,  // 15 minutes
                totalEnergyBurned: 45.0,  // calories
                totalDistance: 1200.0  // meters
            ),

            // THIS WEEK - Bike commute (moderate cardio) - 30 minutes -> 360 minutes coding
            MockHKWorkout(
                id: "mock-cycling-week",
                workoutActivityType: .cycling,
                startDate: calendar.date(byAdding: .day, value: -3, to: now)!,
                endDate: calendar.date(
                    byAdding: .day, value: -3,
                    to: calendar.date(byAdding: .minute, value: -30, to: now)!)!,
                duration: 30 * 60,  // 30 minutes
                totalEnergyBurned: 220.0,  // calories
                totalDistance: 8500.0  // meters
            ),

            // THIS MONTH - Strength session - 20 minutes -> 300 minutes coding
            MockHKWorkout(
                id: "mock-strength-month",
                workoutActivityType: .functionalStrengthTraining,
                startDate: calendar.date(byAdding: .day, value: -12, to: now)!,
                endDate: calendar.date(
                    byAdding: .day, value: -12,
                    to: calendar.date(byAdding: .minute, value: -20, to: now)!)!,
                duration: 20 * 60,  // 20 minutes
                totalEnergyBurned: 180.0,  // calories
                totalDistance: nil
            ),

            // LAST MONTH - Long run (cardio) - 45 minutes -> 540 minutes coding
            MockHKWorkout(
                id: "mock-run-lastmonth",
                workoutActivityType: .running,
                startDate: calendar.date(byAdding: .month, value: -1, to: now)!,
                endDate: calendar.date(
                    byAdding: .month, value: -1,
                    to: calendar.date(byAdding: .minute, value: -45, to: now)!)!,
                duration: 45 * 60,  // 45 minutes
                totalEnergyBurned: 420.0,  // calories
                totalDistance: 7200.0  // meters
            ),

            // TWO MONTHS AGO - Yoga session (mindful movement) - 30 minutes -> 300 minutes coding
            MockHKWorkout(
                id: "mock-yoga-twomonths",
                workoutActivityType: .yoga,
                startDate: calendar.date(byAdding: .month, value: -2, to: now)!,
                endDate: calendar.date(
                    byAdding: .month, value: -2,
                    to: calendar.date(byAdding: .minute, value: -30, to: now)!)!,
                duration: 30 * 60,  // 30 minutes
                totalEnergyBurned: 120.0,  // calories
                totalDistance: nil
            ),

            // TODAY - HIIT session (high intensity) - 12 minutes -> 216 minutes coding
            MockHKWorkout(
                id: "mock-hiit-today",
                workoutActivityType: .highIntensityIntervalTraining,
                startDate: calendar.date(byAdding: .minute, value: -30, to: now)!,
                endDate: calendar.date(byAdding: .minute, value: -18, to: now)!,
                duration: 12 * 60,  // 12 minutes
                totalEnergyBurned: 195.0,  // calories
                totalDistance: nil
            ),
        ]
    }

    /// Check if running in simulator
    static var isRunningInSimulator: Bool {
        #if targetEnvironment(simulator)
            return true
        #else
            return false
        #endif
    }
}

// MARK: - Simulator Detection Utilities
class SimulatorHelper {

    /// Checks if running in simulator
    static func isRunningInSimulator() -> Bool {
        #if targetEnvironment(simulator)
            return true
        #else
            return false
        #endif
    }
}
