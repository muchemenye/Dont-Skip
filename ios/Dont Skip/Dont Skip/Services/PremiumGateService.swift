import Combine
import SwiftUI
import UIKit

@MainActor
class PremiumGateService: ObservableObject {
    @Published var showingPaywall = false

    private let storeKitManager: StoreKitManager

    init(storeKitManager: StoreKitManager) {
        self.storeKitManager = storeKitManager
    }

    // MARK: - Feature Access Control

    var canAccessPremiumFeatures: Bool {
        storeKitManager.isPremiumUser
    }

    var maxDeviceSync: Int {
        canAccessPremiumFeatures ? Int.max : 2
    }

    var canAccessFitnessIntegrations: Bool {
        canAccessPremiumFeatures
    }

    var canAccessBackgroundSync: Bool {
        canAccessPremiumFeatures
    }

    var canAccessHistoricalImport: Bool {
        canAccessPremiumFeatures
    }

    var canAccessAdvancedFiltering: Bool {
        canAccessPremiumFeatures
    }

    var canAccessCustomSyncSchedules: Bool {
        canAccessPremiumFeatures
    }

    // MARK: - Premium Gate Methods

    func requirePremium(
        for feature: PremiumFeature, isGuestUser: Bool = false, action: @escaping () -> Void
    ) {
        // Guest users should always see paywall
        // Also check if we have a valid authenticated state
        if isGuestUser || !canAccessPremiumFeatures {
            showPaywallForFeature(feature)
        } else {
            action()
        }
    }

    func requirePremiumAsync(
        for feature: PremiumFeature, isGuestUser: Bool = false, action: @escaping () async -> Void
    ) async {
        // Guest users should always see paywall
        if isGuestUser || !canAccessPremiumFeatures {
            showPaywallForFeature(feature)
        } else {
            await action()
        }
    }

    private func showPaywallForFeature(_ feature: PremiumFeature) {
        // You could customize the paywall based on the feature
        showingPaywall = true
    }

    // MARK: - State Management

    func clearUserState() {
        // Reset paywall state when user logs out
        showingPaywall = false
    }

    // MARK: - Feature Limits

    func checkDeviceLimit(currentDevices: Int) -> Bool {
        return currentDevices < maxDeviceSync
    }

    func getSyncFrequency() -> TimeInterval {
        // Premium users get more frequent syncing
        return canAccessPremiumFeatures ? 300 : 3600  // 5 min vs 1 hour
    }

    func getMaxWorkoutHistory() -> Int {
        // Premium users get unlimited history
        return canAccessPremiumFeatures ? Int.max : 50
    }
}

// MARK: - Premium Features Enum

enum PremiumFeature: String, CaseIterable {
    case fitnessIntegrations = "Fitness App Integrations"
    case backgroundSync = "Background Sync"
    case historicalImport = "Historical Data Import"
    case advancedFiltering = "Advanced Filtering"
    case customSyncSchedules = "Custom Sync Schedules"
    case unlimitedDevices = "Unlimited Device Sync"
    case prioritySupport = "Priority Support"

    var description: String {
        switch self {
        case .fitnessIntegrations:
            return "Connect Whoop, Strava, Fitbit, and other fitness platforms"
        case .backgroundSync:
            return "Automatic syncing in the background"
        case .historicalImport:
            return "Import all your past workout data"
        case .advancedFiltering:
            return "Filter and categorize workouts with advanced options"
        case .customSyncSchedules:
            return "Set custom sync frequencies and schedules"
        case .unlimitedDevices:
            return "Sync across unlimited devices"
        case .prioritySupport:
            return "Get priority customer support"
        }
    }

    var icon: String {
        switch self {
        case .fitnessIntegrations:
            return "link.circle.fill"
        case .backgroundSync:
            return "arrow.clockwise.circle.fill"
        case .historicalImport:
            return "clock.arrow.circlepath"
        case .advancedFiltering:
            return "line.3.horizontal.decrease.circle.fill"
        case .customSyncSchedules:
            return "calendar.circle.fill"
        case .unlimitedDevices:
            return "iphone.and.arrow.forward"
        case .prioritySupport:
            return "person.fill.checkmark"
        }
    }
}

// MARK: - Premium Gate View Modifier

struct PremiumGate: ViewModifier {
    let feature: PremiumFeature
    let premiumGateService: PremiumGateService

    func body(content: Content) -> some View {
        content
            .disabled(!premiumGateService.canAccessPremiumFeatures)
            .overlay {
                if !premiumGateService.canAccessPremiumFeatures {
                    PremiumOverlay(feature: feature) {
                        premiumGateService.showingPaywall = true
                    }
                }
            }
    }
}

struct PremiumOverlay: View {
    let feature: PremiumFeature
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                Image(systemName: "crown.fill")
                    .font(.title2)
                    .foregroundColor(Color(.systemYellow))

                Text("Premium")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemBackground).opacity(0.7))
            .cornerRadius(8)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

extension View {
    func premiumGate(for feature: PremiumFeature, using service: PremiumGateService) -> some View {
        modifier(PremiumGate(feature: feature, premiumGateService: service))
    }
}

// MARK: - Premium Status View

struct PremiumStatusView: View {
    @EnvironmentObject var storeKitManager: StoreKitManager

    var body: some View {
        HStack {
            if storeKitManager.isPremiumUser {
                HStack(spacing: 8) {
                    Image(systemName: "crown.fill")
                        .foregroundColor(Color(.systemYellow))

                    Text(storeKitManager.subscriptionType.displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color(.systemYellow).opacity(0.2))
                .cornerRadius(16)
            } else {
                HStack(spacing: 8) {
                    Image(systemName: "person.circle")
                        .foregroundColor(Color(.systemGray))

                    Text("Free")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color(.systemGray6))
                .cornerRadius(16)
            }
        }
    }
}
