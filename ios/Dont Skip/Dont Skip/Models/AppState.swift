import Combine
import SwiftUI
import WidgetKit

class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var credits: Int = 0
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var creditBalance: CreditBalance?
    @Published var recentWorkouts: [Workout] = []
    @Published var selectedTab = 0
    @Published var showingWorkoutEntry = false

    var cancellables = Set<AnyCancellable>()

    init() {
        loadSavedState()
    }

    private func loadSavedState() {
        // Load saved authentication state
        if let savedAuth = UserDefaults.standard.data(forKey: "user_auth"),
            let user = try? JSONDecoder().decode(User.self, from: savedAuth)
        {
            self.currentUser = user
            self.isAuthenticated = true
        }

        // Load saved credits
        self.credits = UserDefaults.standard.integer(forKey: "user_credits")
    }

    func saveState() {
        if let user = currentUser,
            let userData = try? JSONEncoder().encode(user)
        {
            UserDefaults.standard.set(userData, forKey: "user_auth")
        }
        UserDefaults.standard.set(credits, forKey: "user_credits")
    }

    func signOut() {
        isAuthenticated = false
        currentUser = nil
        credits = 0
        creditBalance = nil
        recentWorkouts = []

        // Clear all UserDefaults keys related to user data
        UserDefaults.standard.removeObject(forKey: "user_auth")
        UserDefaults.standard.removeObject(forKey: "user_credits")
        UserDefaults.standard.removeObject(forKey: "auth_token")

        // Clear any cached user preferences/settings
        UserDefaults.standard.removeObject(forKey: "user_settings")
        UserDefaults.standard.removeObject(forKey: "last_sync_timestamp")
        UserDefaults.standard.removeObject(forKey: "cached_workout_data")

        // Clear any other cached authentication state
        UserDefaults.standard.removeObject(forKey: "device_id")
        UserDefaults.standard.removeObject(forKey: "backend_url")

        // Clear widget data using direct UserDefaults access
        let userDefaults = UserDefaults(suiteName: "group.com.dontskip.app")
        userDefaults?.removeObject(forKey: "widget_availableCredits")
        userDefaults?.removeObject(forKey: "widget_emergencyCredits")
        userDefaults?.removeObject(forKey: "widget_workoutCount")
        userDefaults?.removeObject(forKey: "widget_todaysCodingTime")
        userDefaults?.removeObject(forKey: "widget_isLocked")
        userDefaults?.removeObject(forKey: "widget_lastUpdate")
        WidgetCenter.shared.reloadAllTimelines()
    }

    func setAuthenticated(_ authenticated: Bool, user: User? = nil) {
        isAuthenticated = authenticated
        currentUser = user
        if authenticated {
            saveState()
        }
    }

    func setError(_ message: String) {
        errorMessage = message
    }

    func setLoading(_ loading: Bool) {
        isLoading = loading
    }

    func updateCreditBalance(_ balance: CreditBalance) {
        creditBalance = balance
        credits = balance.availableCredits

        // Update widget data directly
        updateWidget()
    }

    func addWorkout(_ workout: Workout) {
        recentWorkouts.insert(workout, at: 0)
        if recentWorkouts.count > 10 {
            recentWorkouts = Array(recentWorkouts.prefix(10))
        }

        // Update widget when workout is added
        if creditBalance != nil {
            updateWidget()
        }
    }

    private func updateWidget() {
        guard let userDefaults = UserDefaults(suiteName: "group.com.dontskip.app") else {
            return
        }

        if let balance = creditBalance {
            userDefaults.set(balance.availableCredits, forKey: "widget_availableCredits")
            userDefaults.set(balance.emergencyCredits, forKey: "widget_emergencyCredits")
            userDefaults.set(recentWorkouts.count, forKey: "widget_workoutCount")
            userDefaults.set(Date(), forKey: "widget_lastUpdate")
            userDefaults.synchronize()

            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    private func getTodaysCodingTime() -> Double {
        // TODO: Calculate actual coding time for today
        // For now return a placeholder
        return 6.2
    }

    func signIn(with user: User, token: String) {
        currentUser = user
        isAuthenticated = true
        UserDefaults.standard.set(token, forKey: "auth_token")
        saveState()
    }

    func updateUser(_ user: User) {
        currentUser = user
        saveState()
    }

    func clearError() {
        errorMessage = nil
    }

    var authToken: String? {
        return UserDefaults.standard.string(forKey: "auth_token")
    }

    var hasValidToken: Bool {
        return authToken != nil && !authToken!.isEmpty
    }
}
