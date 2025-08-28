# Don't Skip iOS App

A companion iOS app for the Don't Skip VSCode extension that allows users to:

- Track workouts on mobile
- Sync with the backend
- View coding credits
- Get workout reminders
- Connect fitness apps

## Features

- **Native HealthKit Integration** - Automatic workout detection
- **Manual Workout Entry** - Quick workout logging
- **Credit Tracking** - Real-time coding credit balance
- **Push Notifications** - Workout reminders and credit alerts
- **Fitness App Sync** - Connect Strava, Whoop, Fitbit
- **Offline Support** - Works without internet, syncs when available

## Requirements

- iOS 15.0+
- Xcode 14.0+
- Swift 5.7+

## Setup

1. Open `DontSkip.xcodeproj` in Xcode
2. Configure your development team
3. Update the backend URL in `Config.swift`
4. Build and run

## Architecture

- **SwiftUI** for modern, declarative UI
- **Combine** for reactive programming
- **HealthKit** for fitness data integration
- **Core Data** for local storage
- **URLSession** for API communication
