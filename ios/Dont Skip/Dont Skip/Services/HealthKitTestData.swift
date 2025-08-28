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

    /// Evidence-based mock workouts matching real Apple Health data structure
    static func generateMockWorkouts() -> [MockHKWorkout] {
        let now = Date()
        let calendar = Calendar.current

        return [
            // Morning walk (light movement) - 15 minutes -> 120 minutes coding
            MockHKWorkout(
                id: "mock-walk-1",
                workoutActivityType: .walking,
                startDate: calendar.date(byAdding: .hour, value: -8, to: now)!,
                endDate: calendar.date(
                    byAdding: .hour, value: -8,
                    to: calendar.date(byAdding: .minute, value: -15, to: now)!)!,
                duration: 15 * 60,  // 15 minutes
                totalEnergyBurned: 45.0,  // calories
                totalDistance: 1200.0  // meters
            ),

            // Bike commute (moderate cardio) - 25 minutes -> 300 minutes coding
            MockHKWorkout(
                id: "mock-cycling-1",
                workoutActivityType: .cycling,
                startDate: calendar.date(byAdding: .hour, value: -6, to: now)!,
                endDate: calendar.date(
                    byAdding: .hour, value: -6,
                    to: calendar.date(byAdding: .minute, value: -25, to: now)!)!,
                duration: 30 * 60,  // 30 minutes
                totalEnergyBurned: 220.0,  // calories
                totalDistance: 8500.0  // meters
            ),

            // Quick strength session - 20 minutes -> 300 minutes coding
            MockHKWorkout(
                id: "mock-strength-1",
                workoutActivityType: .functionalStrengthTraining,
                startDate: calendar.date(byAdding: .hour, value: -4, to: now)!,
                endDate: calendar.date(
                    byAdding: .hour, value: -4,
                    to: calendar.date(byAdding: .minute, value: -20, to: now)!)!,
                duration: 20 * 60,  // 20 minutes
                totalEnergyBurned: 180.0,  // calories
                totalDistance: nil
            ),

            // Lunch run (cardio) - 25 minutes -> 300 minutes coding
            MockHKWorkout(
                id: "mock-run-1",
                workoutActivityType: .running,
                startDate: calendar.date(byAdding: .hour, value: -2, to: now)!,
                endDate: calendar.date(
                    byAdding: .hour, value: -2,
                    to: calendar.date(byAdding: .minute, value: -25, to: now)!)!,
                duration: 25 * 60,  // 25 minutes
                totalEnergyBurned: 280.0,  // calories
                totalDistance: 4200.0  // meters
            ),

            // Yoga session (light movement) - 10 minutes -> 100 minutes coding
            MockHKWorkout(
                id: "mock-yoga-1",
                workoutActivityType: .yoga,
                startDate: calendar.date(byAdding: .hour, value: -1, to: now)!,
                endDate: calendar.date(
                    byAdding: .hour, value: -1,
                    to: calendar.date(byAdding: .minute, value: -10, to: now)!)!,
                duration: 10 * 60,  // 10 minutes
                totalEnergyBurned: 65.0,  // calories
                totalDistance: nil
            ),

            // HIIT session (high intensity) - 12 minutes -> 216 minutes coding
            MockHKWorkout(
                id: "mock-hiit-1",
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
