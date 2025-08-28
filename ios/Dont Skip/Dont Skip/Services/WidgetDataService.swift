import Foundation
import WidgetKit

/// Simple service to push data from main app to widget
class WidgetDataService {
    static let shared = WidgetDataService()

    private let userDefaults = UserDefaults(suiteName: "group.com.dontskip.app")

    private init() {}

    /// Push current user data to widget
    func updateWidget(
        availableCredits: Int,
        emergencyCredits: Int,
        workoutCount: Int,
        todaysCodingTime: Double,
        isLocked: Bool
    ) {
        guard let userDefaults = userDefaults else {
            print("WidgetDataService: Failed to get userDefaults")
            return
        }

        // Simple key-value storage for widget
        userDefaults.set(availableCredits, forKey: "widget_availableCredits")
        userDefaults.set(emergencyCredits, forKey: "widget_emergencyCredits")
        userDefaults.set(workoutCount, forKey: "widget_workoutCount")
        userDefaults.set(todaysCodingTime, forKey: "widget_todaysCodingTime")
        userDefaults.set(isLocked, forKey: "widget_isLocked")
        userDefaults.set(Date(), forKey: "widget_lastUpdate")

        print(
            "WidgetDataService: Updated widget data - Credits: \(availableCredits), Workouts: \(workoutCount), Locked: \(isLocked)"
        )

        // Force widget refresh
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// Simple method to update widget with all necessary data
    func updateWidgetFromMainApp(
        availableCredits: Int,
        emergencyCredits: Int,
        workoutCount: Int,
        todaysCodingTime: Double
    ) {
        updateWidget(
            availableCredits: availableCredits,
            emergencyCredits: emergencyCredits,
            workoutCount: workoutCount,
            todaysCodingTime: todaysCodingTime,
            isLocked: availableCredits <= 0
        )
    }

    /// Clear widget data (for logout)
    func clearWidgetData() {
        guard let userDefaults = userDefaults else { return }

        userDefaults.removeObject(forKey: "widget_availableCredits")
        userDefaults.removeObject(forKey: "widget_emergencyCredits")
        userDefaults.removeObject(forKey: "widget_workoutCount")
        userDefaults.removeObject(forKey: "widget_todaysCodingTime")
        userDefaults.removeObject(forKey: "widget_isLocked")
        userDefaults.removeObject(forKey: "widget_lastUpdate")

        WidgetCenter.shared.reloadAllTimelines()
    }
}
