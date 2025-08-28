//
//  DontSkipWidget.swift
//  DontSkipWidget
//
//  Created by Herbert Kanengoni on 27/08/2025.
//

import SwiftUI
import WidgetKit

// MARK: - Simple Widget Models
struct WidgetCreditBalance {
    let availableCredits: Int
    let emergencyCredits: Int

    var availableHours: Double {
        return Double(availableCredits) / 60.0
    }
}

struct WidgetWorkout {
    let id: String
    let type: String
    let duration: Int
    let emoji: String

    init(type: String, duration: Int) {
        self.id = UUID().uuidString
        self.type = type
        self.duration = duration
        self.emoji = WidgetWorkout.emojiFor(type: type)
    }

    static func emojiFor(type: String) -> String {
        switch type.lowercased() {
        case "running": return "🏃‍♂️"
        case "cycling": return "🚴‍♂️"
        case "walking": return "🚶‍♂️"
        case "strength": return "🏋️‍♂️"
        case "yoga": return "🧘‍♂️"
        case "swimming": return "🏊‍♂️"
        case "hiit": return "💪"
        default: return "🏃‍♂️"
        }
    }
}

// MARK: - Simple Widget Data Manager
class WidgetDataManager {
    static let shared = WidgetDataManager()
    private let userDefaults = UserDefaults(suiteName: "group.com.dontskip.app")

    private init() {}

    func getCreditBalance() -> WidgetCreditBalance {
        guard let userDefaults = userDefaults else {
            print("WidgetDataManager: No userDefaults available")
            return WidgetCreditBalance(availableCredits: 0, emergencyCredits: 30)
        }

        let availableCredits = userDefaults.integer(forKey: "widget_availableCredits")
        let emergencyCredits = userDefaults.integer(forKey: "widget_emergencyCredits")

        print(
            "WidgetDataManager: Read credits - Available: \(availableCredits), Emergency: \(emergencyCredits)"
        )

        return WidgetCreditBalance(
            availableCredits: availableCredits,
            emergencyCredits: emergencyCredits
        )
    }

    func getTodaysCodingTime() -> Double {
        return userDefaults?.double(forKey: "widget_todaysCodingTime") ?? 0.0
    }

    func isLocked() -> Bool {
        return userDefaults?.bool(forKey: "widget_isLocked") ?? true
    }

    func getAvailableCredits() -> Int {
        return userDefaults?.integer(forKey: "widget_availableCredits") ?? 0
    }

    func getEmergencyCredits() -> Int {
        return userDefaults?.integer(forKey: "widget_emergencyCredits") ?? 0
    }

    func getRecentWorkoutsCount() -> Int {
        return userDefaults?.integer(forKey: "widget_workoutCount") ?? 0
    }

    func hasValidData() -> Bool {
        return userDefaults?.object(forKey: "widget_lastUpdate") != nil
    }
}

// MARK: - Timeline Provider
struct DontSkipTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> DontSkipEntry {
        DontSkipEntry(
            date: Date(),
            creditBalance: WidgetCreditBalance(availableCredits: 120, emergencyCredits: 30),
            todaysCodingTime: 0.0,
            isLocked: false,
            workoutCount: 0
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (DontSkipEntry) -> Void) {
        let widgetData = WidgetDataManager.shared

        if widgetData.hasValidData() {
            // Use real data from main app
            let entry = DontSkipEntry(
                date: Date(),
                creditBalance: widgetData.getCreditBalance(),
                todaysCodingTime: widgetData.getTodaysCodingTime(),
                isLocked: widgetData.isLocked(),
                workoutCount: widgetData.getRecentWorkoutsCount()
            )
            completion(entry)
        } else {
            // No user data available - show placeholder
            completion(placeholder(in: context))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DontSkipEntry>) -> Void) {
        let widgetData = WidgetDataManager.shared
        let currentDate = Date()

        let entry: DontSkipEntry
        if widgetData.hasValidData() {
            // Use real data from main app
            entry = DontSkipEntry(
                date: currentDate,
                creditBalance: widgetData.getCreditBalance(),
                todaysCodingTime: widgetData.getTodaysCodingTime(),
                isLocked: widgetData.isLocked(),
                workoutCount: widgetData.getRecentWorkoutsCount()
            )
        } else {
            // No user data available - show placeholder
            entry = DontSkipEntry(
                date: currentDate,
                creditBalance: WidgetCreditBalance(availableCredits: 0, emergencyCredits: 30),
                todaysCodingTime: 0.0,
                isLocked: true,
                workoutCount: 0
            )
        }

        // Create timeline that refreshes every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Timeline Entry
struct DontSkipEntry: TimelineEntry {
    let date: Date
    let creditBalance: WidgetCreditBalance
    let todaysCodingTime: Double
    let isLocked: Bool
    let workoutCount: Int
}

// MARK: - Widget Views
struct SmallWidgetView: View {
    let entry: DontSkipEntry

    var body: some View {
        VStack(spacing: 4) {
            // Status icon and credits
            HStack {
                Image(systemName: entry.isLocked ? "lock.fill" : "bolt.fill")
                    .foregroundColor(entry.isLocked ? .red : .green)
                    .font(.system(size: 16, weight: .semibold))

                Spacer()

                Text(
                    "\(Int(entry.creditBalance.availableCredits / 60))h \(entry.creditBalance.availableCredits % 60)m"
                )
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(entry.isLocked ? .red : .primary)
            }

            Spacer()

            // Quick action hint
            VStack(spacing: 2) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 20))
                    .foregroundColor(.blue)
                Text("Add Workout")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.blue)
            }
        }
        .padding(12)
        .widgetURL(URL(string: "dontskip://addworkout"))
    }
}

struct MediumWidgetView: View {
    let entry: DontSkipEntry

    var body: some View {
        HStack(spacing: 12) {
            // Left side - Status and credits
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: entry.isLocked ? "lock.fill" : "bolt.fill")
                        .foregroundColor(entry.isLocked ? .red : .green)
                        .font(.system(size: 18, weight: .semibold))

                    Text(entry.isLocked ? "Locked" : "Available")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(entry.isLocked ? .red : .primary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(
                        "Credits: \(Int(entry.creditBalance.availableCredits / 60))h \(entry.creditBalance.availableCredits % 60)m"
                    )
                    .font(.system(size: 12, weight: .medium))
                    Text("Today: \(String(format: "%.1f", entry.todaysCodingTime))h")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }

                Spacer()
            }

            Spacer()

            // Right side - Quick actions
            VStack(spacing: 8) {
                VStack {
                    Text("\(entry.workoutCount)")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(.blue)
                    Text("Workouts")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)

                Text("Tap to add more")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)

                Spacer()
            }
        }
        .padding(16)
        .widgetURL(URL(string: "dontskip://addworkout"))
    }
}

struct LargeWidgetView: View {
    let entry: DontSkipEntry

    var body: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                VStack(alignment: .leading) {
                    Text("Don't Skip")
                        .font(.system(size: 18, weight: .bold))
                    Text(entry.isLocked ? "Workout needed!" : "Keep coding!")
                        .font(.system(size: 14))
                        .foregroundColor(entry.isLocked ? .red : .green)
                }

                Spacer()

                Image(systemName: entry.isLocked ? "lock.fill" : "bolt.fill")
                    .foregroundColor(entry.isLocked ? .red : .green)
                    .font(.system(size: 24, weight: .semibold))
            }

            // Stats Grid
            HStack(spacing: 20) {
                VStack {
                    Text(
                        "\(Int(entry.creditBalance.availableCredits / 60))h \(entry.creditBalance.availableCredits % 60)m"
                    )
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(entry.isLocked ? .red : .primary)
                    Text("Credits Left")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }

                VStack {
                    Text("\(String(format: "%.1f", entry.todaysCodingTime))h")
                        .font(.system(size: 16, weight: .semibold))
                    Text("Today")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }

                VStack {
                    Text("\(entry.workoutCount)")
                        .font(.system(size: 16, weight: .semibold))
                    Text("Workouts")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }
            }

            // Progress hint
            HStack {
                Text("💪 Earn 2 minutes of coding per minute of workout")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.gray.opacity(0.1))
            .cornerRadius(6)

            // Action hint
            Text("Tap to add workouts and earn credits")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.blue)
        }
        .padding(16)
        .widgetURL(URL(string: "dontskip://addworkout"))
    }
}

// MARK: - Widget Entry View
struct DontSkipWidgetEntryView: View {
    var entry: DontSkipTimelineProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        case .systemLarge:
            LargeWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Widget Configuration
struct DontSkipWidget: Widget {
    let kind: String = "DontSkipWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DontSkipTimelineProvider()) { entry in
            if #available(iOS 17.0, *) {
                DontSkipWidgetEntryView(entry: entry)
                    .containerBackground(.fill.tertiary, for: .widget)
            } else {
                DontSkipWidgetEntryView(entry: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName("Don't Skip")
        .description("Track your workout credits and coding time.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Previews
#Preview(as: .systemSmall) {
    DontSkipWidget()
} timeline: {
    DontSkipEntry(
        date: .now,
        creditBalance: WidgetCreditBalance(availableCredits: 120, emergencyCredits: 30),
        todaysCodingTime: 6.2,
        isLocked: false,
        workoutCount: 3
    )
    DontSkipEntry(
        date: .now,
        creditBalance: WidgetCreditBalance(availableCredits: 15, emergencyCredits: 30),
        todaysCodingTime: 7.8,
        isLocked: true,
        workoutCount: 5
    )
}
