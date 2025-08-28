//
//  ContentView.swift
//  Dont Skip
//
//  Created by Herbert Kanengoni on 25/08/2025.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    var body: some View {
        Group {
            if appState.isAuthenticated {
                MainTabView()
            } else {
                WelcomeView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: appState.isAuthenticated)
    }
}

struct WelcomeView: View {
    @EnvironmentObject var appState: AppState
    @State private var showingAuth = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 32) {
                Spacer()
                
                // Logo and branding
                VStack(spacing: 16) {
                    Image(systemName: "figure.run.circle.fill")
                        .font(.system(size: 100))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.blue, .purple],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    
                    Text("Don't Skip")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundColor(.primary)
                    
                    Text("Your code runs better when you do")
                        .font(.title3)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                
                Spacer()
                
                // Features preview
                VStack(spacing: 20) {
                    FeatureRow(
                        icon: "heart.fill",
                        title: "Track Workouts",
                        description: "Connect Apple Health, Strava, and more",
                        color: Color(.systemRed)
                    )
                    
                    FeatureRow(
                        icon: "clock.fill",
                        title: "Earn Credits",
                        description: "2 minutes of coding time per workout minute",
                        color: .blue
                    )
                    
                    FeatureRow(
                        icon: "lock.fill",
                        title: "Stay Motivated",
                        description: "Code editor locks when credits run out",
                        color: .orange
                    )
                }
                .padding(.horizontal)
                
                Spacer()
                
                // Action buttons
                VStack(spacing: 12) {
                    Button("Get Started") {
                        showingAuth = true
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    
                    Button("Continue as Guest") {
                        appState.setAuthenticated(true)
                    }
                    .buttonStyle(SecondaryButtonStyle())
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 32)
            }
            .navigationBarHidden(true)
        }
        .sheet(isPresented: $showingAuth) {
            AuthenticationView()
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
                .frame(width: 32, height: 32)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
    }
}



#Preview {
    ContentView()
        .environmentObject(AppState())
        .environmentObject(APIService())
        .environmentObject(HealthKitManager())
        .environmentObject(IntegrationManager(apiService: APIService(), healthKitManager: HealthKitManager()))
        .environmentObject(StoreKitManager())
        .environmentObject(PremiumGateService(storeKitManager: StoreKitManager()))
        .environmentObject(APIService())
        .environmentObject(HealthKitManager())
        .environmentObject(IntegrationManager(apiService: APIService(), healthKitManager: HealthKitManager()))
}
