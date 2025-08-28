import Foundation
import Combine
import SwiftUI
import UIKit



class IntegrationManager: ObservableObject {
    @Published var integrations: [Integration] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var showingOAuthSheet = false
    @Published var pendingOAuthURL: URL?
    
    private let apiService: APIService
    private let healthKitManager: HealthKitManager
    private var cancellables = Set<AnyCancellable>()
    
    init(apiService: APIService, healthKitManager: HealthKitManager) {
        print("� IntegrationManager BASIC INIT LOG")
        self.apiService = apiService
        self.healthKitManager = healthKitManager
        print("� HealthKit manager isAuthorized at init: \(healthKitManager.isAuthorized)")
        loadIntegrations()
    }
    
    private var isGuestUser: Bool {
        // Check if user is authenticated but has no auth token (guest mode)
        return apiService.isAuthenticated && UserDefaults.standard.string(forKey: "auth_token") == nil
    }
    
    // MARK: - Integration Management
    
    func loadIntegrations() {
        if !apiService.isAuthenticated || isGuestUser {
            // For guest users or unauthenticated users, only show HealthKit integration
            integrations = []
            addHealthKitIntegration()
            return
        }
        
        isLoading = true
        
        apiService.getIntegrations()
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        // For connection errors, gracefully handle by showing only HealthKit
                        print("Integration loading failed: \(error.localizedDescription)")
                        self?.integrations = []
                        self?.addHealthKitIntegration()
                    }
                },
                receiveValue: { [weak self] integrations in
                    self?.integrations = integrations
                    self?.addHealthKitIntegration()
                }
            )
            .store(in: &cancellables)
    }
    
    private func addHealthKitIntegration() {
        print("🔴 Adding HealthKit integration...")
        print("🔴 HealthKit isAuthorized: \(healthKitManager.isAuthorized)")
        print("🔴 HealthKit recentWorkouts count: \(healthKitManager.recentWorkouts.count)")
        
        // Calculate total credits from workouts
        let totalCredits = healthKitManager.recentWorkouts.reduce(0) { $0 + $1.creditsEarned }
        print("🔴 Total credits from workouts: \(totalCredits)")
        
        // Debug individual workout credits
        healthKitManager.recentWorkouts.forEach { workout in
            print("🔴 Workout: \(workout.type.displayName) - Duration: \(workout.duration)min - Credits: \(workout.creditsEarned)")
        }
        
        // Add HealthKit as a special integration
        let healthKitIntegration = Integration(
            id: "healthkit",
            type: .healthKit,
            isConnected: healthKitManager.isAuthorized,
            lastSync: nil,
            syncStatus: healthKitManager.isAuthorized ? .success : .unauthorized,
            workoutCount: healthKitManager.recentWorkouts.count,
            creditsEarned: healthKitManager.recentWorkouts.reduce(0) { $0 + $1.creditsEarned },
            settings: nil
        )
        
        print("🔴 Created HealthKit integration - isConnected: \(healthKitIntegration.isConnected), syncStatus: \(healthKitIntegration.syncStatus)")
        
        // Replace or add HealthKit integration
        if let index = integrations.firstIndex(where: { $0.type == .healthKit }) {
            integrations[index] = healthKitIntegration
            print("🔴 Updated HealthKit integration at index \(index)")
        } else {
            integrations.insert(healthKitIntegration, at: 0)
            print("🔴 Inserted new HealthKit integration at position 0")
        }
        
        print("🔴 Total integrations count: \(integrations.count)")
    }
    
    // MARK: - Connection Management
    
    func connectIntegration(_ type: IntegrationType) {
        switch type {
        case .healthKit:
            connectHealthKit()
        default:
            connectOAuthIntegration(type)
        }
    }
    
    private func connectHealthKit() {
        isLoading = true
        healthKitManager.requestAuthorizationWithSimulator { [weak self] success, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                if let error = error {
                    self?.errorMessage = "HealthKit authorization failed: \(error.localizedDescription)"
                } else if !success {
                    self?.errorMessage = "HealthKit access was denied. You can enable it in Settings > Privacy & Security > Health."
                }
                self?.addHealthKitIntegration()
            }
        }
    }
    
    private func connectOAuthIntegration(_ type: IntegrationType) {
        // Check if user is authenticated and not a guest
        guard apiService.isAuthenticated && !isGuestUser else {
            errorMessage = "Please sign in to connect fitness apps. Guest users can only use Apple Health integration."
            return
        }
        
        isLoading = true
        
        let oauthRequest = createOAuthRequest(for: type)
        
        guard let authURL = oauthRequest.authURL else {
            isLoading = false
            errorMessage = "Unable to create authentication URL for \(type.displayName). Please try again."
            return
        }
        
        // Store the auth URL for SwiftUI to handle
        pendingOAuthURL = authURL
        showingOAuthSheet = true
        isLoading = false
    }
    
    private func createOAuthRequest(for type: IntegrationType) -> OAuthRequest {
        let clientId = getClientId(for: type)
        let redirectURI = "dontskip://oauth/\(type.rawValue)"
        let scopes = getScopes(for: type)
        let state = UUID().uuidString
        
        return OAuthRequest(
            integrationType: type,
            clientId: clientId,
            redirectURI: redirectURI,
            scopes: scopes,
            state: state
        )
    }
    
    private func getClientId(for type: IntegrationType) -> String {
        // In a real app, these would be stored securely
        switch type {
        case .strava: return "your_strava_client_id"
        case .fitbit: return "your_fitbit_client_id"
        case .whoop: return "your_whoop_client_id"
        case .garmin: return "your_garmin_client_id"
        case .polar: return "your_polar_client_id"
        default: return ""
        }
    }
    
    private func getScopes(for type: IntegrationType) -> [String] {
        switch type {
        case .strava: return ["read", "activity:read"]
        case .fitbit: return ["activity", "heartrate", "profile"]
        case .whoop: return ["read:recovery", "read:workout", "read:profile"]
        case .garmin: return ["activities"]
        case .polar: return ["accesslink.read_all"]
        default: return []
        }
    }
    
    // MARK: - Disconnection
    
    func disconnectIntegration(_ type: IntegrationType) {
        if type == .healthKit {
            // Can't programmatically disconnect HealthKit
            errorMessage = "HealthKit permissions must be managed in Settings > Privacy & Security > Health > Don't Skip"
            return
        }
        
        isLoading = true
        
        apiService.disconnectIntegration(type)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.errorMessage = "Failed to disconnect \(type.displayName): \(error.localizedDescription)"
                    }
                },
                receiveValue: { [weak self] success in
                    if success {
                        self?.loadIntegrations()
                    } else {
                        self?.errorMessage = "Failed to disconnect \(type.displayName). Please try again."
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    // MARK: - Syncing
    
    func syncIntegration(_ type: IntegrationType) {
        print("🔄 Syncing integration: \(type)")
        if type == .healthKit {
            print("✅ HealthKit sync requested - calling fetchRecentWorkoutsWithSimulator")
            healthKitManager.fetchRecentWorkoutsWithSimulator()
            return
        }
        
        // Update integration status to syncing
        if let index = integrations.firstIndex(where: { $0.type == type }) {
            var integration = integrations[index]
            integration = Integration(
                id: integration.id,
                type: integration.type,
                isConnected: integration.isConnected,
                lastSync: integration.lastSync,
                syncStatus: .syncing,
                workoutCount: integration.workoutCount,
                creditsEarned: integration.creditsEarned,
                settings: integration.settings
            )
            integrations[index] = integration
        }
        
        apiService.syncIntegration(type)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.errorMessage = error.localizedDescription
                        self?.updateIntegrationStatus(type, status: .error)
                    }
                },
                receiveValue: { [weak self] response in
                    self?.updateIntegrationStatus(type, status: .success)
                    // Could update workout count and credits here
                }
            )
            .store(in: &cancellables)
    }
    
    private func updateIntegrationStatus(_ type: IntegrationType, status: SyncStatus) {
        if let index = integrations.firstIndex(where: { $0.type == type }) {
            var integration = integrations[index]
            integration = Integration(
                id: integration.id,
                type: integration.type,
                isConnected: integration.isConnected,
                lastSync: status == .success ? Date() : integration.lastSync,
                syncStatus: status,
                workoutCount: integration.workoutCount,
                creditsEarned: integration.creditsEarned,
                settings: integration.settings
            )
            integrations[index] = integration
        }
    }
    
    // MARK: - OAuth Callback Handling
    
    func handleOAuthCallback(url: URL) {
        // Dismiss the OAuth sheet first
        dismissOAuthSheet()
        
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let queryItems = components.queryItems else {
            errorMessage = "Invalid OAuth callback URL"
            return
        }
        
        var code: String?
        var error: String?
        
        for item in queryItems {
            switch item.name {
            case "code": code = item.value
            case "error": error = item.value
            default: break
            }
        }
        
        if let error = error {
            errorMessage = "OAuth authorization failed: \(error)"
            return
        }
        
        guard let authCode = code else {
            errorMessage = "No authorization code received from OAuth provider"
            return
        }
        
        let pathComponents = components.path.components(separatedBy: "/")
        guard pathComponents.count >= 2,
              let integrationType = IntegrationType(rawValue: pathComponents[1]) else {
            errorMessage = "Invalid OAuth callback path"
            return
        }
        
        // Connect the integration with the auth code
        isLoading = true
        apiService.connectIntegration(integrationType, authCode: authCode)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading = false
                    if case .failure(let error) = completion {
                        self?.errorMessage = "Failed to connect \(integrationType.displayName): \(error.localizedDescription)"
                    }
                },
                receiveValue: { [weak self] integration in
                    self?.loadIntegrations()
                }
            )
            .store(in: &cancellables)
    }
    
    // MARK: - OAuth Sheet Handling
    
    func dismissOAuthSheet() {
        showingOAuthSheet = false
        pendingOAuthURL = nil
    }
    
    // MARK: - Error Handling
    
    func clearError() {
        errorMessage = nil
    }
    
    // MARK: - Settings Navigation
    
    func openHealthKitSettings() {
        guard let settingsUrl = URL(string: UIApplication.openSettingsURLString) else {
            errorMessage = "Unable to open Settings. Please go to Settings > Privacy & Security > Health > Don't Skip manually."
            return
        }
        
        if UIApplication.shared.canOpenURL(settingsUrl) {
            UIApplication.shared.open(settingsUrl)
        } else {
            errorMessage = "Unable to open Settings. Please go to Settings > Privacy & Security > Health > Don't Skip manually."
        }
    }
}