import Combine
import Foundation

class APIService: ObservableObject {
    private let baseURL = Config.baseURL
    private let session = URLSession.shared
    private var cancellables = Set<AnyCancellable>()

    @Published var isAuthenticated = false
    private var authToken: String?
    private var deviceId: String

    init() {
        self.deviceId = Self.getOrCreateDeviceId()
        loadSavedAuth()
    }

    // MARK: - Authentication

    func loadSavedAuth() {
        if let token = KeychainHelper.load(key: "authToken") {
            self.authToken = String(data: token, encoding: .utf8)
            self.isAuthenticated = true
        }
    }

    func register(email: String, password: String) -> AnyPublisher<AuthResponse, APIError> {
        let body = [
            "email": email,
            "password": password,
            "deviceId": deviceId,
        ]

        return makeRequest(
            endpoint: "/auth/register",
            method: "POST",
            body: body,
            requireAuth: false
        )
        .handleEvents(receiveOutput: { [weak self] response in
            self?.saveAuthToken(response.token)
        })
        .eraseToAnyPublisher()
    }

    func login(email: String, password: String, mfaToken: String? = nil) -> AnyPublisher<
        AuthResponse, APIError
    > {
        var body: [String: Any] = [
            "email": email,
            "password": password,
            "deviceId": deviceId,
        ]

        if let mfaToken = mfaToken {
            body["mfaToken"] = mfaToken
        }

        return makeRequest(
            endpoint: "/auth/login",
            method: "POST",
            body: body,
            requireAuth: false
        )
        .handleEvents(receiveOutput: { [weak self] response in
            self?.saveAuthToken(response.token)
        })
        .eraseToAnyPublisher()
    }

    func logout() {
        authToken = nil
        isAuthenticated = false

        // Clear from keychain
        KeychainHelper.delete(key: "authToken")

        // Clear any cached API responses
        URLCache.shared.removeAllCachedResponses()

        // Clear any other authentication-related cached data
        UserDefaults.standard.removeObject(forKey: "api_cache")
        UserDefaults.standard.removeObject(forKey: "last_api_sync")
    }

    // MARK: - Workouts

    func syncWorkouts(hours: Int = 24) -> AnyPublisher<WorkoutSyncResponse, APIError> {
        let body = ["hours": hours]

        return makeRequest(
            endpoint: "/workouts/sync",
            method: "POST",
            body: body,
            requireAuth: true
        )
    }

    func addManualWorkout(_ workout: Workout) -> AnyPublisher<Workout, APIError> {
        let body: [String: Any] = [
            "type": workout.type.rawValue,
            "startTime": ISO8601DateFormatter().string(from: workout.startTime),
            "endTime": ISO8601DateFormatter().string(from: workout.endTime),
            "duration": workout.duration,
            "calories": workout.calories as Any,
            "distance": workout.distance as Any,
            "source": workout.source.rawValue,
        ]

        return makeRequest(
            endpoint: "/workouts",
            method: "POST",
            body: body,
            requireAuth: true
        )
    }

    func getRecentWorkouts(hours: Int = 24) -> AnyPublisher<[Workout], APIError> {
        return makeRequest(
            endpoint: "/workouts?hours=\(hours)",
            method: "GET",
            body: nil,
            requireAuth: true
        )
    }

    // MARK: - Credits

    func getCreditBalance() -> AnyPublisher<CreditBalance, APIError> {
        return makeRequest(
            endpoint: "/credits/balance",
            method: "GET",
            body: nil,
            requireAuth: true
        )
    }

    // MARK: - Integrations

    func getIntegrations() -> AnyPublisher<[Integration], APIError> {
        return makeRequest(
            endpoint: "/integrations",
            method: "GET",
            body: nil,
            requireAuth: true
        )
    }

    func connectIntegration(_ integration: IntegrationType, authCode: String) -> AnyPublisher<
        Integration, APIError
    > {
        let body = [
            "type": integration.rawValue,
            "authCode": authCode,
        ]

        return makeRequest(
            endpoint: "/integrations/connect",
            method: "POST",
            body: body,
            requireAuth: true
        )
    }

    func disconnectIntegration(_ integration: IntegrationType) -> AnyPublisher<Bool, APIError> {
        return makeRequest(
            endpoint: "/integrations/\(integration.rawValue)/disconnect",
            method: "DELETE",
            body: nil,
            requireAuth: true
        )
        .map { (_: EmptyResponse) in true }
        .eraseToAnyPublisher()
    }

    func syncIntegration(_ integration: IntegrationType) -> AnyPublisher<
        WorkoutSyncResponse, APIError
    > {
        return makeRequest(
            endpoint: "/integrations/\(integration.rawValue)/sync",
            method: "POST",
            body: nil,
            requireAuth: true
        )
    }

    // MARK: - Health Check

    func checkConnection() -> AnyPublisher<Bool, APIError> {
        return makeRequest(
            endpoint: "/health",
            method: "GET",
            body: nil,
            requireAuth: false
        )
        .map { (_: EmptyResponse) in true }
        .catch { _ in Just(false).setFailureType(to: APIError.self) }
        .eraseToAnyPublisher()
    }

    // MARK: - Account Management

    func changePassword(currentPassword: String, newPassword: String) -> AnyPublisher<
        EmptyResponse, APIError
    > {
        let body = [
            "currentPassword": currentPassword,
            "newPassword": newPassword,
        ]

        return makeRequest(
            endpoint: "/auth/change-password",
            method: "PUT",
            body: body,
            requireAuth: true
        )
    }

    func deleteAccount() -> AnyPublisher<EmptyResponse, APIError> {
        return makeRequest(
            endpoint: "/auth/delete-account",
            method: "DELETE",
            body: nil,
            requireAuth: true
        )
        .handleEvents(receiveOutput: { [weak self] _ in
            // Clear auth token when account is deleted
            self?.logout()
        })
        .eraseToAnyPublisher()
    }

    func updateProfile(email: String? = nil) -> AnyPublisher<User, APIError> {
        var body: [String: Any] = [:]

        if let email = email {
            body["email"] = email
        }

        return makeRequest(
            endpoint: "/auth/profile",
            method: "PUT",
            body: body,
            requireAuth: true
        )
    }

    // MARK: - Private Methods

    private func makeRequest<T: Codable>(
        endpoint: String,
        method: String,
        body: [String: Any]? = nil,
        requireAuth: Bool = true
    ) -> AnyPublisher<T, APIError> {

        guard let url = URL(string: baseURL + endpoint) else {
            return Fail(error: APIError.invalidURL)
                .eraseToAnyPublisher()
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(deviceId, forHTTPHeaderField: "X-Device-ID")
        request.timeoutInterval = Config.apiTimeout

        // Only set Content-Type for requests with body
        if body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        if requireAuth, let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            do {
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
            } catch {
                return Fail(error: APIError.encodingError)
                    .eraseToAnyPublisher()
            }
        }

        return session.dataTaskPublisher(for: request)
            .tryMap { data, response in
                // Log the raw response for debugging
                if let httpResponse = response as? HTTPURLResponse {
                    print("API Response [\(httpResponse.statusCode)]: \(endpoint)")
                    if let responseString = String(data: data, encoding: .utf8) {
                        print("Response body: \(responseString)")
                    }
                }
                return data
            }
            .decode(type: APIResponse<T>.self, decoder: JSONDecoder.dontSkip)
            .tryMap { response in
                if response.success, let data = response.data {
                    return data
                } else {
                    throw APIError.serverError(response.error ?? "Unknown error")
                }
            }
            .mapError { error in
                if let apiError = error as? APIError {
                    return apiError
                } else if let decodingError = error as? DecodingError {
                    print("Decoding error: \(decodingError)")
                    return APIError.decodingError
                } else {
                    print("Network error: \(error)")
                    return APIError.networkError
                }
            }
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }

    private func saveAuthToken(_ token: String) {
        self.authToken = token
        self.isAuthenticated = true
        KeychainHelper.save(key: "authToken", data: token.data(using: .utf8)!)
    }

    private static func getOrCreateDeviceId() -> String {
        let key = "deviceId"
        if let data = KeychainHelper.load(key: key),
            let deviceId = String(data: data, encoding: .utf8)
        {
            return deviceId
        }

        let newDeviceId = UUID().uuidString
        KeychainHelper.save(key: key, data: newDeviceId.data(using: .utf8)!)
        return newDeviceId
    }
}

// MARK: - Supporting Types

enum APIError: Error, LocalizedError {
    case invalidURL
    case networkError
    case encodingError
    case decodingError
    case serverError(String)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .networkError:
            return "Network connection error"
        case .encodingError:
            return "Failed to encode request"
        case .decodingError:
            return "Failed to decode response"
        case .serverError(let message):
            return message
        case .unauthorized:
            return "Authentication required"
        }
    }
}

struct EmptyResponse: Codable {}

extension JSONDecoder {
    static let dontSkip: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()

            // Try to decode as ISO8601 string first
            if let dateString = try? container.decode(String.self) {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                if let date = formatter.date(from: dateString) {
                    return date
                }

                // Fallback to standard ISO8601 without fractional seconds
                formatter.formatOptions = [.withInternetDateTime]
                if let date = formatter.date(from: dateString) {
                    return date
                }
            }

            // Try to decode as timestamp
            if let timestamp = try? container.decode(Double.self) {
                return Date(timeIntervalSince1970: timestamp / 1000)  // Handle milliseconds
            }

            throw DecodingError.dataCorruptedError(
                in: container, debugDescription: "Cannot decode date")
        }
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }()
}
