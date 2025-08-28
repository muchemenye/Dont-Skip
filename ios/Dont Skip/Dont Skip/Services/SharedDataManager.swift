import Foundation

// This class should use the main app's models directly
// All models (CreditBalance, Workout, WorkoutType, etc.) are defined in WorkoutModels.swift

class SharedDataManager {
    static let shared = SharedDataManager()
    
    private let userDefaults = UserDefaults(suiteName: "group.com.dontskip.app")
    
    private init() {}
    
    // MARK: - Credit Data
    
    func getCreditBalance() -> CreditBalance? {
        guard let userDefaults = userDefaults,
              let data = userDefaults.data(forKey: "creditBalance") else {
            return nil
        }
        
        return try? JSONDecoder().decode(CreditBalance.self, from: data)
    }
    
    func saveCreditBalance(_ balance: CreditBalance) {
        guard let userDefaults = userDefaults,
              let data = try? JSONEncoder().encode(balance) else {
            return
        }
        
        userDefaults.set(data, forKey: "creditBalance")
        
        // Also update widget data whenever credit balance is saved
        updateWidgetData()
    }
    
    // MARK: - Workout Data
    
    func getRecentWorkouts() -> [Workout] {
        guard let userDefaults = userDefaults,
              let data = userDefaults.data(forKey: "recentWorkouts") else {
            return []
        }
        
        return (try? JSONDecoder().decode([Workout].self, from: data)) ?? []
    }
    
    func saveRecentWorkouts(_ workouts: [Workout]) {
        guard let userDefaults = userDefaults,
              let data = try? JSONEncoder().encode(workouts) else {
            return
        }
        
        userDefaults.set(data, forKey: "recentWorkouts")
    }
    
    // MARK: - Convenience Methods
    
    func addWorkout(duration: Int, type: WorkoutType = .other, source: WorkoutSource = .manual) {
        let workout = Workout(
            id: UUID().uuidString,
            type: type,
            startTime: Date().addingTimeInterval(-Double(duration * 60)),
            endTime: Date(),
            duration: duration,
            calories: Optional<Int>.none,
            heartRate: Optional<HeartRateData>.none,
            distance: Optional<Double>.none,
            source: source,
            creditsAwarded: duration * 2,
            verified: true,
            processed: true
        )
        
        var workouts = getRecentWorkouts()
        workouts.insert(workout, at: 0)
        
        // Keep only last 10 workouts for widget
        if workouts.count > 10 {
            workouts = Array(workouts.prefix(10))
        }
        
        saveRecentWorkouts(workouts)
        
        // Update credits (simplified calculation)
        let creditsEarned = duration * 2 // 2 minutes of coding per minute of workout
        if let balance = getCreditBalance() {
            let updatedBalance = CreditBalance(
                availableCredits: balance.availableCredits + creditsEarned,
                emergencyCredits: balance.emergencyCredits,
                totalEarned: balance.totalEarned + creditsEarned,
                totalSpent: balance.totalSpent,
                lastUpdated: Date()
            )
            saveCreditBalance(updatedBalance)
        } else {
            let newBalance = CreditBalance(
                availableCredits: creditsEarned,
                emergencyCredits: 30, // 30 minute emergency credits
                totalEarned: creditsEarned,
                totalSpent: 0,
                lastUpdated: Date()
            )
            saveCreditBalance(newBalance)
        }
    }
    
    func getTodaysCodingTime() -> Double {
        // This would normally track actual coding time
        // For widget display purposes, return a sample value
        return 6.2
    }
    
    func isLocked() -> Bool {
        guard let balance = getCreditBalance() else { return true }
        return balance.availableCredits <= 0
    }
    
    // MARK: - Widget Data
    
    func updateWidgetData() {
        guard let userDefaults = userDefaults else { return }
        
        if let balance = getCreditBalance() {
            userDefaults.set(balance.availableCredits, forKey: "widget_availableCredits")
            userDefaults.set(balance.emergencyCredits, forKey: "widget_emergencyCredits")
        }
        
        userDefaults.set(getTodaysCodingTime(), forKey: "todaysCodingTime")
        userDefaults.set(getRecentWorkouts().count, forKey: "widget_workoutCount")
        userDefaults.set(Date(), forKey: "widget_lastUpdate")
    }
    
    // MARK: - Manual Sync for Premium Users
    
    func syncDataManually() async -> Bool {
        // This would normally sync with backend API
        // For now, just update the widget data and return success
        updateWidgetData()
        return true
    }
    
    // MARK: - Quick Workout Addition
    
    func addQuickWorkout() {
        // Use the existing addWorkout method with default parameters
        // This ensures consistency with the main models
        addWorkout(duration: 30) // Uses default type: .other, source: .manual
    }
}
