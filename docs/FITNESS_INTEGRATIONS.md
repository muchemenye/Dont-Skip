# 🏃‍♂️ Fitness Integrations Documentation

## Overview

The Workout Lockout extension supports multiple fitness tracker integrations to automatically import workout data and convert it to coding credits. This eliminates the need for manual workout entry and provides verified workout data.

## 🔗 Supported Integrations

### 🟡 Whoop Integration

**Status**: ✅ Implemented  
**API**: Whoop API 2.0  
**Authentication**: OAuth 2.0 (manual token for now)

**Features**:

- Automatic workout detection
- Strain and recovery scores
- Heart rate data
- Calorie burn estimates
- Real-time activity sync

**Setup**:

1. Get API access at [developer.whoop.com](https://developer.whoop.com)
2. Generate access token
3. `Cmd+Shift+P` → "Workout Lockout: Manage Fitness Integrations"
4. Connect Whoop and enter your token

**Data Retrieved**:

- Workout type and duration
- Start/end times
- Heart rate (average/max)
- Calories burned
- Strain score

### 🟠 Strava Integration

**Status**: ✅ Implemented  
**API**: Strava API v3  
**Authentication**: OAuth 2.0 (manual token for testing)

**Features**:

- Running, cycling, swimming activities
- Activity duration and distance data
- Heart rate data (average/max)
- Calorie burn tracking
- 40+ activity type mappings
- Automatic activity import from last 24 hours

### 🔵 Fitbit Integration

**Status**: ✅ Implemented  
**API**: Fitbit Web API 1.2  
**Authentication**: OAuth 2.0 (manual token for testing)

**Features**:

- Daily activity logs and exercise sessions
- Heart rate data (average/max)
- Calorie burn tracking
- Distance and duration data
- 50+ activity type mappings
- Date-range activity fetching

### 📱 iOS Companion App

**Status**: ✅ Framework Complete  
**Data Source**: Apple HealthKit  
**Authentication**: App-based sync

**Features**:

- Apple Watch workout detection (78+ workout types)
- HealthKit data integration (HKWorkoutType)
- Heart rate and calorie data sync
- Third-party app data (Nike Run Club, Strava in Health)
- Real-time sync with VSCode extension
- Test sync functionality for development

## 🔧 Technical Implementation

### API Architecture

```typescript
interface WorkoutData {
  id: string;
  source: "whoop" | "strava" | "fitbit" | "apple-health" | "manual";
  type: string;
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  calories?: number;
  heartRate?: { average?: number; max?: number };
  distance?: number; // meters
  verified: boolean;
}
```

### Integration Flow

1. **Authentication**: OAuth 2.0 or API token
2. **Data Sync**: Periodic fetch of recent workouts
3. **Deduplication**: Remove duplicate workouts across sources
4. **Mapping**: Convert tracker data to internal format
5. **Import**: User selects workouts to convert to credits

### Data Storage

- **Tokens**: Stored in VSCode global state (encrypted)
- **Workout Cache**: Last 50 imported workouts
- **Sync Status**: Last sync timestamp per integration
- **User Preferences**: Auto-import settings

## 🚀 Usage Guide

### Connecting Your First Integration

1. **Open Integration Manager**:

   ```
   Cmd+Shift+P → "Workout Lockout: Manage Fitness Integrations"
   ```

2. **Select Integration**:

   - Choose from available integrations
   - Follow authentication flow
   - Grant necessary permissions

3. **Sync Workouts**:

   ```
   Cmd+Shift+P → "Workout Lockout: Sync Recent Workouts"
   ```

4. **Import Credits**:
   - Review detected workouts
   - Select workouts to import
   - Confirm credit conversion

### Automatic Workout Import

**Coming Soon**: Configure automatic import rules:

- Import all workouts above X minutes
- Only import specific workout types
- Set maximum credits per day from integrations
- Enable/disable notifications for new workouts

### Workout Mapping

The system automatically maps tracker workout types to your configured workout types:

| Tracker Type      | Default Mapping   | Credits Earned    |
| ----------------- | ----------------- | ----------------- |
| Running/Jogging   | Cardio Session    | Based on duration |
| Cycling           | Cardio Session    | Based on duration |
| Strength Training | Strength Training | Based on duration |
| Yoga/Stretching   | Quick Stretch     | Based on duration |
| Walking           | Quick Stretch     | Based on duration |

**Custom Mapping**: Configure in settings to match your workout types.

## 🔐 Security & Privacy

### Data Handling

- **Minimal Data**: Only workout metadata is stored
- **Local Storage**: All data stored locally in VSCode
- **No Cloud Sync**: Data never leaves your machine
- **Token Security**: API tokens encrypted in VSCode global state

### Permissions Required

**Whoop**:

- Read workout data
- Read user profile (for verification)

**Strava**:

- Read activities (activity:read_all)
- Read profile information (profile:read_all)

**Fitbit** (Coming Soon):

- Read activity data
- Read heart rate data

**iOS HealthKit** (Coming Soon):

- Read workout data
- Read heart rate data
- Read active energy data

## 🛠️ Development & API Keys

### Whoop API Setup

1. Visit [developer.whoop.com](https://developer.whoop.com)
2. Create developer account
3. Register your application
4. Generate access token
5. Use token in VSCode extension

### API Implementation Status

**✅ Whoop API 2.0** - Fully Verified:

- Endpoints: `/v1/user/profile/basic`, `/v1/activity/workout`
- Authentication: Bearer token
- Data mapping: 105+ sport types supported
- Rate limit: 100 requests/hour

**✅ Strava API v3** - Verified Structure:

- Endpoints: `/v3/athlete`, `/v3/athlete/activities`
- Authentication: OAuth 2.0 (manual token for testing)
- Data mapping: 40+ activity types supported
- Rate limit: 600 requests/15 minutes, 30,000/day

**✅ Fitbit Web API 1.2** - Fully Implemented:

- Endpoints: `/1/user/-/profile.json`, `/1/user/-/activities/date/{date}.json`
- Authentication: OAuth 2.0 (manual token for testing)
- Data mapping: 50+ activity types supported
- Rate limit: 150 requests/hour

**✅ iOS HealthKit Integration** - Framework Complete:

- Data source: Apple HealthKit (HKWorkoutType)
- Authentication: iOS app permissions
- Data mapping: 78+ workout activity types
- Sync method: Local storage via companion app

### Rate Limits

- **Whoop**: 100 requests/hour
- **Strava**: 600 requests/15 minutes, 30,000/day
- **Fitbit**: 150 requests/hour

### Testing

```bash
# Test Whoop connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.prod.whoop.com/developer/v1/user/profile/basic

# Test Whoop workout data
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.prod.whoop.com/developer/v1/activity/workout?start=2024-01-01T00:00:00Z&end=2024-01-02T00:00:00Z"

# Test Strava connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://www.strava.com/api/v3/athlete

# Test Strava activities
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://www.strava.com/api/v3/athlete/activities?after=1640995200&per_page=10"

# Test Fitbit connection
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.fitbit.com/1/user/-/profile.json

# Test Fitbit activities (replace date)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.fitbit.com/1/user/-/activities/date/2024-01-15.json"
```

## 🐛 Troubleshooting

### Common Issues

**"Integration not connecting"**:

- Verify API token is valid
- Check internet connection
- Ensure API service is operational
- Try disconnecting and reconnecting

**"No workouts found"**:

- Check date range (default: last 24 hours)
- Verify workouts exist in source app
- Ensure workout meets minimum duration
- Check integration permissions

**"Duplicate workouts imported"**:

- System should auto-deduplicate
- Manual duplicates can be removed from history
- Adjust import settings to prevent future duplicates

### Debug Commands

```
Cmd+Shift+P → "Developer: Toggle Developer Tools"
```

Check console for integration errors and API responses.

### Support

- Check extension logs in VSCode Output panel
- File issues on GitHub with integration name
- Include error messages and steps to reproduce

## 🔮 Roadmap

### Phase 1 (Complete)

- ✅ Whoop integration with full API
- ✅ Strava integration with activity mapping
- ✅ Fitbit integration with daily activity logs
- ✅ iOS HealthKit framework with 78+ workout types
- ✅ Manual workout import and deduplication

### Phase 2 (Next)

- 🚧 OAuth 2.0 flows for Strava and Fitbit
- 🚧 iOS companion app development
- 🚧 Automatic import rules and preferences
- 🚧 Real-time webhook integrations

### Phase 3 (Future)

- 📋 Garmin Connect integration
- 📋 Google Fit integration
- 📋 Samsung Health integration
- 📋 Polar Flow integration

### Phase 4 (Advanced)

- 📋 Real-time webhooks
- 📋 Team challenges
- 📋 Workout recommendations
- 📋 Health insights dashboard

---

_Integrations are designed to enhance your workflow while maintaining privacy and security. All data processing happens locally on your machine._
