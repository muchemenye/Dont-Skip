import SwiftUI

struct WorkoutEntryView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.dismiss) private var dismiss

    @State private var workoutEntry = EnhancedManualWorkoutEntry()
    @State private var isLoading = false
    @State private var errorMessage: String?

    // Computed property to get workout configs from user settings or defaults
    private var workoutConfigs: [WorkoutTypeConfig] {
        // If user is authenticated and has custom workout types, use those
        if let user = appState.currentUser,
            let customWorkoutTypes = user.settings.workoutTypes,
            !customWorkoutTypes.isEmpty
        {

            // Convert CustomWorkoutType to WorkoutTypeConfig
            return customWorkoutTypes.map { customType in
                WorkoutTypeConfig(
                    name: customType.name,
                    minDuration: customType.minDuration,
                    codingHours: customType.codingHoursEarned,
                    workoutType: customType.workoutType
                )
            }
        } else {
            // Fall back to default configurations
            return WorkoutTypeConfig.defaultConfigs
        }
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 8) {
                        Image(systemName: "plus.circle.fill")
                            .font(.system(size: 60))
                            .foregroundColor(Color(.systemGreen))

                        Text("Record Workout")
                            .font(.title)
                            .fontWeight(.bold)

                        Text("Manually add a workout to earn coding credits")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top)

                    // Form
                    VStack(spacing: 20) {
                        // Workout Type Configuration
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Workout Type")
                                    .font(.headline)
                                    .fontWeight(.medium)

                                Spacer()

                                // Show source of workout types
                                if appState.currentUser?.settings.workoutTypes?.isEmpty == false {
                                    Text("Custom Types")
                                        .font(.caption)
                                        .foregroundColor(.blue)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 2)
                                        .background(Color.blue.opacity(0.1))
                                        .cornerRadius(4)
                                } else {
                                    Text("Default Types")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(workoutConfigs) { config in
                                        WorkoutConfigButton(
                                            config: config,
                                            isSelected: workoutEntry.selectedConfig?.id == config.id
                                        ) {
                                            workoutEntry.selectedConfig = config
                                            // Auto-adjust duration to minimum if needed
                                            if workoutEntry.duration < config.minDuration {
                                                workoutEntry.duration = config.minDuration
                                            }
                                        }
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }

                        // Duration
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Duration (minutes)")
                                    .font(.headline)
                                    .fontWeight(.medium)

                                if let config = workoutEntry.selectedConfig {
                                    Spacer()
                                    Text("Min: \(config.minDuration)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }

                            HStack {
                                TextField("30", value: $workoutEntry.duration, format: .number)
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                                    .keyboardType(.numberPad)

                                Text("minutes")
                                    .foregroundColor(.secondary)
                            }

                            if let config = workoutEntry.selectedConfig,
                                workoutEntry.duration < config.minDuration
                            {
                                Text(
                                    "Minimum \(config.minDuration) minutes required for \(config.name)"
                                )
                                .font(.caption)
                                .foregroundColor(Color(.systemOrange))
                            }
                        }

                        // Optional fields
                        VStack(alignment: .leading, spacing: 16) {
                            Text("Optional Details")
                                .font(.headline)
                                .fontWeight(.medium)

                            // Calories
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Calories Burned")
                                    .font(.subheadline)
                                    .fontWeight(.medium)

                                HStack {
                                    TextField(
                                        "Optional", value: $workoutEntry.calories, format: .number
                                    )
                                    .textFieldStyle(RoundedBorderTextFieldStyle())
                                    .keyboardType(.numberPad)

                                    Text("calories")
                                        .foregroundColor(.secondary)
                                }
                            }

                            // Distance (for applicable workout types)
                            if let config = workoutEntry.selectedConfig,
                                [.running, .cycling, .walking].contains(config.workoutType)
                            {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Distance")
                                        .font(.subheadline)
                                        .fontWeight(.medium)

                                    HStack {
                                        TextField(
                                            "Optional", value: $workoutEntry.distance,
                                            format: .number
                                        )
                                        .textFieldStyle(RoundedBorderTextFieldStyle())
                                        .keyboardType(.decimalPad)

                                        Text("km")
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }

                            // Start Time
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Start Time")
                                    .font(.subheadline)
                                    .fontWeight(.medium)

                                DatePicker(
                                    "Start Time",
                                    selection: $workoutEntry.startTime,
                                    displayedComponents: [.date, .hourAndMinute]
                                )
                                .datePickerStyle(CompactDatePickerStyle())
                            }
                        }

                        // Credits Preview
                        EnhancedCreditPreviewCard(workoutEntry: workoutEntry)

                        if let errorMessage = errorMessage {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundColor(Color(.systemRed))
                                .padding(.horizontal)
                        }

                        // Save Button
                        Button("Save Workout") {
                            saveWorkout()
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(!workoutEntry.isValid || isLoading)

                        // Custom workout types info
                        if appState.currentUser?.settings.workoutTypes?.isEmpty != false {
                            VStack(spacing: 8) {
                                HStack {
                                    Image(systemName: "info.circle")
                                        .foregroundColor(.blue)
                                    Text("Want custom workout types?")
                                        .font(.subheadline)
                                        .fontWeight(.medium)
                                    Spacer()
                                }

                                Text(
                                    "Configure custom workout types in VS Code extension settings to have them sync here automatically."
                                )
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.leading)
                            }
                            .padding()
                            .background(Color.blue.opacity(0.05))
                            .cornerRadius(8)
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .navigationTitle("Add Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .overlay {
            if isLoading {
                Color(.systemBackground).opacity(0.3)
                    .ignoresSafeArea()

                ProgressView("Saving workout...")
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(8)
            }
        }
        .onAppear {
            // Log which workout types are being used
            if let user = appState.currentUser,
                let customWorkoutTypes = user.settings.workoutTypes,
                !customWorkoutTypes.isEmpty
            {
                print("🎯 Using custom workout types from VS Code extension:")
                for workoutType in customWorkoutTypes {
                    print(
                        "   - \(workoutType.name): \(workoutType.minDuration)min → \(Int(workoutType.codingHoursEarned * 60))min coding"
                    )
                }
            } else {
                print("📋 Using default workout type configurations")
            }
        }
    }

    private func saveWorkout() {
        errorMessage = nil
        isLoading = true

        let workout = workoutEntry.toWorkout()

        apiService.addManualWorkout(workout)
            .sink(
                receiveCompletion: { completion in
                    isLoading = false
                    if case .failure(let error) = completion {
                        errorMessage = error.localizedDescription
                    }
                },
                receiveValue: { savedWorkout in
                    appState.addWorkout(savedWorkout)
                    dismiss()
                }
            )
            .store(in: &appState.cancellables)
    }
}

struct WorkoutConfigButton: View {
    let config: WorkoutTypeConfig
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Text(config.workoutType.emoji)
                    .font(.title3)

                Text(config.name)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)

                Text(config.displayDescription)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            .frame(width: 90, height: 90)
            .background(isSelected ? Color(.systemBlue).opacity(0.2) : Color(.systemGray6))
            .foregroundColor(isSelected ? .blue : .primary)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color(.systemBlue) : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct EnhancedCreditPreviewCard: View {
    let workoutEntry: EnhancedManualWorkoutEntry

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "clock.fill")
                    .foregroundColor(Color(.systemGreen))
                Text("Credits You'll Earn")
                    .font(.headline)
                    .fontWeight(.medium)
                Spacer()
            }

            if let config = workoutEntry.selectedConfig {
                HStack {
                    VStack(alignment: .leading) {
                        Text("\(workoutEntry.estimatedCredits)")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(Color(.systemGreen))
                        Text("minutes of coding time")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    VStack(alignment: .trailing) {
                        Text(config.name)
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Text("Based on your workout type")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                if workoutEntry.duration > config.minDuration * 2 {
                    HStack {
                        Image(systemName: "flame.fill")
                            .foregroundColor(Color(.systemOrange))
                        Text("Bonus for extra long workout!")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(Color(.systemOrange))
                        Spacer()
                    }
                }
            } else {
                VStack {
                    Text("Select a workout type")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("to see estimated credits")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 8)
            }
        }
        .padding()
        .background(Color(.systemGreen).opacity(0.1))
        .cornerRadius(12)
    }
}

#Preview {
    WorkoutEntryView()
        .environmentObject(AppState())
        .environmentObject(APIService())
        .environmentObject(HealthKitManager())
        .environmentObject(StoreKitManager())
        .environmentObject(PremiumGateService(storeKitManager: StoreKitManager()))
}
