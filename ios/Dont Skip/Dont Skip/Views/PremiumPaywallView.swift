import SwiftUI
import StoreKit

struct PremiumPaywallView: View {
    @EnvironmentObject var storeKitManager: StoreKitManager
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedProduct: Product?
    @State private var isPurchasing = false
    @State private var showingError = false
    @State private var errorMessage = ""
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    VStack(spacing: 16) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 60))
                            .foregroundColor(Color(.systemYellow))
                        
                        Text("Unlock Premium Features")
                            .font(.title)
                            .fontWeight(.bold)
                            .multilineTextAlignment(.center)
                        
                        Text("Boost your developer productivity with unlimited fitness platform sync and advanced features")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top)
                    
                    // Features List
                    PremiumFeaturesCard()
                    
                    // Pricing Options
                    if storeKitManager.isLoading {
                        VStack(spacing: 16) {
                            ProgressView("Loading pricing...")
                            Text("Please wait while we load the latest pricing...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .frame(height: 200)
                    } else if storeKitManager.products.isEmpty {
                        VStack(spacing: 16) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 40))
                                .foregroundColor(Color(.systemOrange))
                            
                            Text("Unable to Load Pricing")
                                .font(.headline)
                                .fontWeight(.semibold)
                            
                            Text("Please check your internet connection and try again.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                            
                            Button("Retry") {
                                Task {
                                    await storeKitManager.requestProducts()
                                }
                            }
                            .buttonStyle(SecondaryButtonStyle())
                        }
                        .frame(height: 200)
                    } else {
                        PricingOptionsView(
                            products: storeKitManager.products,
                            selectedProduct: $selectedProduct,
                            onPurchase: purchaseProduct
                        )
                    }
                    
                    // Purchase Button
                    if let selectedProduct = selectedProduct {
                        PurchaseButton(
                            product: selectedProduct,
                            isPurchasing: isPurchasing,
                            action: { await purchaseProduct(selectedProduct) }
                        )
                    } else if !storeKitManager.products.isEmpty {
                        // Show a generic purchase button if no product is selected
                        Button("Select a Plan Above") {
                            selectedProduct = storeKitManager.products.first
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(.systemGray).opacity(0.3))
                        .foregroundColor(.secondary)
                        .cornerRadius(12)
                        .disabled(true)
                    }
                    
                    // Restore Purchases
                    Button(storeKitManager.isLoading ? "Restoring..." : "Restore Purchases") {
                        Task {
                            await storeKitManager.restorePurchases()
                            if let error = storeKitManager.errorMessage {
                                errorMessage = error
                                showingError = true
                            }
                        }
                    }
                    .font(.subheadline)
                    .foregroundColor(Color(.systemBlue))
                    .disabled(storeKitManager.isLoading)
                    
                    // Terms and Privacy
                    HStack(spacing: 16) {
                        Button("Terms of Service") {
                            // Open terms URL
                        }
                        
                        Button("Privacy Policy") {
                            // Open privacy URL
                        }
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
                .padding()
            }
            .navigationTitle("Premium")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
        .alert("Error", isPresented: $showingError) {
            Button("OK") { }
        } message: {
            Text(errorMessage)
        }
        .alert("Restore Complete", isPresented: .constant(storeKitManager.isPremiumUser && !storeKitManager.isLoading)) {
            Button("OK") {
                dismiss()
            }
        } message: {
            Text("Your purchases have been restored successfully!")
        }
        .onAppear {
            Task {
                if storeKitManager.products.isEmpty {
                    await storeKitManager.requestProducts()
                }
                // Pre-select annual plan after products load
                await MainActor.run {
                    if selectedProduct == nil {
                        selectedProduct = storeKitManager.products.first { $0.id.contains("annual") } ?? storeKitManager.products.first
                    }
                }
            }
        }
    }
    
    private func purchaseProduct(_ product: Product) async {
        isPurchasing = true
        
        do {
            let transaction = try await storeKitManager.purchase(product)
            if transaction != nil {
                // Purchase successful
                dismiss()
            }
        } catch {
            errorMessage = error.localizedDescription
            showingError = true
        }
        
        isPurchasing = false
    }
}

struct PremiumFeaturesCard: View {
    private let features = SubscriptionType.annual.features
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Premium Features")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: [GridItem(.flexible())], spacing: 12) {
                ForEach(features, id: \.self) { feature in
                    HStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(Color(.systemGreen))
                            .font(.title3)
                        
                        Text(feature)
                            .font(.subheadline)
                            .multilineTextAlignment(.leading)
                        
                        Spacer()
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct PricingOptionsView: View {
    let products: [Product]
    @Binding var selectedProduct: Product?
    let onPurchase: (Product) async -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Choose Your Plan")
                .font(.headline)
                .fontWeight(.semibold)
            
            LazyVStack(spacing: 12) {
                ForEach(products, id: \.id) { product in
                    PricingOptionCard(
                        product: product,
                        isSelected: selectedProduct?.id == product.id,
                        onSelect: { selectedProduct = product }
                    )
                }
            }
        }
    }
}

struct PricingOptionCard: View {
    let product: Product
    let isSelected: Bool
    let onSelect: () -> Void
    
    private var savings: String? {
        if product.id.contains("annual") {
            return "Save 50%"
        } else if product.id.contains("lifetime") {
            return "Best Value"
        }
        return nil
    }
    
    private var periodText: String {
        if product.isLifetime {
            return "One-time purchase"
        } else if let period = product.subscriptionPeriod {
            return "per \(period)"
        }
        return ""
    }
    
    var body: some View {
        Button(action: onSelect) {
            HStack {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(productTitle)
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        if let savings = savings {
                            Text(savings)
                                .font(.caption)
                                .fontWeight(.medium)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color(.systemGreen))
                                .foregroundColor(.white)
                                .cornerRadius(8)
                        }
                        
                        Spacer()
                    }
                    
                    Text(periodText)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing) {
                    Text(product.localizedPrice)
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    if product.id.contains("annual") {
                        Text("$1.67/month")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundColor(isSelected ? .blue : .gray)
                    .font(.title2)
            }
            .padding()
            .background(isSelected ? Color(.systemBlue).opacity(0.1) : Color(.systemGray6))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color(.systemBlue) : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var productTitle: String {
        if product.id.contains("monthly") {
            return "Monthly"
        } else if product.id.contains("annual") {
            return "Annual"
        } else if product.id.contains("lifetime") {
            return "Lifetime"
        }
        return product.displayName
    }
}

struct PurchaseButton: View {
    let product: Product
    let isPurchasing: Bool
    let action: () async -> Void
    
    var body: some View {
        Button(action: {
            Task {
                await action()
            }
        }) {
            HStack {
                if isPurchasing {
                    ProgressView()
                        .scaleEffect(0.8)
                        .foregroundColor(.white)
                }
                
                Text(isPurchasing ? "Processing..." : "Start Premium - \(product.localizedPrice)")
                    .font(.headline)
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(Color(.systemBlue))
            .foregroundColor(.white)
            .cornerRadius(12)
        }
        .disabled(isPurchasing)
    }
}



#Preview {
    PremiumPaywallView()
        .environmentObject(StoreKitManager())
}