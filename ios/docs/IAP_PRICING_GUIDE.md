# 💰 In-App Purchase Pricing Guide

## Overview

This guide covers how to set up and manage pricing for in-app purchases in the Don't Skip iOS app using both StoreKit Configuration (for testing) and App Store Connect (for production).

## 🏗️ Current Pricing Structure

Based on your market research, here's the implemented pricing strategy:

### **Freemium Model**

- **Free Tier**: Basic Apple Health sync, limited to 2 devices
- **Premium Tiers**: Unlimited sync, all integrations, advanced features

### **Pricing Tiers**

1. **Monthly**: $2.99/month
2. **Annual**: $19.99/year (Save 50% - $1.67/month)
3. **Lifetime**: $49.99 one-time purchase (Best Value)

## 🛠️ Method 1: StoreKit Configuration (Testing)

### Current Configuration

Your `Configuration.storekit` file already contains the correct pricing:

```json
{
  "subscriptions": [
    {
      "productID": "com.dontskip.premium.monthly",
      "displayPrice": "2.99",
      "recurringSubscriptionPeriod": "P1M"
    },
    {
      "productID": "com.dontskip.premium.annual",
      "displayPrice": "19.99",
      "recurringSubscriptionPeriod": "P1Y"
    }
  ],
  "nonRenewingSubscriptions": [
    {
      "productID": "com.dontskip.premium.lifetime",
      "displayPrice": "49.99"
    }
  ]
}
```

### How to Modify Pricing in Xcode

1. **Open StoreKit Configuration**:

   - In Xcode, navigate to `ios/Dont Skip/Configuration.storekit`
   - Double-click to open in StoreKit Configuration Editor

2. **Edit Subscription Pricing**:

   - Select a subscription (e.g., "Premium Monthly")
   - In the inspector panel, modify the **Price** field
   - Update **Localized Description** if needed

3. **Edit Lifetime Pricing**:

   - Select "Premium Lifetime" in Non-Renewing Subscriptions
   - Modify the **Price** field
   - Update description and display name

4. **Add Promotional Offers** (Optional):
   - Select a subscription
   - Click **+** next to "Promotional Offers"
   - Set discount percentage and duration

### Testing Different Price Points

You can easily test different pricing strategies:

```swift
// Test pricing variations in StoreKit Configuration
"displayPrice": "1.99"  // Lower entry point
"displayPrice": "4.99"  // Higher premium feel
"displayPrice": "9.99"  // Premium positioning
```

## 🏪 Method 2: App Store Connect (Production)

### Setting Up Products in App Store Connect

1. **Login to App Store Connect**:

   - Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Select your app

2. **Navigate to In-App Purchases**:

   - Go to **Features** > **In-App Purchases**
   - Click **+** to create new products

3. **Create Monthly Subscription**:

   ```
   Product ID: com.dontskip.premium.monthly
   Reference Name: Premium Monthly
   Subscription Group: Premium Subscription
   Subscription Duration: 1 Month
   Price: $2.99 USD
   ```

4. **Create Annual Subscription**:

   ```
   Product ID: com.dontskip.premium.annual
   Reference Name: Premium Annual
   Subscription Group: Premium Subscription
   Subscription Duration: 1 Year
   Price: $19.99 USD
   ```

5. **Create Lifetime Purchase**:
   ```
   Product ID: com.dontskip.premium.lifetime
   Reference Name: Premium Lifetime
   Type: Non-Consumable
   Price: $49.99 USD
   ```

### Setting Up Subscription Group

1. **Create Subscription Group**:

   - Name: "Premium Subscription"
   - Users can only have one active subscription per group

2. **Configure Upgrade/Downgrade Behavior**:
   - Monthly → Annual: Upgrade (immediate)
   - Annual → Monthly: Downgrade (at end of period)

### Pricing by Region

App Store Connect automatically converts your USD pricing to local currencies:

```
$2.99 USD = €2.99 EUR = £2.99 GBP = ¥450 JPY
$19.99 USD = €19.99 EUR = £19.99 GBP = ¥3,000 JPY
$49.99 USD = €54.99 EUR = £49.99 GBP = ¥7,400 JPY
```

You can customize pricing per region if needed.

## 🎯 Promotional Strategies

### Introductory Offers

Add to your annual subscription in App Store Connect:

1. **Free Trial**: 1 week free, then $19.99/year
2. **Introductory Price**: $9.99 for first year, then $19.99/year
3. **Pay Up Front**: $14.99 for first year, then $19.99/year

### Promotional Codes

Generate codes in App Store Connect for:

- Beta testers
- Influencers and reviewers
- Launch promotions
- Customer support

## 🔧 Implementation in Code

### Update StoreKit Manager

Your `StoreKitManager.swift` already handles the pricing correctly:

```swift
private let productIDs: Set<String> = [
    "com.dontskip.premium.monthly",    // $2.99/month
    "com.dontskip.premium.annual",     // $19.99/year
    "com.dontskip.premium.lifetime"    // $49.99 one-time
]
```

### Display Pricing in UI

The `PremiumPaywallView.swift` automatically shows:

- Localized pricing from StoreKit
- Savings calculations (50% for annual)
- Monthly equivalent for annual ($1.67/month)

## 📊 A/B Testing Pricing

### Using StoreKit Configuration

Test different price points during development:

```json
// Version A - Current pricing
{
  "monthly": "2.99",
  "annual": "19.99",
  "lifetime": "49.99"
}

// Version B - Higher pricing
{
  "monthly": "4.99",
  "annual": "29.99",
  "lifetime": "79.99"
}

// Version C - Lower entry point
{
  "monthly": "1.99",
  "annual": "14.99",
  "lifetime": "39.99"
}
```

### Production A/B Testing

Use App Store Connect's **Custom Product Pages** to test:

1. Different pricing presentations
2. Feature emphasis
3. Value propositions

## 💡 Pricing Best Practices

### Psychology of Pricing

1. **Charm Pricing**: $2.99 vs $3.00 (feels significantly cheaper)
2. **Anchoring**: Show lifetime price first to make annual seem reasonable
3. **Decoy Effect**: Monthly makes annual look like better value

### Value Communication

Update your paywall copy to emphasize value:

```swift
// In PremiumPaywallView.swift
"Save 50% with annual billing"           // Savings focus
"Just $1.67 per month when billed annually"  // Lower perceived cost
"Best Value - Pay once, use forever"     // Lifetime positioning
```

### Competitive Analysis

Your pricing vs competitors:

- **Strong Workout Tracker**: $4.99/month, $29.99/year
- **MyFitnessPal Premium**: $9.99/month, $49.99/year
- **Strava Premium**: $5/month, $59.99/year

Your pricing is **competitive and positioned well** for the developer productivity market.

## 🚀 Launch Strategy

### Phase 1: Soft Launch (Current)

- Use StoreKit Configuration for testing
- Validate pricing with beta users
- Gather feedback on value perception

### Phase 2: App Store Release

- Set up products in App Store Connect
- Launch with introductory offer (1 week free trial)
- Monitor conversion rates and adjust

### Phase 3: Optimization

- A/B test different price points
- Add seasonal promotions
- Introduce family sharing for annual/lifetime

## 🔍 Monitoring & Analytics

### Key Metrics to Track

1. **Conversion Rate**: Free to paid conversion
2. **ARPU**: Average Revenue Per User
3. **LTV**: Customer Lifetime Value
4. **Churn Rate**: Monthly/annual subscription cancellations

### Tools for Tracking

- **App Store Connect Analytics**: Built-in conversion tracking
- **RevenueCat**: Advanced subscription analytics
- **Custom Analytics**: Track in-app behavior leading to purchases

## 🛠️ Quick Changes Guide

### To Change Pricing in Development:

1. Open `Configuration.storekit` in Xcode
2. Select the product to modify
3. Change the **Price** field
4. Save and rebuild the app

### To Change Pricing in Production:

1. Login to App Store Connect
2. Go to **Features** > **In-App Purchases**
3. Select the product
4. Click **Edit** next to pricing
5. Submit for review (if required)

## 🎉 Current Status

✅ **StoreKit Configuration**: Set up with researched pricing
✅ **iOS App Integration**: Fully implemented
✅ **Paywall UI**: Shows pricing with savings calculations
✅ **Product IDs**: Consistent across configuration and code

**Next Steps**:

1. Test pricing with beta users
2. Set up App Store Connect products
3. Launch with introductory offers
4. Monitor and optimize based on data

---

**Need to adjust pricing?** Simply modify the `displayPrice` values in `Configuration.storekit` and rebuild the app for testing!
