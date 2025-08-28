import SwiftUI

struct ProfileManagementView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @EnvironmentObject var storeKitManager: StoreKitManager
    @EnvironmentObject var premiumGateService: PremiumGateService
    @Environment(\.dismiss) private var dismiss

    @State private var showingChangePasswordAlert = false
    @State private var showingDeleteAccountAlert = false
    @State private var showingCancelSubscriptionAlert = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var successMessage: String?

    // Password change fields
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var showingPasswordChangeSheet = false

    private var isGuestUser: Bool {
        appState.isAuthenticated && appState.currentUser == nil
    }

    var body: some View {
        NavigationView {
            List {
                // Profile Header
                Section {
                    ProfileHeaderView()
                }

                // Account Management
                if !isGuestUser {
                    Section {
                        // Change Password
                        Button {
                            showingPasswordChangeSheet = true
                        } label: {
                            SettingsRowView(
                                icon: "key.fill",
                                title: "Change Password",
                                subtitle: "Update your account password",
                                color: .blue
                            )
                        }
                        .buttonStyle(PlainButtonStyle())

                        // Update Email (Future feature)
                        SettingsRowView(
                            icon: "envelope.fill",
                            title: "Update Email",
                            subtitle: "Change your account email address",
                            color: .green,
                            isComingSoon: true
                        )

                    } header: {
                        Text("Account Settings")
                    }

                    // Subscription Management
                    if storeKitManager.isPremiumUser {
                        Section {
                            Button {
                                showingCancelSubscriptionAlert = true
                            } label: {
                                SettingsRowView(
                                    icon: "crown.fill",
                                    title: "Manage Subscription",
                                    subtitle: "Cancel or modify your premium subscription",
                                    color: .orange
                                )
                            }
                            .buttonStyle(PlainButtonStyle())

                        } header: {
                            Text("Subscription")
                        }
                    }

                    // Data & Privacy
                    Section {
                        // Export Data (Future feature)
                        SettingsRowView(
                            icon: "square.and.arrow.up.fill",
                            title: "Export Data",
                            subtitle: "Download your workout and credit history",
                            color: .purple,
                            isComingSoon: true
                        )

                        // Privacy Settings (Future feature)
                        SettingsRowView(
                            icon: "hand.raised.fill",
                            title: "Privacy Settings",
                            subtitle: "Manage data sharing preferences",
                            color: .indigo,
                            isComingSoon: true
                        )

                    } header: {
                        Text("Data & Privacy")
                    }

                    // Danger Zone
                    Section {
                        Button {
                            showingDeleteAccountAlert = true
                        } label: {
                            HStack(spacing: 16) {
                                Image(systemName: "trash.fill")
                                    .font(.title3)
                                    .foregroundColor(.red)
                                    .frame(width: 24)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Delete Account")
                                        .font(.body)
                                        .foregroundColor(.red)

                                    Text("Permanently delete your account and all data")
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
                        Text("Danger Zone")
                    } footer: {
                        Text(
                            "Deleting your account is permanent and cannot be undone. All your workout data, credits, and settings will be lost."
                        )
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }
                }

                // Guest User Section
                if isGuestUser {
                    Section {
                        VStack(spacing: 16) {
                            Image(systemName: "person.crop.circle.badge.plus")
                                .font(.system(size: 50))
                                .foregroundColor(.blue)

                            Text("Create an Account")
                                .font(.headline)
                                .fontWeight(.semibold)

                            Text(
                                "Sign up to access profile management, sync across devices, and unlock premium features."
                            )
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)

                            Button("Sign Up Now") {
                                // This would trigger the authentication flow
                                dismiss()
                            }
                            .buttonStyle(PrimaryButtonStyle())
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical)
                    }
                }

                // Status Messages
                if let errorMessage = errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }

                if let successMessage = successMessage {
                    Section {
                        Text(successMessage)
                            .foregroundColor(.green)
                            .font(.caption)
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .sheet(isPresented: $showingPasswordChangeSheet) {
            PasswordChangeView(
                currentPassword: $currentPassword,
                newPassword: $newPassword,
                confirmPassword: $confirmPassword,
                onSave: { changePassword() },
                onCancel: {
                    showingPasswordChangeSheet = false
                    clearPasswordFields()
                }
            )
        }
        .alert("Change Password", isPresented: $showingChangePasswordAlert) {
            Button("Cancel", role: .cancel) {
                clearPasswordFields()
            }
            Button("Change") {
                changePassword()
            }
        } message: {
            Text("Are you sure you want to change your password?")
        }
        .alert("Cancel Subscription", isPresented: $showingCancelSubscriptionAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Manage Subscription") {
                openSubscriptionManagement()
            }
        } message: {
            Text(
                "You can manage your subscription in the App Store. Would you like to go there now?"
            )
        }
        .alert("Delete Account", isPresented: $showingDeleteAccountAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                deleteAccount()
            }
        } message: {
            Text("This action cannot be undone. All your data will be permanently deleted.")
        }
        .overlay {
            if isLoading {
                Color(.systemBackground).opacity(0.3)
                    .ignoresSafeArea()

                ProgressView("Processing...")
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(8)
            }
        }
    }

    // MARK: - Actions

    private func changePassword() {
        guard !currentPassword.isEmpty && !newPassword.isEmpty && !confirmPassword.isEmpty else {
            errorMessage = "Please fill in all password fields"
            return
        }

        guard newPassword == confirmPassword else {
            errorMessage = "New passwords don't match"
            return
        }

        guard newPassword.count >= 8 else {
            errorMessage = "New password must be at least 8 characters"
            return
        }

        isLoading = true
        errorMessage = nil

        // API call to change password
        apiService.changePassword(
            currentPassword: currentPassword,
            newPassword: newPassword
        )
        .sink(
            receiveCompletion: { completion in
                isLoading = false
                if case .failure(let error) = completion {
                    errorMessage = error.localizedDescription
                }
            },
            receiveValue: { _ in
                successMessage = "Password changed successfully"
                showingPasswordChangeSheet = false
                clearPasswordFields()
            }
        )
        .store(in: &appState.cancellables)
    }

    private func deleteAccount() {
        isLoading = true
        errorMessage = nil

        // API call to delete account
        apiService.deleteAccount()
            .sink(
                receiveCompletion: { completion in
                    isLoading = false
                    if case .failure(let error) = completion {
                        errorMessage = error.localizedDescription
                    }
                },
                receiveValue: { _ in
                    // Sign out and dismiss
                    appState.signOut()
                    dismiss()
                }
            )
            .store(in: &appState.cancellables)
    }

    private func openSubscriptionManagement() {
        // Open App Store subscription management
        if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
            UIApplication.shared.open(url)
        }
    }

    private func clearPasswordFields() {
        currentPassword = ""
        newPassword = ""
        confirmPassword = ""
    }
}

// MARK: - Supporting Views

struct ProfileHeaderView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 20) {
            // Profile Avatar
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.blue, .purple],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 80, height: 80)
                .overlay {
                    Text(initials)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.white)
                }

            VStack(alignment: .leading, spacing: 8) {
                if let user = appState.currentUser {
                    Text(user.email)
                        .font(.title2)
                        .fontWeight(.semibold)

                    Text("Member since \(user.createdAt, style: .date)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    Text("Last active \(user.lastActive, style: .relative)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("Guest User")
                        .font(.title2)
                        .fontWeight(.semibold)

                    Text("Limited features available")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()
        }
        .padding(.vertical, 12)
    }

    private var initials: String {
        guard let user = appState.currentUser else { return "G" }
        let components = user.email.components(separatedBy: "@")
        let name = components.first ?? user.email
        return String(name.prefix(2)).uppercased()
    }
}

struct SettingsRowView: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    var isComingSoon: Bool = false

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(isComingSoon ? .secondary : color)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(title)
                        .font(.body)
                        .foregroundColor(isComingSoon ? .secondary : .primary)

                    if isComingSoon {
                        Text("Coming Soon")
                            .font(.caption2)
                            .foregroundColor(.orange)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.orange.opacity(0.1))
                            .cornerRadius(4)
                    }
                }

                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            if !isComingSoon {
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
    }
}

struct PasswordChangeView: View {
    @Binding var currentPassword: String
    @Binding var newPassword: String
    @Binding var confirmPassword: String
    let onSave: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationView {
            Form {
                Section {
                    SecureField("Current Password", text: $currentPassword)
                } header: {
                    Text("Current Password")
                }

                Section {
                    SecureField("New Password", text: $newPassword)
                    SecureField("Confirm New Password", text: $confirmPassword)
                } header: {
                    Text("New Password")
                } footer: {
                    Text("Password must be at least 8 characters long")
                }
            }
            .navigationTitle("Change Password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        onCancel()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        onSave()
                    }
                    .disabled(
                        currentPassword.isEmpty || newPassword.isEmpty || confirmPassword.isEmpty)
                }
            }
        }
    }
}

#Preview {
    ProfileManagementView()
        .environmentObject(AppState())
        .environmentObject(APIService())
        .environmentObject(StoreKitManager())
        .environmentObject(PremiumGateService(storeKitManager: StoreKitManager()))
}
