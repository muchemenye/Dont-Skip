import SwiftUI

struct WorkoutsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @EnvironmentObject var healthKitManager: HealthKitManager

    @State private var showingWorkoutEntry = false
    @State private var selectedTimeframe: TimeFrame = .week

    enum TimeFrame: String, CaseIterable {
        case day = "Today"
        case week = "This Week"
        case month = "This Month"
        case all = "All Time"

        var hours: Int {
            switch self {
            case .day: return 24
            case .week: return 168
            case .month: return 720
            case .all: return 8760
            }
        }
    }

    private var filteredWorkouts: [Workout] {
        let cutoffDate =
            Calendar.current.date(byAdding: .hour, value: -selectedTimeframe.hours, to: Date())
            ?? Date()

        print("🔴 WorkoutsView - AppState workouts: \(appState.recentWorkouts.count)")
        print("🔴 WorkoutsView - HealthKit workouts: \(healthKitManager.recentWorkouts.count)")

        // Combine workouts from both AppState (API/manual) and HealthKitManager (local/mock)
        let allWorkouts = appState.recentWorkouts + healthKitManager.recentWorkouts
        print("🔴 WorkoutsView - Combined workouts: \(allWorkouts.count)")

        let filtered = allWorkouts.filter { $0.startTime >= cutoffDate }
        print("🔴 WorkoutsView - Filtered workouts: \(filtered.count)")

        return filtered
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Timeframe Picker
                Picker("Timeframe", selection: $selectedTimeframe) {
                    ForEach(TimeFrame.allCases, id: \.self) { timeframe in
                        Text(timeframe.rawValue).tag(timeframe)
                    }
                }
                .pickerStyle(SegmentedPickerStyle())
                .padding()

                // Stats Summary
                WorkoutStatsView(workouts: filteredWorkouts)

                // Workouts List
                if filteredWorkouts.isEmpty {
                    EmptyWorkoutsView(timeframe: selectedTimeframe.rawValue)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(filteredWorkouts) { workout in
                                WorkoutDetailCard(workout: workout)
                            }
                        }
                        .padding()
                    }
                }

                Spacer()
            }
            .navigationTitle("Workouts")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showingWorkoutEntry = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .refreshable {
                loadWorkouts()
            }
        }
        .sheet(isPresented: $showingWorkoutEntry) {
            WorkoutEntryView()
        }
        .onAppear {
            loadWorkouts()
        }
        .onReceive(
            NotificationCenter.default.publisher(for: NSNotification.Name("ShowWorkoutEntry"))
        ) { _ in
            showingWorkoutEntry = true
        }
    }

    private func loadWorkouts() {
        print("🔴 loadWorkouts called - HealthKit isAuthorized: \(healthKitManager.isAuthorized)")
        print(
            "🔴 loadWorkouts - Current HealthKit workouts: \(healthKitManager.recentWorkouts.count)")

        // Skip API calls for guest users
        let isGuestUser = appState.isAuthenticated && appState.currentUser == nil

        if !isGuestUser {
            // Load from API for authenticated users
            apiService.getRecentWorkouts(hours: selectedTimeframe.hours)
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            print("Workout loading failed: \(error.localizedDescription)")
                        }
                    },
                    receiveValue: { workouts in
                        appState.recentWorkouts = workouts
                    }
                )
                .store(in: &appState.cancellables)
        }

        // Load from HealthKit if authorized (works for both guest and authenticated users)
        if healthKitManager.isAuthorized {
            healthKitManager.fetchRecentWorkoutsWithSimulator(days: selectedTimeframe.hours / 24)
        }
    }
}

struct WorkoutStatsView: View {
    let workouts: [Workout]

    private var totalWorkouts: Int {
        workouts.count
    }

    private var totalDuration: Int {
        workouts.reduce(0) { $0 + $1.duration }
    }

    private var totalCredits: Int {
        workouts.reduce(0) { $0 + $1.creditsEarned }
    }

    private var totalCalories: Int {
        workouts.compactMap { $0.calories }.reduce(0, +)
    }

    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 20) {
                StatCard(
                    title: "Workouts",
                    value: "\(totalWorkouts)",
                    icon: "figure.run",
                    color: .blue
                )

                StatCard(
                    title: "Duration",
                    value: "\(totalDuration)m",
                    icon: "clock",
                    color: .orange
                )

                StatCard(
                    title: "Credits",
                    value: "\(totalCredits)m",
                    icon: "star.fill",
                    color: .green
                )

                if totalCalories > 0 {
                    StatCard(
                        title: "Calories",
                        value: "\(totalCalories)",
                        icon: "flame.fill",
                        color: Color(.systemRed)
                    )
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.headline)
                .fontWeight(.bold)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .cornerRadius(8)
    }
}

struct WorkoutDetailCard: View {
    let workout: Workout

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                // Workout type and time
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(workout.type.emoji)
                            .font(.title2)

                        Text(workout.type.displayName)
                            .font(.headline)
                            .fontWeight(.semibold)

                        Spacer()

                        if workout.verified {
                            Image(systemName: "checkmark.seal.fill")
                                .foregroundColor(Color(.systemGreen))
                                .font(.caption)
                        }
                    }

                    Text(workout.startTime, style: .date)
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Text("\(workout.startTime, style: .time) - \(workout.endTime, style: .time)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Stats
            HStack(spacing: 20) {
                WorkoutStat(title: "Duration", value: workout.durationString, icon: "clock")

                if let calories = workout.calories {
                    WorkoutStat(title: "Calories", value: "\(calories)", icon: "flame")
                }

                if let distance = workout.distance {
                    WorkoutStat(
                        title: "Distance", value: String(format: "%.1f km", distance / 1000),
                        icon: "location")
                }

                Spacer()

                VStack {
                    Text("+\(workout.creditsEarned)")
                        .font(.headline)
                        .fontWeight(.bold)
                        .foregroundColor(Color(.systemGreen))

                    Text("credits")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            // Source
            HStack {
                Text("Source: \(workout.source.displayName)")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

struct WorkoutStat: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(.secondary)

            Text(value)
                .font(.caption)
                .fontWeight(.medium)

            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

struct EmptyWorkoutsView: View {
    let timeframe: String

    var body: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "figure.run.circle")
                .font(.system(size: 60))
                .foregroundColor(Color(.systemGray))

            VStack(spacing: 8) {
                Text("No workouts \(timeframe.lowercased())")
                    .font(.headline)
                    .fontWeight(.medium)

                Text("Record a workout or connect your fitness apps to start earning credits")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            Spacer()
        }
        .padding()
    }
}
