import SwiftUI

struct AuthenticationView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.dismiss) private var dismiss
    
    @State private var email = ""
    @State private var password = ""
    @State private var isLogin = true
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    Spacer(minLength: 40)
                    
                    // Logo
                    Image(systemName: "figure.run.circle.fill")
                        .font(.system(size: 80))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.blue, .purple],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                    
                    // Title
                    VStack(spacing: 8) {
                        Text(isLogin ? "Welcome Back" : "Create Account")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        
                        Text(isLogin ? "Sign in to continue" : "Join Don't Skip today")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    
                    // Form
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Email")
                                .font(.headline)
                                .fontWeight(.medium)
                            
                            TextField("Enter your email", text: $email)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .disableAutocorrection(true)
                        }
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Password")
                                .font(.headline)
                                .fontWeight(.medium)
                            
                            SecureField("Enter your password", text: $password)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                        }
                        
                        if let errorMessage = errorMessage {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundColor(Color(.systemRed))
                                .padding(.horizontal)
                        }
                        
                        Button(isLogin ? "Sign In" : "Create Account") {
                            authenticate()
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .disabled(email.isEmpty || password.isEmpty || isLoading)
                        
                        Button(isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in") {
                            withAnimation {
                                isLogin.toggle()
                                errorMessage = nil
                            }
                        }
                        .font(.subheadline)
                        .foregroundColor(Color(.systemBlue))
                    }
                    .padding(.horizontal, 32)
                    
                    Spacer()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
        .overlay {
            if isLoading {
                Color(.systemBackground).opacity(0.3)
                    .ignoresSafeArea()
                
                ProgressView("Authenticating...")
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(8)
            }
        }
    }
    
    private func authenticate() {
        errorMessage = nil
        isLoading = true
        
        let publisher = isLogin ? 
            apiService.login(email: email, password: password) :
            apiService.register(email: email, password: password)
        
        publisher
            .sink(
                receiveCompletion: { completion in
                    isLoading = false
                    if case .failure(let error) = completion {
                        errorMessage = error.localizedDescription
                    }
                },
                receiveValue: { response in
                    appState.setAuthenticated(true, user: response.user)
                    dismiss()
                }
            )
            .store(in: &appState.cancellables)
    }
}

#Preview {
    AuthenticationView()
        .environmentObject(AppState())
        .environmentObject(APIService())
        .environmentObject(StoreKitManager())
        .environmentObject(PremiumGateService(storeKitManager: StoreKitManager()))
}