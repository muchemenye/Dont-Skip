# 🏃‍♂️ Don't Skip Widget Implementation Guide

## Overview
This guide walks you through adding a widget to the Don't Skip iOS app that allows users to:
- View their current coding credit balance
- Quick-add workouts 
- Sync workout data
- Access the main app quickly

## ✅ Widget Features Implemented

### Small Widget (2x2)
- Current credit balance display
- Tap anywhere to add workout
- Clean, minimal design

### Medium Widget (4x2) 
- Credit balance with progress bar
- Two action buttons: "Add Workout" and "Sync Data"
- Shows current coding time remaining

### Large Widget (4x4)
- Full credit status with emergency credits
- Three action buttons: "Add Workout", "Sync Data", "View Credits"
- Progress bar and detailed statistics
- Shows last update time

## Implementation Steps

### 1. Create Widget Extension Target in Xcode

1. **File → New → Target**
2. **Choose "Widget Extension"**
3. **Product Name:** `DontSkipWidget`
4. **Embed in Application:** "Dont Skip"
5. **Include Configuration Intent:** ❌ (We're using simple static widget)

### 2. Set Up App Groups for Data Sharing

1. **In Apple Developer Account:**
   - Create App Group: `group.com.dontskip.app`

2. **Enable App Groups for both targets:**
   - Main App: Signing & Capabilities → + → App Groups
   - Widget Extension: Signing & Capabilities → + → App Groups
   - Select same group ID for both

### 3. Add Widget Files

The widget implementation is complete in `/ios/Dont Skip/DontSkipWidget/DontSkipWidget.swift`:

- ✅ Simple TimelineProvider (no Intents complexity)
- ✅ Three widget sizes (Small, Medium, Large)
- ✅ URL scheme integration for actions
- ✅ Shared data support via App Groups
- ✅ Beautiful gradient design matching app theme

### 4. Configure Widget Target in Xcode

1. **Add @main attribute to DontSkipWidgetBundle:**
   ```swift
   @main
   struct DontSkipWidgetBundle: WidgetBundle {
       var body: some Widget {
           DontSkipWidget()
       }
   }
   ```

2. **Ensure Info.plist has widget configuration**
3. **Set deployment target to iOS 14+**

### 5. Update Main App for URL Handling

Add this to your main app's `ContentView.swift` or `DontSkipApp.swift`:

```swift
.onOpenURL { url in
    handleWidgetURL(url)
}

private func handleWidgetURL(_ url: URL) {
    guard url.scheme == "dontskip" else { return }
    
    switch url.host {
    case "add-workout":
        // Navigate to add workout screen
        appState.showingWorkoutEntry = true
    case "view-credits":
        // Navigate to credits view  
        appState.selectedTab = 1
    case "sync-data":
        // Trigger manual sync
        Task {
            await apiService.syncWorkouts()
        }
    default:
        break
    }
}
```

### 6. Enable Data Sharing (Optional but Recommended)

Update your main app to share data with the widget:

```swift
// In AppState or wherever you update credit balance
func updateCreditBalance(_ balance: CreditBalance) {
    creditBalance = balance
    credits = balance.availableCredits
    
    // Save to shared storage for widget
    if let userDefaults = UserDefaults(suiteName: "group.com.dontskip.app"),
       let data = try? JSONEncoder().encode(balance) {
        userDefaults.set(data, forKey: "creditBalance")
    }
    
    // Refresh widget
    WidgetCenter.shared.reloadAllTimelines()
}
```

### 7. Test Widget

1. **Run widget extension target**
2. **Add widget to home screen** (long press on home screen → + → search "Don't Skip")
3. **Test all three sizes**
4. **Test URL scheme actions**
5. **Verify data updates between app and widget**

## Widget Actions

| Action | URL Scheme | Function |
|--------|------------|----------|
| Add Workout | `dontskip://add-workout` | Opens app to workout entry |
| Sync Data | `dontskip://sync-data` | Triggers manual sync |
| View Credits | `dontskip://view-credits` | Opens app to credits view |

## Widget Update Strategy

The widget updates automatically:
- **Every hour** (timeline with 5 entries)
- **When app becomes active** (via WidgetCenter.shared.reloadAllTimelines())
- **When credit balance changes** (triggered from main app)

## Troubleshooting

### Widget not appearing in widget gallery
- Ensure widget extension target builds successfully
- Check App Group is configured for both targets
- Verify iOS deployment target is 14+

### Widget showing old data
- Ensure shared UserDefaults is configured correctly
- Check that main app calls `WidgetCenter.shared.reloadAllTimelines()`
- Verify App Group ID matches between app and widget

### URL schemes not working
- Ensure URL scheme is registered in main app's Info.plist
- Check URL handling code is in main app
- Test URLs in Safari first: `dontskip://add-workout`

## Security Notes

- Widget uses shared UserDefaults (App Group) for data
- No sensitive authentication data stored in widget
- Widget gracefully handles missing or invalid data
- All sensitive operations require opening main app

## Performance Considerations

- Widget timeline generates 5 entries spanning 5 hours
- Minimal data storage and processing
- Efficient image rendering with SF Symbols
- Lightweight gradient backgrounds

This widget provides excellent user experience with quick access to core app functionality while maintaining security and performance best practices!
