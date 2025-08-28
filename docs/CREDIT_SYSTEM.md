# 💳 Workout Lockout Credit System Documentation

## Overview

The Workout Lockout extension uses a credit-based system to encourage regular exercise breaks. This document explains exactly how credits work, when they're consumed, and how the different types behave.

## 🏋️‍♂️ Regular Workout Credits

### How You Earn Credits

1. Complete a physical workout (any duration/intensity)
2. Record it through the extension (`Cmd+Shift+P` → "Workout Lockout: Record Workout")
3. Choose workout type and duration
4. Verify completion (honor system, photo, etc.)
5. Receive coding credits based on your configured ratios

### Default Workout Types

| Workout Type      | Min Duration | Coding Hours Earned |
| ----------------- | ------------ | ------------------- |
| Quick Stretch     | 5 minutes    | 2 hours             |
| Cardio Session    | 20 minutes   | 4 hours             |
| Strength Training | 45 minutes   | 8 hours             |

_All workout types are fully customizable in settings_

### When Credits Are Consumed

#### ✅ Credits ARE consumed when:

- Making any text edits in files
- Adding/deleting characters
- Copy/paste operations
- Any document modifications

#### ❌ Credits are NOT consumed when:

- VSCode is closed
- Viewing files without editing
- Navigating between files
- Using terminal or other panels
- VSCode is idle/inactive

### Credit Consumption Rate

- **Testing mode**: 1 minute of credit per edit (for demo purposes)
- **Production**: Configurable rate based on actual usage patterns

### Credit Expiry

- **Time-based expiry**: Credits expire after X days (default: 2 days)
- **Calendar-based**: Expiry is from when earned, not when used
- **FIFO system**: Oldest credits are used first
- **No usage-based expiry**: Credits don't expire from being used

### Example Scenarios

#### Scenario 1: Normal Usage

```
Monday 9:00 AM: Complete 20-min cardio → Earn 4 hours
Monday 10:00 AM: Code for 1 hour → 3 hours remaining
Monday 11:00 AM: Close VSCode for meetings
Tuesday 9:00 AM: Open VSCode → Still have 3 hours remaining
Wednesday 9:00 AM: Credits expire (48 hours later)
```

#### Scenario 2: Multiple Workouts

```
Monday: Quick stretch → 2 hours (expires Wednesday)
Tuesday: Cardio session → 4 hours (expires Thursday)
Wednesday: Start coding → Uses Monday's 2 hours first
Wednesday: Continue coding → Then uses Tuesday's 4 hours
```

## 🚨 Emergency Credits

### Purpose

Emergency credits provide a safety valve for urgent coding needs when you're locked out.

### How Emergency Credits Work

1. Click "Emergency Unlock" when locked out
2. Confirm you need urgent access
3. Receive 30 minutes of real-time coding access
4. Timer counts down even when VSCode is closed

### Emergency vs Regular Credits

| Aspect            | Regular Credits         | Emergency Credits       |
| ----------------- | ----------------------- | ----------------------- |
| **Consumption**   | Only when editing       | Real-time countdown     |
| **VSCode closed** | No consumption          | Timer keeps running     |
| **Purpose**       | Earned through exercise | Emergency access only   |
| **Duration**      | Days (configurable)     | 30 minutes fixed        |
| **Renewable**     | Yes, through workouts   | Limited use recommended |

### Emergency Credit Behavior

```
12:00 PM: Use emergency unlock → 30 minutes granted
12:15 PM: Close VSCode for 10 minutes
12:25 PM: Open VSCode → Only 5 minutes remaining
12:30 PM: Emergency time expires → Locked out again
```

## 📊 Status Bar Indicators

### Status Bar Messages

- `💪 4.2h credits | 2.1h today` - Normal state with plenty of credits
- `💪 45min left | 6.8h today` - Low credits (< 2 hours), shows minutes
- `🚨 Emergency: 15min left` - Emergency mode active (orange background)
- `🔒 Locked - Workout needed!` - No credits available (red background)

### Color Coding

- **Normal**: Default VSCode colors
- **Low credits**: Warning background (yellow/orange) when ≤ 10 minutes
- **Emergency**: Warning background (orange)
- **Locked**: Error background (red)

## ⚙️ Configuration Options

### Workout Types

Fully customizable in settings:

- Workout name
- Minimum duration required
- Coding hours earned
- Add/remove workout types

### Credit Management

- **Credit Rollover Days**: How long unused credits last (1-7 days)
- **Max Daily Coding**: Maximum coding hours per day
- **Emergency Duration**: How long emergency unlock lasts (5-120 minutes)

### Daily Limits

- Separate from workout credits
- Prevents overwork even with available credits
- Resets at midnight
- Configurable maximum (1-24 hours)

## 🔧 Technical Implementation

### Data Storage

- Credits stored in VSCode's global state
- Persists across VSCode restarts
- Automatic cleanup of expired credits
- Workout history tracking (last 50 workouts)

### Credit Consumption Logic

1. Check if credits available and daily limit not exceeded
2. Sort credits by expiration date (oldest first)
3. Consume from oldest credits first
4. Update used hours and save state
5. Lock editor if insufficient credits

### Lockout Mechanism

- Monitors document change events
- Immediately undoes changes when locked
- Blocks file saves when locked
- Shows lockout message with options

## 🚀 Best Practices

### For Developers

1. **Start conservative**: Begin with shorter workouts and longer coding periods
2. **Build habits**: Consistency matters more than intensity
3. **Plan breaks**: Use natural stopping points for workouts
4. **Emergency sparingly**: Reserve emergency unlock for true urgencies

### For Teams

1. **Shared settings**: Use workspace-level configuration for team consistency
2. **Peer accountability**: Share workout completions with teammates
3. **Flexible ratios**: Allow individual customization within team guidelines
4. **Meeting awareness**: Credits don't expire during meetings/breaks

## 🐛 Troubleshooting

### Common Issues

- **Credits not updating**: Check if workout was properly recorded
- **Unexpected lockout**: Verify daily limits and credit expiry
- **Emergency not working**: Ensure you have emergency unlock permission
- **Status bar not showing**: Restart VSCode or check extension activation

### Reset Options

- **Reset All Data**: Command palette → "Workout Lockout: Reset All Data (Testing)"
- **Clear specific credits**: Use settings UI to manage individual credits
- **Reconfigure**: Settings are applied immediately without restart

---

_This credit system is designed to encourage healthy habits while maintaining productivity. The key is finding the right balance for your lifestyle and work patterns._
