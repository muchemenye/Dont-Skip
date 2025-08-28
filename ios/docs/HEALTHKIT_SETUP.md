# HealthKit Setup Guide

## ✅ Files Updated

1. **Dont_Skip.entitlements** - Added HealthKit entitlements

## 🔧 Xcode Project Configuration

This is a modern SwiftUI project, so HealthKit configuration is done directly in Xcode target settings:

### 1. Enable HealthKit Capability

1. Open `Dont Skip.xcodeproj` in Xcode
2. Select the "Dont Skip" target
3. Go to "Signing & Capabilities" tab
4. Click "+ Capability"
5. Add "HealthKit"
6. Make sure "Clinical Health Records" is unchecked (unless needed)

### 2. Add Privacy Usage Descriptions

**🎯 You're currently in "Signing & Capabilities" tab - you need to switch to "Info" tab:**

1. **Find the tabs**: Look at the top of the main panel - you'll see tabs like:

   - "General" | "Signing & Capabilities" | **"Info"** | "Build Settings" | "Build Phases"

2. **Click "Info" tab**: Click on the **"Info"** tab (it's next to "Signing & Capabilities")

3. **In the Info tab**: You'll see a property list with Key-Value pairs

4. **Add entries**: Look for a "+" button or right-click to add new entries

5. **Add these two keys exactly**:

**First Entry:**

- **Key**: `NSHealthShareUsageDescription`
- **Type**: String
- **Value**: `Don't Skip needs access to your health data to track your workouts and award coding credits for staying active. This helps you maintain a healthy work-life balance by encouraging regular exercise.`

**Second Entry:**

- **Key**: `NSHealthUpdateUsageDescription`
- **Type**: String
- **Value**: `Don't Skip may update your health data to record workout sessions and fitness activities that earn you coding credits.`

**💡 Tip**: Type the keys exactly as shown above - don't use the "Privacy - " prefix in modern Xcode.

### 3. Verify Entitlements

1. Make sure the entitlements file is linked in "Signing & Capabilities"
2. The file should be: `Dont Skip/Dont_Skip.entitlements`

## 📱 Privacy Descriptions Added

- **NSHealthShareUsageDescription**: Explains why the app needs to read health data
- **NSHealthUpdateUsageDescription**: Explains why the app might write health data

## 🏃‍♂️ HealthKit Data Types Requested

The app requests access to:

- Workout data (`HKWorkoutType`)
- Heart rate (`HKQuantityTypeIdentifierHeartRate`)
- Active energy burned (`HKQuantityTypeIdentifierActiveEnergyBurned`)
- Walking/running distance (`HKQuantityTypeIdentifierDistanceWalkingRunning`)
- Cycling distance (`HKQuantityTypeIdentifierDistanceCycling`)
- Swimming distance (`HKQuantityTypeIdentifierDistanceSwimming`)

## 🚀 Testing

After configuration:

1. Clean and rebuild the project
2. Run on a physical device (HealthKit doesn't work in simulator)
3. The app should prompt for HealthKit permissions on first launch
4. Check Settings > Privacy & Security > Health to verify permissions

## 🔍 Troubleshooting

If you still get HealthKit errors:

1. **Check HealthKit capability**: Ensure it's enabled in "Signing & Capabilities"
2. **Verify privacy descriptions**: Must be added in the "Info" tab with exact keys:
   - `NSHealthShareUsageDescription`
   - `NSHealthUpdateUsageDescription`
3. **Physical device required**: HealthKit doesn't work in simulator
4. **Clean build**: Product → Clean Build Folder
5. **No separate Info.plist**: Make sure no separate Info.plist file exists in the project

## 🚨 Current Error Fix

The current error: `NSHealthShareUsageDescription must be set in the app's Info.plist`

**Solution**: Add the privacy descriptions in Xcode target settings:

1. Select "Dont Skip" target
2. Go to "Info" tab
3. Add both `NSHealthShareUsageDescription` and `NSHealthUpdateUsageDescription` keys
4. Clean and rebuild
