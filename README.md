# 🏃‍♂️ Don't Skip - VSCode Extension

Your code runs better when you do! This extension encourages healthy habits by rewarding workouts with coding time, helping developers maintain their fitness while building amazing products.

## 🚀 Features

- **Flexible Workout Credits**: Customize how much coding time each workout type earns
- **Smart Lockout System**: Editor locks when you run out of workout credits
- **Real-time Countdown**: See exactly how much coding time you have left
- **Fitness Tracker Integration**: Whoop, Strava, Fitbit, Apple Health support
- **Daily Limits**: Set maximum daily coding hours to prevent overwork
- **Credit Rollover**: Unused workout credits carry over for configurable days
- **Emergency Unlock**: 30-minute real-time countdown for urgent fixes
- **Status Bar Integration**: Always see your available credits and daily progress

## 🎯 How It Works

1. **Configure Your Workouts**: Set up workout types and how much coding time each earns
2. **Start Coding**: Work normally until your credits run out
3. **Get Locked Out**: Editor blocks when you need to exercise (typing gets undone!)
4. **Record Workout**: Complete a workout and record it through the extension
5. **Unlock & Code**: Get back to coding with fresh energy!

## 💳 Credit System Explained

### 🏋️‍♂️ Regular Workout Credits

- **Earned by**: Completing and recording workouts
- **Consumed when**: You actively edit files (typing, deleting, etc.)
- **NOT consumed when**: VSCode is closed, idle, or just viewing files
- **Expiry**: Credits expire after X days (default: 2 days) regardless of usage
- **Example**: 20-min workout → 4 hours of coding credits that last 2 days

### 🚨 Emergency Credits

- **Purpose**: Urgent fixes when you're locked out
- **Duration**: 30 minutes of real-time countdown
- **Behavior**: Timer runs even when VSCode is closed
- **Usage**: Use sparingly - meant for true emergencies only

### 📊 Status Bar Display

- **Normal**: `💪 2.5h credits | 6.2h today`
- **Low credits**: `💪 15min left | 6.2h today` (when < 2 hours)
- **Emergency**: `🚨 Emergency: 25min left` (orange background)
- **Locked**: `🔒 Locked - Workout needed!` (red background)

## ⚙️ Setup

1. Install the extension
2. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
3. Run "Don't Skip: Open Settings"
4. Configure your workout types and preferences
5. Start coding and stay healthy!

## 🏃‍♂️ Default Workout Types

- **Quick Stretch** (5 min) → 2 hours coding
- **Cardio Session** (20 min) → 4 hours coding
- **Strength Training** (45 min) → 8 hours coding

Customize these in settings to match your fitness routine!

## 📱 Commands

- `Workout Lockout: Record Workout` - Log a completed workout
- `Workout Lockout: View Credits` - Check your available coding time
- `Workout Lockout: Open Settings` - Configure workout types and preferences
- `Workout Lockout: Emergency Unlock` - Get 30 minutes for urgent fixes
- `Workout Lockout: Manage Fitness Integrations` - Connect Whoop, Strava, etc.
- `Workout Lockout: Sync Recent Workouts` - Import workouts from connected apps

## 🎮 Status Bar

The status bar shows:

- 💪 Available workout credits
- ⏰ Remaining coding time today
- 🔒 Lock status when credits are depleted

## 🔧 Configuration

Access settings through the command palette or click the status bar item. Configure:

- **Workout Types**: Name, minimum duration, coding hours earned
- **Daily Limits**: Maximum coding hours per day
- **Credit Management**: How long unused credits last
- **Emergency Settings**: Grace period duration

## 🚧 Coming Soon

- **iOS Companion App**: Apple Health integration and photo verification
- **OAuth Integration**: Secure Strava and Fitbit authentication
- **Team Challenges**: Compete with colleagues on workout consistency
- **Advanced Analytics**: Track your health and productivity trends
- **Real-time Sync**: Automatic workout detection and import

## 💡 Pro Tips

### 🎯 Getting Started

- Start with shorter workouts (5-15 min) to build the habit
- Set realistic workout-to-coding ratios for your schedule
- Configure daily limits to prevent overwork and burnout

### 🔄 Credit Management

- **Regular credits don't expire from usage** - only from calendar time
- Close VSCode during meetings without losing credits
- Credits are consumed only when actively editing, not viewing code
- Older credits are used first (FIFO system)

### 🚨 Emergency Usage

- Use emergency unlock sparingly - it's for true emergencies only
- Emergency timer runs in real-time, even when VSCode is closed
- Consider it "borrowed time" that needs to be "paid back" with a workout

### ⚙️ Customization

- Adjust workout types and rewards in settings
- Set different ratios for different workout intensities
- Configure credit rollover period (1-7 days)
- Customize daily coding limits and emergency duration

## 📚 Documentation

- **[Setup Guide](SETUP_GUIDE.md)** - Quick start and configuration recommendations
- **[Credit System](CREDIT_SYSTEM.md)** - Detailed explanation of how credits work
- **[Fitness Integrations](FITNESS_INTEGRATIONS.md)** - Connect Whoop, Strava, Fitbit, and more
- **[Troubleshooting](SETUP_GUIDE.md#-troubleshooting)** - Common issues and solutions

## 🤝 Contributing

This extension is in active development. Feature requests and bug reports welcome!

## 📄 License

MIT License - Build healthy, code happy! 💪

---

_Remember: The best code is written by healthy developers. Take care of your body, and it will take care of your mind!_
