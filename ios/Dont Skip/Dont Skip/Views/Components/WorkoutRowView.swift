import SwiftUI

struct WorkoutRowView: View {
    let workout: Workout
    
    var body: some View {
        HStack(spacing: 12) {
            // Workout Type Icon
            Text(workout.type.emoji)
                .font(.title2)
                .frame(width: 40, height: 40)
                .background(Color(.systemGray6))
                .cornerRadius(8)
            
            // Workout Details
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(workout.type.displayName)
                        .font(.headline)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Text(workout.durationString)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    Text(workout.source.displayName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    if let calories = workout.calories {
                        Text("• \(calories) cal")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    if let distance = workout.distance {
                        Text("• \(distance/1000, specifier: "%.1f") km")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Text("+\(workout.creditsEarned)m")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(Color(.systemGreen))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color(.systemGreen).opacity(0.1))
                        .cornerRadius(4)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    VStack {
        WorkoutRowView(workout: Workout(
            id: "1",
            type: .running,
            startTime: Date(),
            endTime: Date().addingTimeInterval(1800),
            duration: 30,
            calories: 250,
            heartRate: nil,
            distance: 5000,
            source: .healthKit,
            creditsAwarded: 60,
            verified: true,
            processed: nil
        ))
        
        WorkoutRowView(workout: Workout(
            id: "2",
            type: .strength,
            startTime: Date().addingTimeInterval(-3600),
            endTime: Date().addingTimeInterval(-2700),
            duration: 45,
            calories: 180,
            heartRate: nil,
            distance: nil,
            source: .manual,
            creditsAwarded: 90,
            verified: false,
            processed: nil
        ))
    }
    .padding()
}