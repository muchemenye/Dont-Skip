# iOS In-App Purchase Setup Guide

## 🛍️ Complete Implementation Guide for Don't Skip Premium Features

### **Step 1: App Store Connect Configuration**

1. **Create App in App Store Connect**

   - Bundle ID: `com.yourteam.dontskip` (or your chosen ID)
   - Enable In-App Purchases capability

2. **Create In-App Purchase Products**

   **Monthly Subscription:**

   - Product ID: `com.dontskip.premium.monthly`
   - Type: Auto-Renewable Subscription
   - Price: $4.99/month
   - Subscription Group: "Premium Subscription"

   **Annual Subscription:**

   - Product ID: `com.dontskip.premium.annual`
   - Type: Auto-Renewable Subscription
   - Price: $39.99/year
   - Subscription Group: "Premium Subscription"
   - Add 7-day free trial

   **Lifetime Purchase:**

   - Product ID: `com.dontskip.premium.lifetime`
   - Type: Non-Renewing Subscription
   - Price: $79.99 one-time

### **Step 2: Xcode Project Setup**

1. **Add StoreKit Capability**

   - Select your target in Xcode
   - Go to "Signing & Capabilities"
   - Add "In-App Purchase" capability

2. **Add StoreKit Configuration File**

   - The `Configuration.storekit` file is already created
   - Update the `_developerTeamID` with your actual Team ID
   - In Xcode scheme editor, set StoreKit Configuration to this file

3. **Update Info.plist**
   ```xml
   <key>SKAdNetworkItems</key>
   <array>
       <!-- Add any ad network IDs if using ads -->
   </array>
   ```

### **Step 3: Backend Integration (Optional)**

If you want server-side receipt validation:

1. **Add Receipt Validation Endpoint**

   ```typescript
   // backend/src/routes/subscriptions.ts
   router.post("/validate-receipt", async (req, res) => {
     const { receiptData } = req.body;
     // Validate with Apple's servers
     // Update user's premium status in database
   });
   ```

2. **Update User Model**
   ```typescript
   // Add to User model
   premiumStatus: {
     type: String,
     enum: ['free', 'monthly', 'annual', 'lifetime'],
     default: 'free'
   },
   premiumExpiresAt: Date,
   ```

### **Step 4: Testing**

1. **Sandbox Testing**

   - Create sandbox test accounts in App Store Connect
   - Use Configuration.storekit for local testing
   - Test all purchase flows and edge cases

2. **Test Scenarios**
   - ✅ Successful purchases
   - ✅ Cancelled purchases
   - ✅ Failed payments
   - ✅ Restore purchases
   - ✅ Subscription renewals
   - ✅ Subscription cancellations

### **Step 5: Premium Feature Implementation**

The following features are already gated behind premium:

**Free Tier:**

- Manual workout entry
- Basic Apple Health sync
- Limited to 2 devices
- 50 workout history limit

**Premium Tier:**

- ✅ Unlimited device sync
- ✅ All fitness platform integrations (Whoop, Strava, Fitbit)
- ✅ Automatic background sync (every 5 minutes vs 1 hour)
- ✅ Historical data import (unlimited)
- ✅ Advanced workout filtering
- ✅ Custom sync schedules
- ✅ Priority support

### **Step 6: Usage Examples**

**Gating a Feature:**

```swift
// In any view
Button("Connect Whoop") {
    premiumGateService.requirePremium(for: .fitnessIntegrations) {
        // Connect Whoop logic
        integrationManager.connectWhoop()
    }
}
```

**Checking Premium Status:**

```swift
// In any view
if storeKitManager.isPremiumUser {
    // Show premium features
} else {
    // Show upgrade prompt
}
```

**Background Sync Frequency:**

```swift
// In sync service
let syncInterval = premiumGateService.getSyncFrequency()
Timer.scheduledTimer(withTimeInterval: syncInterval, repeats: true) {
    // Sync logic
}
```

### **Step 7: App Store Review Guidelines**

**Important Compliance Notes:**

1. **Functionality**: Free tier must provide meaningful functionality
2. **Pricing**: Clearly display pricing and billing terms
3. **Restore**: Always provide restore purchases option
4. **Cancellation**: Link to subscription management in iOS Settings
5. **Privacy**: Handle subscription data according to privacy policy

### **Step 8: Launch Checklist**

- [ ] Products created in App Store Connect
- [ ] StoreKit configuration tested
- [ ] All purchase flows tested
- [ ] Receipt validation implemented (if using backend)
- [ ] Premium features properly gated
- [ ] Restore purchases working
- [ ] Privacy policy updated
- [ ] App Store screenshots show premium features
- [ ] App description mentions premium features

### **Step 9: Analytics & Monitoring**

Consider adding analytics to track:

- Paywall conversion rates
- Feature usage by tier
- Subscription retention rates
- Most popular premium features

### **Revenue Projections**

Based on your pricing strategy:

- **Monthly**: $4.99 × 12 = $59.88/year per user
- **Annual**: $39.99/year per user (33% savings)
- **Lifetime**: $79.99 one-time per user

**Conservative Estimates:**

- 1000 users: $40K-60K annual revenue
- 5000 users: $200K-300K annual revenue
- 10000 users: $400K-600K annual revenue

This implementation provides a solid foundation for monetizing your developer wellness platform while maintaining a great user experience!
