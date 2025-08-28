# 🚀 Workout Lockout Setup Guide

## Quick Start (5 minutes)

### 1. Install & Activate

- Install the extension from VSCode marketplace
- Extension activates automatically when VSCode starts
- Look for the status bar item on the bottom right: `💪 0.0h credits | 8.0h today`

### 2. Configure Your Workouts

```
Cmd+Shift+P → "Workout Lockout: Open Settings"
```

**Recommended starter configuration:**

- **Quick Stretch** (5 min) → 1 hour coding
- **Walk/Cardio** (15 min) → 3 hours coding
- **Full Workout** (30+ min) → 6 hours coding

### 3. Test the System

```
Cmd+Shift+P → "Workout Lockout: Reset All Data (Testing)"
```

- Try typing in a file → Should get locked out immediately
- Record a workout to unlock
- Watch the status bar countdown as you code

### 4. Record Your First Workout

```
Cmd+Shift+P → "Workout Lockout: Record Workout"
```

- Choose workout type
- Enter duration
- Select verification method
- Start coding with your earned credits!

## 📋 Recommended Settings

### For Beginners

```json
{
  "workoutTypes": [
    { "name": "Desk Stretch", "minDuration": 3, "codingHours": 1 },
    { "name": "Quick Walk", "minDuration": 10, "codingHours": 2 },
    { "name": "Real Workout", "minDuration": 20, "codingHours": 4 }
  ],
  "maxDailyCoding": 6,
  "creditRolloverDays": 1,
  "gracePeriodMinutes": 15
}
```

### For Regular Exercisers

```json
{
  "workoutTypes": [
    { "name": "Morning Routine", "minDuration": 15, "codingHours": 4 },
    { "name": "Gym Session", "minDuration": 45, "codingHours": 8 },
    { "name": "Evening Walk", "minDuration": 20, "codingHours": 3 }
  ],
  "maxDailyCoding": 10,
  "creditRolloverDays": 2,
  "gracePeriodMinutes": 30
}
```

### For Teams

```json
{
  "workoutTypes": [
    { "name": "Team Walk", "minDuration": 15, "codingHours": 3 },
    { "name": "Lunch Workout", "minDuration": 30, "codingHours": 5 },
    { "name": "Gym/Home Workout", "minDuration": 45, "codingHours": 8 }
  ],
  "maxDailyCoding": 8,
  "creditRolloverDays": 1,
  "gracePeriodMinutes": 20
}
```

## 🎯 Finding Your Balance

### Week 1: Establish Baseline

- Set very achievable workout requirements
- Focus on building the habit, not intensity
- Use honor system for verification
- Adjust ratios based on your natural rhythm

### Week 2-3: Optimize Ratios

- Track when you naturally want to take breaks
- Adjust workout-to-coding ratios
- Experiment with different workout types
- Fine-tune daily limits

### Week 4+: Advanced Features

- Add photo verification
- Set up team challenges
- Integrate with fitness trackers
- Optimize for your peak productivity hours

## 🔧 Advanced Configuration

### Workspace vs User Settings

- **User settings**: Apply to all projects (`~/.vscode/settings.json`)
- **Workspace settings**: Project-specific (`.vscode/settings.json`)
- Workspace settings override user settings

### Custom Workout Types

Create workout types that match your routine:

```json
{
  "workoutTypes": [
    { "name": "Yoga Flow", "minDuration": 20, "codingHours": 4 },
    { "name": "Rock Climbing", "minDuration": 60, "codingHours": 10 },
    { "name": "Dog Walk", "minDuration": 10, "codingHours": 2 },
    { "name": "Bike Commute", "minDuration": 25, "codingHours": 5 }
  ]
}
```

### Time Zone Considerations

- Daily limits reset at local midnight
- Credit expiry uses local time
- Emergency unlock duration is real-time

## 🚨 Emergency Unlock Guidelines

### When to Use Emergency Unlock

✅ **Appropriate uses:**

- Production bug that needs immediate fix
- Client demo in 10 minutes
- Critical deadline with no time for workout
- Security vulnerability discovered

❌ **Avoid using for:**

- Regular coding sessions
- "I don't feel like working out"
- Non-urgent feature development
- Code reviews or documentation

### Emergency Best Practices

1. **Use sparingly** - Aim for < 1 per week
2. **Pay it back** - Do a workout soon after emergency use
3. **Reflect** - Consider if better planning could avoid emergencies
4. **Team communication** - Let teammates know about urgent situations

## 📱 Future iOS App Integration

### Coming Soon

- Automatic workout detection via Apple Watch
- GPS tracking for runs/walks
- Photo verification with timestamps
- Social features and team challenges
- Integration with popular fitness apps

### Preparing for iOS App

- Start building workout habits now
- Use consistent workout naming
- Track your preferred workout types
- Build accountability with teammates

## 🤝 Team Setup

### For Team Leads

1. **Set team standards** in workspace settings
2. **Communicate the why** - health and productivity benefits
3. **Lead by example** - share your workout completions
4. **Be flexible** - allow individual customization within guidelines
5. **Celebrate wins** - acknowledge consistent exercisers

### For Team Members

1. **Respect the system** - don't abuse emergency unlock
2. **Share accountability** - workout buddy system
3. **Customize thoughtfully** - find what works for your schedule
4. **Give feedback** - help improve team settings

## 🐛 Troubleshooting

### Extension Not Working

1. Check if extension is activated (status bar visible)
2. Restart VSCode
3. Check for extension updates
4. Reset data if needed: `Cmd+Shift+P` → "Reset All Data"

### Credits Not Updating

1. Verify workout was recorded successfully
2. Check credit expiry dates
3. Ensure daily limits aren't exceeded
4. Look for error messages in VSCode output

### Lockout Too Aggressive

1. Increase workout-to-coding ratios
2. Extend credit rollover days
3. Raise daily coding limits
4. Add more workout types with lower requirements

### Need Help?

- Check the main README.md for feature overview
- Read CREDIT_SYSTEM.md for detailed credit behavior
- File issues on GitHub for bugs or feature requests
- Share feedback to help improve the extension

---

_Remember: The goal is sustainable healthy habits, not punishment. Adjust settings to support your lifestyle and productivity!_
