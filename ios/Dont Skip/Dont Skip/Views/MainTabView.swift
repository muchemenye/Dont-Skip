import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        TabView(selection: $appState.selectedTab) {
            DashboardView()
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Dashboard")
                }
                .tag(0)

            WorkoutsView()
                .tabItem {
                    Image(systemName: "figure.run")
                    Text("Workouts")
                }
                .tag(1)

            IntegrationsView()
                .tabItem {
                    Image(systemName: "link")
                    Text("Integrations")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
                .tag(3)
        }
        .accentColor(.blue)
    }
}
