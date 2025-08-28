import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @EnvironmentObject var healthKitManager: HealthKitManager
    @EnvironmentObject var storeKitManager: StoreKitManager
    @EnvironmentObject var premiumGateService: PremiumGateService

    @State private var showingSignOutAlert = false
    @State private var showingDeleteAccountAlert = false
    @State private var showingPremiumPaywall = false
    @State private var showingAuthView = false
    @State private var showingProfileManagement = false

    private var isGuestUser: Bool {
        appState.isAuthenticated && appState.currentUser == nil
    }

    private var shouldShowPremiumFeatures: Bool {
        // Only show premium features if:
        // 1. User is authenticated (not guest)
        // 2. User is actually premium
        // 3. We have a valid current user object
        return appState.isAuthenticated && appState.currentUser != nil
            && storeKitManager.isPremiumUser
    }

    var body: some View {
        NavigationView {
            List {
                // Profile Section
                Section {
                    Button {
                        showingProfileManagement = true
                    } label: {
                        ProfileRow()
                    }
                    .buttonStyle(PlainButtonStyle())
                } header: {
                    Text("Profile")
                }

                // Premium Section (only for authenticated users)
                if !isGuestUser {
                    Section {
                        if shouldShowPremiumFeatures {
                            PremiumStatusRow()
                        } else {
                            Button {
                                showingPremiumPaywall = true
                            } label: {
                                HStack(spacing: 16) {
                                    Image(systemName: "crown.fill")
                                        .font(.title3)
                                        .foregroundColor(Color(.systemYellow))
                                        .frame(width: 24)

                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("View Premium Features")
                                            .font(.body)
                                            .foregroundColor(.primary)

                                        Text("Unlock unlimited sync & integrations")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }

                                    Spacer()

                                    Image(systemName: "chevron.right")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                .padding(.vertical, 4)
                            }
                            .buttonStyle(PlainButtonStyle())
                        }
                    } header: {
                        Text("Premium")
                    }
                }

                // Guest user sign-in prompt
                if isGuestUser {
                    Section {
                        Button {
                            showingAuthView = true
                        } label: {
                            HStack(spacing: 16) {
                                Image(systemName: "person.circle")
                                    .font(.title3)
                                    .foregroundColor(Color(.systemBlue))
                                    .frame(width: 24)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Sign In or Create Account")
                                        .font(.body)
                                        .foregroundColor(.primary)

                                    Text("Access premium features and sync")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                Spacer()

                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(PlainButtonStyle())
                    } header: {
                        Text("Account")
                    }
                }

                // App Settings
                Section(header: Text("App Settings")) {
                    SettingsRow(
                        icon: "bell.fill",
                        title: "Notifications",
                        subtitle: "Workout reminders and credit alerts",
                        color: .orange
                    ) {
                        openNotificationSettings()
                    }

                    SettingsRow(
                        icon: "heart.fill",
                        title: "HealthKit",
                        subtitle: healthKitManager.isAuthorized ? "Connected" : "Not connected",
                        color: healthKitManager.isAuthorized
                            ? Color(.systemGreen) : Color(.systemRed)
                    ) {
                        print("🔴 HealthKit settings row tapped")
                        print("🔴 HealthKit isAuthorized: \(healthKitManager.isAuthorized)")
                        if !healthKitManager.isAuthorized {
                            print("🔴 Requesting HealthKit authorization...")
                            healthKitManager.requestAuthorization { success, error in
                                print(
                                    "🔴 HealthKit authorization result: success=\(success), error=\(String(describing: error))"
                                )
                            }
                        }
                    }
                }

                // Account Actions (only for authenticated users)
                if !isGuestUser {
                    Section {
                        Button {
                            showingSignOutAlert = true
                        } label: {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .foregroundColor(Color(.systemRed))
                                Text("Sign Out")
                                    .foregroundColor(Color(.systemRed))
                            }
                        }
                    } header: {
                        Text("Account")
                    }
                }

                // App Info
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(Config.appVersion)
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Text("About")
                }
            }
            .navigationTitle("Settings")
        }
        .sheet(isPresented: $showingPremiumPaywall) {
            PremiumPaywallView()
                .environmentObject(storeKitManager)
        }
        .sheet(isPresented: $showingAuthView) {
            AuthenticationView()
        }
        .sheet(isPresented: $showingProfileManagement) {
            ProfileManagementView()
        }
        .alert("Sign Out", isPresented: $showingSignOutAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Sign Out", role: .destructive) {
                signOut()
            }
        } message: {
            Text("Are you sure you want to sign out?")
        }
    }

    private func signOut() {
        // Clear API service state
        apiService.logout()

        // Clear premium/store state to prevent guest users from seeing premium features
        storeKitManager.clearUserData()

        // Clear premium gate state
        premiumGateService.clearUserState()

        // Clear widget data
        WidgetDataService.shared.clearWidgetData()

        // Clear app state (this should be last to trigger UI updates)
        appState.signOut()
    }

    private func openNotificationSettings() {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString) else {
            return
        }

        if UIApplication.shared.canOpenURL(settingsUrl) {
            UIApplication.shared.open(settingsUrl, options: [:]) { success in
                if !success {
                    print("Failed to open Settings app")
                }
            }
        }
    }
}

struct ProfileRow: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 16) {
            // Profile image placeholder
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.blue, .purple],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 60, height: 60)
                .overlay {
                    Text(initials)
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                }

            VStack(alignment: .leading, spacing: 4) {
                if let user = appState.currentUser {
                    Text(user.email)
                        .font(.headline)
                        .fontWeight(.medium)

                    Text("Member since \(user.createdAt, style: .date)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("Guest User")
                        .font(.headline)
                        .fontWeight(.medium)

                    Text("Sign in to sync across devices")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 8)
    }

    private var initials: String {
        guard let user = appState.currentUser else { return "G" }
        let components = user.email.components(separatedBy: "@")
        let name = components.first ?? user.email
        return String(name.prefix(2)).uppercased()
    }
}

struct PremiumStatusRow: View {
    @EnvironmentObject var storeKitManager: StoreKitManager

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: "crown.fill")
                .font(.title3)
                .foregroundColor(Color(.systemYellow))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(storeKitManager.subscriptionType.displayName)
                    .font(.body)
                    .foregroundColor(.primary)

                Text("All premium features unlocked")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.title3)
                .foregroundColor(Color(.systemGreen))
        }
        .padding(.vertical, 4)
    }
}

struct SettingsRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(color)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.body)
                        .foregroundColor(.primary)

                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
        .environmentObject(APIService())
        .environmentObject(StoreKitManager())
        .environmentObject(PremiumGateService(storeKitManager: StoreKitManager()))
        .environmentObject(HealthKitManager())
}
