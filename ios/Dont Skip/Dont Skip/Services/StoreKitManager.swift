import Combine
import StoreKit
import SwiftUI

@MainActor
class StoreKitManager: ObservableObject {
    @Published var products: [Product] = []
    @Published var purchasedProductIDs: Set<String> = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private var updateListenerTask: Task<Void, Error>?
    private let productIDs: Set<String> = [
        "com.dontskip.premium.monthly",
        "com.dontskip.premium.annual",
        "com.dontskip.premium.lifetime",
    ]

    init() {
        updateListenerTask = listenForTransactions()
        Task {
            await requestProducts()
            await updateCustomerProductStatus()
        }
    }

    deinit {
        updateListenerTask?.cancel()
    }

    // MARK: - Product Loading

    func requestProducts() async {
        isLoading = true
        errorMessage = nil

        do {
            let storeProducts = try await Product.products(for: productIDs)

            if storeProducts.isEmpty {
                errorMessage =
                    "No products available. Make sure StoreKit configuration is set up correctly."
            } else {
                // Sort products by price (monthly, annual, lifetime)
                products = storeProducts.sorted { product1, product2 in
                    if product1.id.contains("monthly") { return true }
                    if product2.id.contains("monthly") { return false }
                    if product1.id.contains("annual") { return true }
                    if product2.id.contains("annual") { return false }
                    return false
                }
            }

        } catch {
            errorMessage = "Failed to load products: \(error.localizedDescription)"
            print("StoreKit Error: \(error)")
        }

        isLoading = false
    }

    // MARK: - Purchase Management

    func purchase(_ product: Product) async throws -> StoreKit.Transaction? {
        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            await updateCustomerProductStatus()
            await transaction.finish()
            return transaction

        case .userCancelled, .pending:
            return nil

        @unknown default:
            return nil
        }
    }

    func restorePurchases() async {
        isLoading = true
        errorMessage = nil

        do {
            try await AppStore.sync()
            await updateCustomerProductStatus()
        } catch {
            errorMessage = "Failed to restore purchases: \(error.localizedDescription)"
        }

        isLoading = false
    }

    // MARK: - Subscription Status

    func updateCustomerProductStatus() async {
        var purchasedProducts: Set<String> = []

        for await result in Transaction.currentEntitlements {
            do {
                let transaction = try checkVerified(result)

                switch transaction.productType {
                case .autoRenewable:
                    // Check if subscription is active
                    if let subscriptionStatus = await transaction.subscriptionStatus {
                        if subscriptionStatus.state == .subscribed {
                            purchasedProducts.insert(transaction.productID)
                        }
                    }

                case .nonConsumable:
                    // Lifetime purchase - check if still valid
                    purchasedProducts.insert(transaction.productID)

                default:
                    break
                }
            } catch {
                print("Failed to verify transaction: \(error)")
            }
        }

        purchasedProductIDs = purchasedProducts
    }

    // MARK: - Premium Status

    var isPremiumUser: Bool {
        !purchasedProductIDs.isEmpty
    }

    var subscriptionType: SubscriptionType {
        if purchasedProductIDs.contains("com.dontskip.premium.lifetime") {
            return .lifetime
        } else if purchasedProductIDs.contains("com.dontskip.premium.annual") {
            return .annual
        } else if purchasedProductIDs.contains("com.dontskip.premium.monthly") {
            return .monthly
        } else {
            return .free
        }
    }

    // MARK: - State Management

    func clearUserData() {
        // Clear purchased products for guest/logged out users
        // Note: This doesn't affect actual purchases, just the app state
        // Real purchases will be restored when user signs in again
        purchasedProductIDs.removeAll()
    }

    // MARK: - Transaction Verification

    func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified:
            throw StoreError.failedVerification
        case .verified(let safe):
            return safe
        }
    }

    // MARK: - Transaction Listener

    private func listenForTransactions() -> Task<Void, Error> {
        return Task.detached {
            for await result in Transaction.updates {
                do {
                    let transaction = try await self.checkVerified(result)
                    await self.updateCustomerProductStatus()
                    await transaction.finish()
                } catch {
                    print("Transaction failed verification")
                }
            }
        }
    }
}

// MARK: - Supporting Types

enum SubscriptionType: String, CaseIterable {
    case free = "Free"
    case monthly = "Monthly"
    case annual = "Annual"
    case lifetime = "Lifetime"

    var displayName: String {
        switch self {
        case .free: return "Free"
        case .monthly: return "Premium Monthly"
        case .annual: return "Premium Annual"
        case .lifetime: return "Premium Lifetime"
        }
    }

    var features: [String] {
        switch self {
        case .free:
            return [
                "Manual workout entry",
                "Basic Apple Health sync",
                "Limited to 2 devices",
            ]
        case .monthly, .annual, .lifetime:
            return [
                "Unlimited device sync",
                "All fitness platform integrations",
                "Automatic background sync",
                "Historical data import",
                "Priority support",
                "Advanced workout filtering",
                "Custom sync schedules",
            ]
        }
    }
}

enum StoreError: Error {
    case failedVerification
}

// MARK: - Product Extensions

extension Product {
    var localizedPrice: String {
        return displayPrice
    }

    var subscriptionPeriod: String? {
        guard let subscription = subscription else { return nil }

        let unit = subscription.subscriptionPeriod.unit
        let value = subscription.subscriptionPeriod.value

        switch unit {
        case .day:
            return value == 1 ? "day" : "\(value) days"
        case .week:
            return value == 1 ? "week" : "\(value) weeks"
        case .month:
            return value == 1 ? "month" : "\(value) months"
        case .year:
            return value == 1 ? "year" : "\(value) years"
        @unknown default:
            return nil
        }
    }

    var isLifetime: Bool {
        return id.contains("lifetime")
    }

    var isSubscription: Bool {
        return subscription != nil
    }
}
