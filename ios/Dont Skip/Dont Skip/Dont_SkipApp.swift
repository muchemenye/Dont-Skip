//
//  Dont_SkipApp.swift
//  Dont Skip
//
//  Created by Herbert Kanengoni on 25/08/2025.
//

import SwiftUI

@main
struct Dont_SkipApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var apiService: APIService
    @StateObject private var healthKitManager: HealthKitManager
    @StateObject private var integrationManager: IntegrationManager
    @StateObject private var storeKitManager: StoreKitManager
    @StateObject private var premiumGateService: PremiumGateService

    init() {
        // Create shared instances
        let apiService = APIService()
        let healthKitManager = HealthKitManager()
        let storeKitManager = StoreKitManager()
        let premiumGateService = PremiumGateService(storeKitManager: storeKitManager)

        // Initialize StateObjects with the shared instances
        self._apiService = StateObject(wrappedValue: apiService)
        self._healthKitManager = StateObject(wrappedValue: healthKitManager)
        self._integrationManager = StateObject(
            wrappedValue: IntegrationManager(
                apiService: apiService, healthKitManager: healthKitManager))
        self._storeKitManager = StateObject(wrappedValue: storeKitManager)
        self._premiumGateService = StateObject(wrappedValue: premiumGateService)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(healthKitManager)
                .environmentObject(integrationManager)
                .environmentObject(storeKitManager)
                .environmentObject(premiumGateService)
                .onAppear {
                    setupApp()
                }
                .onOpenURL { url in
                    // Handle OAuth callbacks
                    if url.scheme == "dontskip" && url.host == "oauth" {
                        integrationManager.handleOAuthCallback(url: url)
                    }
                    // Handle widget actions
                    else if url.scheme == "dontskip" {
                        handleWidgetAction(url: url)
                    }
                }
                .sheet(isPresented: $premiumGateService.showingPaywall) {
                    PremiumPaywallView()
                        .environmentObject(storeKitManager)
                }
        }
    }

    private func setupApp() {
        // Request HealthKit permissions (simulator-aware)
        healthKitManager.requestAuthorizationWithSimulator { success, error in
            if let error = error {
                print("HealthKit authorization error: \(error.localizedDescription)")
            }
        }

        // Load saved authentication
        apiService.loadSavedAuth()

        // Update app state based on API service
        updateAppState()
    }

    private func handleWidgetAction(url: URL) {
        guard url.scheme == "dontskip" else { return }

        switch url.host {
        case "addworkout":
            // Navigate to workouts tab and trigger workout entry
            DispatchQueue.main.async {
                // First, switch to the workouts tab
                self.appState.selectedTab = 1

                // Then post a notification to trigger workout entry
                NotificationCenter.default.post(
                    name: NSNotification.Name("ShowWorkoutEntry"),
                    object: nil
                )

                if self.storeKitManager.isPremiumUser {
                    print("Widget: Navigating to add workout (Premium user)")
                } else {
                    print("Widget: Navigating to add workout (Free user)")
                }
            }
        case "sync":
            // Manual sync for premium users
            DispatchQueue.main.async {
                if self.storeKitManager.isPremiumUser {
                    print("Widget: Manual sync triggered (Premium)")
                    // Implement sync logic here
                } else {
                    print("Widget: Sync requires premium")
                }
            }
        case "main":
            // Navigate to main screen (default behavior)
            DispatchQueue.main.async {
                print("Widget: Open main app")
            }
        default:
            print("Unknown widget action: \(url)")
        }
    }

    private func updateAppState() {
        // Update app state based on authentication and premium status
        appState.isAuthenticated = apiService.isAuthenticated
        // Note: AppState doesn't have isPremium property, StoreKitManager handles premium status
    }
}
