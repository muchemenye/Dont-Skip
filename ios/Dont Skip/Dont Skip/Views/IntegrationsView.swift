import SwiftUI

struct IntegrationsView: View {
    @EnvironmentObject var integrationManager: IntegrationManager
    @State private var showingOAuthSheet = false
    @State private var selectedIntegration: IntegrationType?

    var body: some View {
        NavigationView {
            ScrollView {
                LazyVStack(spacing: 16) {
                    // Header
                    VStack(alignment: .leading, spacing: 8) {
                        Text(
                            "Connect your fitness apps to automatically track workouts and earn coding credits."
                        )
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)

                    // Connected Integrations
                    if !integrationManager.integrations.filter({ $0.isConnected }).isEmpty {
                        ConnectedIntegrationsSection()
                    }

                    // Available Integrations
                    AvailableIntegrationsSection()
                }
                .padding(.vertical)
            }
            .navigationTitle("Integrations")
            .onAppear {
                print("🔴 IntegrationsView appeared")
                print("🔴 Total integrations: \(integrationManager.integrations.count)")
                integrationManager.integrations.forEach { integration in
                    print(
                        "🔴 Integration: \(integration.type) - Connected: \(integration.isConnected) - Status: \(integration.syncStatus)"
                    )
                }
                print("🔴 IntegrationManager isLoading: \(integrationManager.isLoading)")
            }
            .refreshable {
                integrationManager.loadIntegrations()
            }
        }
        .sheet(isPresented: $integrationManager.showingOAuthSheet) {
            if let url = integrationManager.pendingOAuthURL {
                OAuthWebView(
                    url: url,
                    onCallback: { callbackURL in
                        integrationManager.handleOAuthCallback(url: callbackURL)
                    },
                    onDismiss: {
                        integrationManager.dismissOAuthSheet()
                    }
                )
            }
        }
        .alert("Integration Error", isPresented: .constant(integrationManager.errorMessage != nil))
        {
            Button("OK") {
                integrationManager.clearError()
            }
        } message: {
            if let errorMessage = integrationManager.errorMessage {
                Text(errorMessage)
            }
        }
    }
}

struct ConnectedIntegrationsSection: View {
    @EnvironmentObject var integrationManager: IntegrationManager

    private var connectedIntegrations: [Integration] {
        integrationManager.integrations.filter { $0.isConnected }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Connected")
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()

                Text("\(connectedIntegrations.count) connected")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)

            LazyVStack(spacing: 12) {
                ForEach(connectedIntegrations) { integration in
                    ConnectedIntegrationCard(integration: integration)
                }
            }
            .padding(.horizontal)
        }
    }
}

struct AvailableIntegrationsSection: View {
    @EnvironmentObject var integrationManager: IntegrationManager

    private var availableIntegrations: [IntegrationType] {
        let connectedTypes = Set(
            integrationManager.integrations.filter { $0.isConnected }.map { $0.type })
        return IntegrationType.allCases.filter { !connectedTypes.contains($0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Available")
                    .font(.headline)
                    .fontWeight(.semibold)

                Spacer()
            }
            .padding(.horizontal)

            LazyVStack(spacing: 12) {
                ForEach(availableIntegrations, id: \.self) { type in
                    AvailableIntegrationCard(integrationType: type)
                }
            }
            .padding(.horizontal)
        }
    }
}

struct ConnectedIntegrationCard: View {
    let integration: Integration
    @EnvironmentObject var integrationManager: IntegrationManager
    @State private var showingDisconnectAlert = false
    @State private var showingHealthKitManagement = false

    var body: some View {
        VStack(spacing: 16) {
            HStack(spacing: 16) {
                // Icon
                Image(systemName: integration.iconName)
                    .font(.title2)
                    .foregroundColor(integration.systemColor)
                    .frame(width: 40, height: 40)
                    .background(integration.systemColor.opacity(0.1))
                    .cornerRadius(8)

                // Info
                VStack(alignment: .leading, spacing: 4) {
                    Text(integration.displayName)
                        .font(.headline)
                        .fontWeight(.semibold)

                    HStack {
                        Text(integration.syncStatus.displayName)
                            .font(.caption)
                            .foregroundColor(integration.syncStatus.systemColor)

                        if integration.syncStatus == .syncing {
                            ProgressView()
                                .scaleEffect(0.7)
                        }

                        if let lastSync = integration.lastSync {
                            Text("• Last sync: \(lastSync, style: .relative) ago")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Spacer()

                // Actions
                VStack(spacing: 8) {
                    let isButtonDisabled =
                        integration.syncStatus == .syncing || integrationManager.isLoading

                    Button("Sync") {
                        print("🔴 SYNC BUTTON TAPPED - integration type: \(integration.type)")
                        print("🔴 Integration manager isLoading: \(integrationManager.isLoading)")
                        print("🔴 Integration syncStatus: \(integration.syncStatus)")
                        integrationManager.syncIntegration(integration.type)
                    }
                    .font(.caption)
                    .foregroundColor(Color(.systemBlue))
                    .disabled(isButtonDisabled)
                    .onAppear {
                        print("🔴 SYNC BUTTON APPEARED - disabled: \(isButtonDisabled)")
                        print(
                            "🔴 Button state - syncStatus: \(integration.syncStatus), isLoading: \(integrationManager.isLoading)"
                        )
                        print("🔴 Sync status == .syncing: \(integration.syncStatus == .syncing)")
                        print("🔴 Integration manager isLoading: \(integrationManager.isLoading)")
                        print("🔴 Final disabled state: \(isButtonDisabled)")
                    }
                    .onChange(of: isButtonDisabled) {
                        print("🔴 SYNC BUTTON STATE CHANGED - disabled: \(isButtonDisabled)")
                    }

                    if integration.type == .healthKit {
                        Button("Manage") {
                            showingHealthKitManagement = true
                        }
                        .font(.caption)
                        .foregroundColor(Color(.systemOrange))
                    } else {
                        Button("Disconnect") {
                            showingDisconnectAlert = true
                        }
                        .font(.caption)
                        .foregroundColor(Color(.systemRed))
                        .disabled(integrationManager.isLoading)
                    }
                }
            }

            // Stats
            HStack {
                StatItem(title: "Workouts", value: "\(integration.workoutCount)")

                Spacer()

                StatItem(title: "Credits Earned", value: "\(integration.creditsEarned)")
                    .foregroundColor(Color(.systemGreen))
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .alert("Disconnect \(integration.displayName)?", isPresented: $showingDisconnectAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Disconnect", role: .destructive) {
                integrationManager.disconnectIntegration(integration.type)
            }
        } message: {
            Text(
                "This will stop syncing workouts from \(integration.displayName). You can reconnect at any time."
            )
        }
        .alert("Manage Apple Health", isPresented: $showingHealthKitManagement) {
            Button("Open Settings") {
                integrationManager.openHealthKitSettings()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(
                "To manage Apple Health permissions, go to Settings > Privacy & Security > Health > Don't Skip and adjust your data sharing preferences."
            )
        }
    }
}

struct AvailableIntegrationCard: View {
    let integrationType: IntegrationType
    @EnvironmentObject var integrationManager: IntegrationManager
    @EnvironmentObject var premiumGateService: PremiumGateService
    @State private var isConnecting = false

    var body: some View {
        HStack(spacing: 16) {
            // Icon
            Image(systemName: integrationType.iconName)
                .font(.title2)
                .foregroundColor(integrationType.systemColor)
                .frame(width: 40, height: 40)
                .background(integrationType.systemColor.opacity(0.1))
                .cornerRadius(8)

            // Info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(integrationType.displayName)
                        .font(.headline)
                        .fontWeight(.semibold)

                    if !premiumGateService.canAccessFitnessIntegrations {
                        Image(systemName: "crown.fill")
                            .foregroundColor(Color(.systemYellow))
                            .font(.caption)
                    }
                }

                Text(integrationType.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }

            Spacer()

            // Connect Button
            Button(action: {
                isConnecting = true
                premiumGateService.requirePremium(for: .fitnessIntegrations) {
                    integrationManager.connectIntegration(integrationType)
                }
                // Reset connecting state after a delay if no OAuth sheet appears
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    if !integrationManager.showingOAuthSheet {
                        isConnecting = false
                    }
                }
            }) {
                HStack(spacing: 4) {
                    if isConnecting && !integrationManager.showingOAuthSheet {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                    Text(isConnecting ? "Connecting..." : "Connect")
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
            .disabled(isConnecting || integrationManager.isLoading)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .onChange(of: integrationManager.showingOAuthSheet) { _, showing in
            if !showing {
                isConnecting = false
            }
        }
    }
}

struct StatItem: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.headline)
                .fontWeight(.semibold)

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    IntegrationsView()
        .environmentObject(
            IntegrationManager(apiService: APIService(), healthKitManager: HealthKitManager())
        )
        .environmentObject(StoreKitManager())
        .environmentObject(PremiumGateService(storeKitManager: StoreKitManager()))
}
