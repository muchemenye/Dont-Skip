import AppIntents
import SwiftUI

// MARK: - Add Workout Intent

struct AddWorkoutIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Workout"
    static var description = IntentDescription("Quickly add a workout to earn coding credits.")

    static var openAppWhenRun: Bool = true

    @Parameter(title: "Workout Type")
    var workoutType: WorkoutTypeEntity?

    func perform() async throws -> some IntentResult {
        // This will open the app and navigate to the workout entry screen
        return .result()
    }
}

// MARK: - Sync Data Intent

struct SyncDataIntent: AppIntent {
    static var title: LocalizedStringResource = "Sync Data"
    static var description = IntentDescription(
        "Sync your latest workout data from connected fitness apps.")

    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Perform background sync
        let result = await performBackgroundSync()

        if result.success {
            return .result(
                dialog: IntentDialog(
                    "✅ Synced \(result.workoutsFound) workouts. You earned \(result.creditsEarned) minutes of coding time!"
                ))
        } else {
            return .result(dialog: IntentDialog("❌ Sync failed. Please open the app to try again."))
        }
    }

    private func performBackgroundSync() async -> SyncResult {
        // In a real implementation, this would:
        // 1. Check authentication status
        // 2. Call your API service to sync workouts
        // 3. Update local storage
        // 4. Return results

        // For now, return mock data
        return SyncResult(success: true, workoutsFound: 2, creditsEarned: 60)
    }
}

// MARK: - View Credits Intent

struct ViewCreditsIntent: AppIntent {
    static var title: LocalizedStringResource = "View Credits"
    static var description = IntentDescription("View your current coding credit balance.")

    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        // This will open the app and navigate to the credits view
        return .result()
    }
}

// MARK: - Supporting Types

struct WorkoutTypeEntity: AppEntity {
    let id: String
    let name: String
    let duration: Int
    let credits: Int

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Workout Type"

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name) (\(duration) min)")
    }

    static var defaultQuery = WorkoutTypeQuery()
}

struct WorkoutTypeQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [WorkoutTypeEntity] {
        return getWorkoutTypes().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [WorkoutTypeEntity] {
        return getWorkoutTypes()
    }

    private func getWorkoutTypes() -> [WorkoutTypeEntity] {
        return [
            WorkoutTypeEntity(id: "quick-stretch", name: "Quick Stretch", duration: 5, credits: 30),
            WorkoutTypeEntity(id: "cardio", name: "Cardio Session", duration: 20, credits: 120),
            WorkoutTypeEntity(
                id: "strength", name: "Strength Training", duration: 45, credits: 240),
            WorkoutTypeEntity(id: "walk", name: "Walk", duration: 15, credits: 60),
            WorkoutTypeEntity(id: "run", name: "Run", duration: 30, credits: 180),
        ]
    }
}

struct SyncResult {
    let success: Bool
    let workoutsFound: Int
    let creditsEarned: Int
}
