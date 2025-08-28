import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @EnvironmentObject var healthKitManager: HealthKitManager
    @EnvironmentObject var integrationManager: IntegrationManager
    @EnvironmentObject var storeKitManager: StoreKitManager
    @EnvironmentObject var premiumGateService: PremiumGateService

    @State private var showingWorkoutEntry = false
    @State private var isRefreshing = false

    private var isGuestUser: Bool {
        appState.isAuthenticated && appState.currentUser == nil
    }

    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(spacing: 20) {
                    // Guest user sign-in prompt
                    if appState.isAuthenticated && appState.currentUser == nil {
                        GuestUserPromptCard()
                    }

                    // Credit Balance Card
                    CreditBalanceCard()

                    // Quick Actions
                    QuickActionsCard()

                    // Today's Activity
                    TodayActivityCard()

                    // Premium Status / Upgrade (only for authenticated users)
                    if !isGuestUser && !storeKitManager.isPremiumUser {
                        PremiumUpgradeCard()
                    }

                    // Connected Integrations
                    ConnectedIntegrationsCard()

                    // Recent Workouts
                    RecentWorkoutsCard()
                }
                .padding()
            }
            .navigationTitle("Dashboard")
            .refreshable {
                await refreshData()
            }
            .onAppear {
                loadDashboardData()
            }
            .sheet(isPresented: $showingWorkoutEntry) {
                WorkoutEntryView()
            }
            .sheet(isPresented: $premiumGateService.showingPaywall) {
                PremiumPaywallView()
                    .environmentObject(storeKitManager)
            }
            .onChange(of: showingWorkoutEntry) { _, isShowing in
                // Prevent multiple sheets from showing simultaneously
                if isShowing {
                    premiumGateService.showingPaywall = false
                }
            }
            .onChange(of: premiumGateService.showingPaywall) { _, isShowing in
                // Prevent multiple sheets from showing simultaneously
                if isShowing {
                    showingWorkoutEntry = false
                }
            }
        }
    }

    private func loadDashboardData() {
        // Skip API calls for guest users
        let isGuestUser = appState.isAuthenticated && appState.currentUser == nil

        if !isGuestUser {
            // Load credit balance (gracefully handle backend connection issues)
            apiService.getCreditBalance()
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            print("Backend connection issue: \(error.localizedDescription)")
                            // Don't show error to user for connection issues - app should work offline
                        }
                    },
                    receiveValue: { balance in
                        appState.updateCreditBalance(balance)
                    }
                )
                .store(in: &appState.cancellables)

            // Load recent workouts (gracefully handle backend connection issues)
            apiService.getRecentWorkouts()
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            print("Backend connection issue: \(error.localizedDescription)")
                        }
                    },
                    receiveValue: { workouts in
                        appState.recentWorkouts = workouts
                    }
                )
                .store(in: &appState.cancellables)

            // Load integrations (gracefully handle backend connection issues)
            integrationManager.loadIntegrations()
        }

        // Fetch HealthKit workouts if authorized (this works offline for both guest and signed-in users)
        if healthKitManager.isAuthorized {
            healthKitManager.fetchRecentWorkouts()
        }
    }

    private func getTodaysCodingTime() -> Double {
        // TODO: Calculate actual coding time for today based on app usage
        // For now, return a placeholder value
        return 6.2
    }

    @MainActor
    private func refreshData() async {
        isRefreshing = true
        defer { isRefreshing = false }

        loadDashboardData()

        // Add a small delay for better UX
        try? await Task.sleep(nanoseconds: 500_000_000)
    }
}

struct CreditBalanceCard: View {
    @EnvironmentObject var appState: AppState

    private var isGuestUser: Bool {
        appState.isAuthenticated && appState.currentUser == nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "clock.fill")
                    .foregroundColor(Color(.systemBlue))
                    .font(.title2)
                Text("Coding Credits")
                    .font(.headline)
                    .fontWeight(.semibold)
                Spacer()
            }

            if isGuestUser {
                // Guest user experience - show local/offline functionality
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .bottom, spacing: 8) {
                        Text("--")
                            .font(.system(size: 48, weight: .bold, design: .rounded))
                            .foregroundColor(.secondary)

                        Text("minutes")
                            .font(.title2)
                            .foregroundColor(.secondary)
                            .padding(.bottom, 8)

                        Spacer()
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Sign in to sync credits across devices")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Text("Guest mode: Workouts are tracked locally only")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            } else if let balance = appState.creditBalance {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .bottom, spacing: 8) {
                        Text("\(balance.availableCredits)")
                            .font(.system(size: 48, weight: .bold, design: .rounded))
                            .foregroundColor(.primary)

                        Text("minutes")
                            .font(.title2)
                            .foregroundColor(.secondary)
                            .padding(.bottom, 8)

                        Spacer()
                    }

                    HStack {
                        Text("\(balance.availableHours, specifier: "%.1f") hours available")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Spacer()

                        if balance.emergencyCredits > 0 {
                            Text("+ \(balance.emergencyCredits) emergency")
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color(.systemOrange).opacity(0.2))
                                .foregroundColor(Color(.systemOrange))
                                .cornerRadius(8)
                        }
                    }

                    // Progress bar
                    ProgressView(
                        value: Double(balance.availableCredits),
                        total: Double(Config.maxDailyCredits)
                    )
                    .progressViewStyle(LinearProgressViewStyle(tint: Color(.systemBlue)))
                    .scaleEffect(y: 2)
                }
            } else {
                HStack {
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Loading balance...")
                        .foregroundColor(.secondary)
                }
                .frame(height: 80)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct QuickActionsCard: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var healthKitManager: HealthKitManager
    @State private var showingWorkoutEntry = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Actions")
                .font(.headline)
                .fontWeight(.semibold)

            LazyVGrid(
                columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                ], spacing: 12
            ) {
                QuickActionButton(
                    title: "Record Workout",
                    icon: "plus.circle.fill",
                    color: Color(.systemGreen)
                ) {
                    showingWorkoutEntry = true
                }

                QuickActionButton(
                    title: "Sync Data",
                    icon: "arrow.clockwise.circle.fill",
                    color: Color(.systemBlue)
                ) {
                    // Trigger sync for all connected integrations
                    healthKitManager.fetchRecentWorkouts()
                    // Could also trigger API sync here
                }

                QuickActionButton(
                    title: "View History",
                    icon: "chart.line.uptrend.xyaxis.circle.fill",
                    color: Color(.systemPurple)
                ) {
                    appState.selectedTab = 1
                }

                QuickActionButton(
                    title: "Integrations",
                    icon: "link.circle.fill",
                    color: Color(.systemOrange)
                ) {
                    appState.selectedTab = 2
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
        .sheet(isPresented: $showingWorkoutEntry) {
            WorkoutEntryView()
        }
    }
}

struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)

                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .multilineTextAlignment(.center)
                    .foregroundColor(.primary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(Color(.systemBackground))
            .cornerRadius(12)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct TodayActivityCard: View {
    @EnvironmentObject var appState: AppState

    private var isGuestUser: Bool {
        appState.isAuthenticated && appState.currentUser == nil
    }

    private var todayWorkouts: [Workout] {
        let today = Calendar.current.startOfDay(for: Date())
        return appState.recentWorkouts.filter { workout in
            Calendar.current.isDate(workout.startTime, inSameDayAs: today)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Today's Activity")
                .font(.headline)
                .fontWeight(.semibold)

            if todayWorkouts.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "figure.run.circle")
                        .font(.system(size: 40))
                        .foregroundColor(Color(.systemGray))

                    Text("No workouts today")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Text(
                        isGuestUser
                            ? "Record a workout to track your activity!"
                            : "Record a workout to start earning credits!"
                    )
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical)
            } else {
                VStack(spacing: 12) {
                    HStack {
                        VStack(alignment: .leading) {
                            Text("\(todayWorkouts.count)")
                                .font(.title)
                                .fontWeight(.bold)
                            Text("Workouts")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        if !isGuestUser {
                            VStack(alignment: .trailing) {
                                Text("\(todayWorkouts.reduce(0) { $0 + $1.creditsEarned })")
                                    .font(.title)
                                    .fontWeight(.bold)
                                    .foregroundColor(Color(.systemGreen))
                                Text("Credits Earned")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } else {
                            VStack(alignment: .trailing) {
                                Text("\(todayWorkouts.reduce(0) { $0 + $1.duration })")
                                    .font(.title)
                                    .fontWeight(.bold)
                                    .foregroundColor(Color(.systemBlue))
                                Text("Minutes")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }

                    ForEach(todayWorkouts.prefix(3)) { workout in
                        WorkoutRowView(workout: workout)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct ConnectedIntegrationsCard: View {
    @EnvironmentObject var integrationManager: IntegrationManager
    @EnvironmentObject var appState: AppState

    private var connectedIntegrations: [Integration] {
        integrationManager.integrations.filter { $0.isConnected }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Connected Apps")
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()

                if !connectedIntegrations.isEmpty {
                    Text("\(connectedIntegrations.count) connected")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            if connectedIntegrations.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "link.circle")
                        .font(.system(size: 40))
                        .foregroundColor(Color(.systemGray))

                    Text("No integrations connected")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Button("Connect Apps") {
                        appState.selectedTab = 2
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical)
            } else {
                LazyVGrid(
                    columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                        GridItem(.flexible()),
                    ], spacing: 12
                ) {
                    ForEach(connectedIntegrations.prefix(6)) { integration in
                        IntegrationMiniCard(integration: integration)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct IntegrationMiniCard: View {
    let integration: Integration

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: integration.iconName)
                .font(.title2)
                .foregroundColor(integration.systemColor)

            Text(integration.displayName)
                .font(.caption)
                .fontWeight(.medium)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .cornerRadius(8)
    }
}

struct RecentWorkoutsCard: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Recent Workouts")
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()

                if !appState.recentWorkouts.isEmpty {
                    Button("View All") {
                        appState.selectedTab = 1
                    }
                    .font(.caption)
                    .foregroundColor(Color(.systemBlue))
                }
            }

            if appState.recentWorkouts.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "figure.run.circle")
                        .font(.system(size: 40))
                        .foregroundColor(Color(.systemGray))

                    Text("No recent workouts")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Text("Connect your fitness apps or record workouts manually")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical)
            } else {
                LazyVStack(spacing: 12) {
                    ForEach(Array(appState.recentWorkouts.prefix(5))) { workout in
                        WorkoutRowView(workout: workout)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct GuestUserPromptCard: View {
    @EnvironmentObject var appState: AppState
    @State private var showingAuth = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "person.circle")
                    .foregroundColor(Color(.systemBlue))
                    .font(.title2)

                Text("Sign In for Full Features")
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()
            }

            Text(
                "Create an account to sync credits across devices, connect fitness apps, and access premium features"
            )
            .font(.subheadline)
            .foregroundColor(.secondary)

            Button("Sign In or Create Account") {
                showingAuth = true
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .padding()
        .background(
            LinearGradient(
                colors: [Color(.systemBlue).opacity(0.1), Color(.systemPurple).opacity(0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(.systemBlue).opacity(0.3), lineWidth: 1)
        )
        .sheet(isPresented: $showingAuth) {
            AuthenticationView()
        }
    }
}

struct PremiumUpgradeCard: View {
    @EnvironmentObject var premiumGateService: PremiumGateService

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Image(systemName: "crown.fill")
                    .foregroundColor(Color(.systemYellow))
                    .font(.title2)

                Text("Upgrade to Premium")
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()
            }

            Text("Unlock unlimited device sync, fitness app integrations, and advanced features")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Button("View Premium Features") {
                premiumGateService.showingPaywall = true
            }
            .buttonStyle(PrimaryButtonStyle())
        }
        .padding()
        .background(
            LinearGradient(
                colors: [Color(.systemYellow).opacity(0.1), Color(.systemOrange).opacity(0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color(.systemYellow).opacity(0.3), lineWidth: 1)
        )
    }
}

#Preview {
    DashboardView()
        .environmentObject(AppState())
        .environmentObject(APIService())
        .environmentObject(HealthKitManager())
        .environmentObject(
            IntegrationManager(apiService: APIService(), healthKitManager: HealthKitManager())
        )
        .environmentObject(StoreKitManager())
        .environmentObject(PremiumGateService(storeKitManager: StoreKitManager()))
}
