# iOS App Setup Guide

## Prerequisites

- **Xcode 14.0+** (for iOS 15+ support)
- **iOS 15.0+** target device or simulator
- **Apple Developer Account** (for device testing and App Store distribution)
- **macOS 12.0+** (for Xcode compatibility)

## Project Setup

### 1. Open in Xcode

```bash
cd ios
open WorkoutLockout.xcodeproj
```

### 2. Configure Development Team

1. Select the **WorkoutLockout** project in the navigator
2. Go to **Signing & Capabilities** tab
3. Select your **Development Team**
4. Ensure **Bundle Identifier** is unique (e.g., `com.yourname.workoutlockout`)

### 3. Enable Required Capabilities

The following capabilities are already configured but verify they're enabled:

- ✅ **HealthKit** - For workout data access
- ✅ **Background App Refresh** - For automatic sync
- ✅ **Push Notifications** - For workout reminders

### 4. Configure Backend URL

Update the API endpoint in `Config/Config.swift`:

```swift
#if DEBUG
static let apiBaseURL = "http://localhost:3000"  // Your local backend
#else
static let apiBaseURL = "https://your-api.com"   // Your production backend
#endif
```

## Building and Running

### Development Build

1. Select **WorkoutLockout** scheme
2. Choose your target device or simulator
3. Press **⌘+R** to build and run

### Device Testing

1. Connect your iOS device
2. Trust the developer certificate on device
3. Build and run on device for HealthKit testing

## Key Features Implementation

### HealthKit Integration

- **Automatic Permission Request** - On first launch
- **Background Sync** - Detects new workouts automatically
- **Workout Type Mapping** - Converts HealthKit activities to app workout types
- **Heart Rate Data** - Optional detailed metrics

### API Integration

- **Authentication** - Login/register with backend
- **Workout Sync** - Bidirectional sync with server
- **Credit Management** - Real-time balance updates
- **Offline Support** - Local storage with sync when online

### User Interface

- **SwiftUI** - Modern, declarative UI
- **Native Design** - Follows iOS Human Interface Guidelines
- **Dark Mode** - Automatic support
- **Accessibility** - VoiceOver and Dynamic Type support

## Testing

### Unit Tests

```bash
# Run from Xcode or command line
xcodebuild test -scheme WorkoutLockout -destination 'platform=iOS Simulator,name=iPhone 14'
```

### HealthKit Testing

1. **Use Physical Device** - HealthKit doesn't work in simulator
2. **Add Sample Data** - Use Health app to add test workouts
3. **Test Permissions** - Verify authorization flow
4. **Background Sync** - Test with app backgrounded

### API Testing

1. **Local Backend** - Test with development server
2. **Network Conditions** - Test offline/online scenarios
3. **Authentication** - Test login/logout flows
4. **Error Handling** - Test network failures

## Deployment

### TestFlight (Beta)

1. Archive the app (**Product > Archive**)
2. Upload to App Store Connect
3. Add to TestFlight for beta testing
4. Invite beta testers

### App Store Release

1. Complete App Store Connect metadata
2. Add screenshots and app preview
3. Submit for review
4. Release when approved

## Troubleshooting

### Common Issues

**HealthKit Permission Denied**

- Check Info.plist usage descriptions
- Verify HealthKit capability is enabled
- Test on physical device only

**Network Requests Failing**

- Check backend URL in Config.swift
- Verify App Transport Security settings
- Test with local backend first

**Build Errors**

- Clean build folder (**⌘+Shift+K**)
- Update Xcode to latest version
- Check Swift version compatibility

### Debug Tools

- **Console App** - View device logs
- **Network Link Conditioner** - Test poor network
- **Xcode Instruments** - Performance profiling
- **Health App** - Verify data integration

## Architecture Notes

### MVVM Pattern

- **Models** - Data structures and business logic
- **Views** - SwiftUI interface components
- **ViewModels** - ObservableObject classes (AppState, APIService, etc.)

### Data Flow

1. **HealthKit** → **HealthKitManager** → **AppState**
2. **API** → **APIService** → **AppState**
3. **AppState** → **Views** (via @EnvironmentObject)

### Local Storage

- **Keychain** - Secure token storage
- **UserDefaults** - App preferences
- **Core Data** - Optional for complex local data

This iOS app provides a complete mobile companion to the VSCode extension, enabling users to track workouts and manage credits on the go!
