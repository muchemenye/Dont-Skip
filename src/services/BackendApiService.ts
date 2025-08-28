import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import { URL } from "url";
import * as crypto from "crypto";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface WorkoutData {
  id: string;
  source:
    | "whoop"
    | "strava"
    | "fitbit"
    | "apple-health"
    | "google-fit"
    | "manual";
  type: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  calories?: number;
  heartRate?: {
    average?: number;
    max?: number;
  };
  distance?: number;
  verified: boolean;
  processed: boolean;
}

interface CreditBalance {
  availableCredits: number;
  maxDailyCredits: number;
  emergencyCredits: number;
}

export class BackendApiService {
  private context: vscode.ExtensionContext;
  private baseUrl: string;
  private deviceId: string;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.baseUrl = this.getBackendUrl();
    this.deviceId = this.getOrCreateDeviceId();
  }

  private getBackendUrl(): string {
    const config = vscode.workspace.getConfiguration("dontSkip");
    return config.get("backendUrl", "http://localhost:3000");
  }

  private getOrCreateDeviceId(): string {
    let deviceId = this.context.globalState.get<string>("deviceId");
    if (!deviceId) {
      // SECURITY: Generate cryptographically secure device ID
      deviceId = this.generateSecureDeviceId();
      this.context.globalState.update("deviceId", deviceId);
    }
    return deviceId;
  }

  private generateSecureDeviceId(): string {
    // SECURITY: Generate a secure, unique device identifier
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(16).toString("hex");
    const machineId = crypto
      .createHash("sha256")
      .update(
        process.platform +
          process.arch +
          (process.env.USERNAME || process.env.USER || "unknown")
      )
      .digest("hex")
      .substring(0, 8);

    return `vscode_${timestamp}_${randomBytes}_${machineId}`;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      requireAuth?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Device-ID": this.deviceId,
    };

    if (options.requireAuth !== false) {
      const token = await this.getAuthToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    const requestOptions = {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    try {
      const response = await this.httpRequest(url, requestOptions);
      const data = await response.json();

      // Handle token expiration
      if (response.status === 401 && options.requireAuth !== false) {
        await this.clearAuthToken();
        throw new Error("Authentication required");
      }

      return data;
    } catch (error) {
      // SECURITY: Never log sensitive request details that might contain auth tokens
      console.error(`API request failed: ${endpoint}`, {
        status: error instanceof Error ? "network_error" : "unknown_error",
        message: error instanceof Error ? error.message : "Request failed",
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Request failed",
      };
    }
  }

  private httpRequest(
    url: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ): Promise<{
    ok: boolean;
    status: number;
    json: () => Promise<any>;
    text: () => Promise<string>;
  }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === "https:";
      const client = isHttps ? https : http;

      const headers: Record<string, string | number> = {
        "User-Agent": "VSCode-WorkoutLockout/1.0",
        ...options.headers,
      };

      if (options.body) {
        headers["Content-Length"] = Buffer.byteLength(options.body);
      }

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || "GET",
        headers: headers,
      };

      const req = client.request(requestOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({
            ok: res.statusCode! >= 200 && res.statusCode! < 300,
            status: res.statusCode!,
            json: async () => JSON.parse(data),
            text: async () => data,
          });
        });
      });

      req.on("error", reject);

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    });
  }

  // Authentication methods
  async register(email: string, password: string): Promise<boolean> {
    // SECURITY: Input validation and sanitization
    if (!this.isValidEmail(email)) {
      throw new Error("Invalid email format");
    }
    if (!this.isValidPassword(password)) {
      throw new Error("Password does not meet security requirements");
    }

    const response = await this.makeRequest<{ token: string; user: any }>(
      "/auth/register",
      {
        method: "POST",
        body: {
          email: email.toLowerCase().trim(),
          password,
          deviceId: this.deviceId,
        },
        requireAuth: false,
      }
    );

    if (response.success && response.data?.token) {
      await this.secureTokenStorage(
        response.data.token,
        email.toLowerCase().trim()
      );
      return true;
    }

    return false;
  }

  async logout(): Promise<void> {
    // Call backend logout endpoint if authenticated
    const token = await this.getAuthToken();
    if (token) {
      try {
        await this.makeRequest("/auth/logout", {
          method: "POST",
          requireAuth: true,
        });
      } catch (error) {
        // Continue with local logout even if backend call fails
        // SECURITY: Don't log detailed error that might expose token info
        console.warn("Backend logout failed, continuing with local logout");
      }
    }

    // SECURITY: Comprehensive state clearing
    await this.secureLogout();
  }

  async login(
    email: string,
    password: string,
    mfaToken?: string
  ): Promise<boolean> {
    // SECURITY: Input validation
    if (!this.isValidEmail(email)) {
      throw new Error("Invalid email format");
    }

    const response = await this.makeRequest<{
      token: string;
      user: any;
      mfaRequired?: boolean;
    }>("/auth/login", {
      method: "POST",
      body: {
        email: email.toLowerCase().trim(),
        password,
        deviceId: this.deviceId,
        mfaToken,
      },
      requireAuth: false,
    });

    if (response.success && response.data?.token) {
      await this.secureTokenStorage(
        response.data.token,
        email.toLowerCase().trim()
      );
      return true;
    }

    // Handle MFA requirement
    if (response.data?.mfaRequired) {
      return await this.handleMFALogin(email, password);
    }

    return false;
  }

  private async handleMFALogin(
    email: string,
    password: string
  ): Promise<boolean> {
    const mfaToken = await vscode.window.showInputBox({
      prompt: "🔐 Enter your 6-digit authenticator code",
      placeHolder: "123456",
      validateInput: (value) => {
        if (!value || value.length !== 6 || !/^\d{6}$/.test(value)) {
          return "Please enter a 6-digit code";
        }
        return null;
      },
    });

    if (!mfaToken) return false;

    return await this.login(email, password, mfaToken);
  }

  async getAuthToken(): Promise<string | undefined> {
    return this.context.globalState.get<string>("authToken");
  }

  async clearAuthToken(): Promise<void> {
    await this.context.globalState.update("authToken", undefined);
    await this.context.globalState.update("userEmail", undefined);

    // Clear any cached user data to prevent state leakage
    await this.context.globalState.update("userProfile", undefined);
    await this.context.globalState.update("lastSyncTime", undefined);
    await this.context.globalState.update("cachedCredits", undefined);
    await this.context.globalState.update("cachedWorkouts", undefined);

    // Clear device-specific cache but keep device ID for future logins
    await this.context.globalState.update("apiResponseCache", undefined);
  }

  // SECURITY: Enhanced secure authentication methods
  private async secureTokenStorage(
    token: string,
    email: string
  ): Promise<void> {
    // Store authentication data with timestamp for session management
    const authData = {
      token,
      email,
      timestamp: Date.now(),
      deviceId: this.deviceId,
    };

    await this.context.globalState.update("authToken", token);
    await this.context.globalState.update("userEmail", email);
    await this.context.globalState.update("authTimestamp", authData.timestamp);
  }

  private async secureLogout(): Promise<void> {
    // SECURITY: Comprehensive cleanup of all auth-related data
    const keysToClear = [
      "authToken",
      "userEmail",
      "authTimestamp",
      "userProfile",
      "lastSyncTime",
      "cachedCredits",
      "cachedWorkouts",
      "apiResponseCache",
      "mfaBackupCodes",
      "sessionData",
    ];

    for (const key of keysToClear) {
      await this.context.globalState.update(key, undefined);
    }

    // Clear any workout history cache keys
    const allKeys = this.context.globalState.keys();
    for (const key of allKeys) {
      if (
        key.startsWith("workout_") ||
        key.startsWith("credit_") ||
        key.startsWith("session_")
      ) {
        await this.context.globalState.update(key, undefined);
      }
    }
  }

  private isValidEmail(email: string): boolean {
    // SECURITY: Proper email validation to prevent injection
    if (!email || typeof email !== "string") return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email.length <= 254 && emailRegex.test(email.trim());
  }

  private isValidPassword(password: string): boolean {
    // SECURITY: Password strength validation
    if (!password || typeof password !== "string") return false;
    return (
      password.length >= 8 &&
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(
        password
      )
    );
  }

  private async isSessionValid(): Promise<boolean> {
    // SECURITY: Check if auth session is still valid (not expired)
    const authTimestamp = this.context.globalState.get<number>("authTimestamp");
    if (!authTimestamp) return false;

    // Session expires after 7 days of inactivity
    const SESSION_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    return Date.now() - authTimestamp < SESSION_TIMEOUT;
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAuthToken();
    if (!token) return false;

    // SECURITY: Check session validity first
    if (!(await this.isSessionValid())) {
      await this.secureLogout();
      return false;
    }

    try {
      const response = await this.makeRequest("/user/profile");
      if (response.success) {
        // Update last activity timestamp
        await this.context.globalState.update("authTimestamp", Date.now());
        return true;
      }
      return false;
    } catch (error) {
      // If there's any error (network, auth, etc.), consider not authenticated
      console.log("Authentication check failed - clearing session");
      await this.secureLogout();
      return false;
    }
  }

  // Workout methods
  async syncWorkouts(hours: number = 24): Promise<WorkoutData[]> {
    const response = await this.makeRequest<{
      workouts: WorkoutData[];
      creditsAwarded: number;
      message: string;
    }>("/workouts/sync", {
      method: "POST",
      body: { hours },
    });

    if (response.success && response.data) {
      // Show notification about sync results
      if (response.data.creditsAwarded > 0) {
        vscode.window.showInformationMessage(`🏃‍♂️ ${response.data.message}`);
      }
      return response.data.workouts;
    }

    return [];
  }

  async getRecentWorkouts(hours: number = 24): Promise<WorkoutData[]> {
    const response = await this.makeRequest<WorkoutData[]>(
      `/workouts?hours=${hours}`
    );
    return response.success && response.data ? response.data : [];
  }

  async addManualWorkout(workout: {
    type: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    calories?: number;
    distance?: number;
  }): Promise<boolean> {
    const response = await this.makeRequest("/workouts", {
      method: "POST",
      body: workout,
    });

    if (response.success) {
      vscode.window.showInformationMessage(
        `✅ Manual workout added successfully!`
      );
      return true;
    } else {
      vscode.window.showErrorMessage(
        `❌ Failed to add workout: ${response.error}`
      );
      return false;
    }
  }

  // Credit methods
  async getCreditBalance(): Promise<CreditBalance | null> {
    const response = await this.makeRequest<CreditBalance>("/credits/balance");
    return response.success && response.data ? response.data : null;
  }

  async spendCredits(
    minutes: number,
    reason: string = "Coding session"
  ): Promise<boolean> {
    const response = await this.makeRequest("/credits/spend", {
      method: "POST",
      body: { minutes, reason },
    });

    return response.success;
  }

  async useEmergencyCredits(minutes: number): Promise<boolean> {
    const response = await this.makeRequest("/credits/emergency", {
      method: "POST",
      body: { minutes },
    });

    if (response.success) {
      vscode.window.showWarningMessage(
        `⚠️ Used ${minutes} emergency credits. Complete a workout to earn more!`
      );
      return true;
    } else {
      vscode.window.showErrorMessage(
        `❌ ${response.error || "Failed to use emergency credits"}`
      );
      return false;
    }
  }

  // Integration methods
  async getIntegrations(): Promise<any[]> {
    const response = await this.makeRequest<any[]>("/integrations");
    return response.success && Array.isArray(response.data)
      ? response.data
      : [];
  }

  async connectIntegration(
    provider: string,
    accessToken: string,
    refreshToken?: string
  ): Promise<boolean> {
    const response = await this.makeRequest("/integrations/connect", {
      method: "POST",
      body: { provider, accessToken, refreshToken },
    });

    if (response.success) {
      vscode.window.showInformationMessage(`✅ Connected to ${provider}!`);
      return true;
    } else {
      vscode.window.showErrorMessage(
        `❌ Failed to connect to ${provider}: ${response.error}`
      );
      return false;
    }
  }

  async disconnectIntegration(provider: string): Promise<boolean> {
    const response = await this.makeRequest(`/integrations/${provider}`, {
      method: "DELETE",
    });

    if (response.success) {
      vscode.window.showInformationMessage(`Disconnected from ${provider}`);
      return true;
    }

    return false;
  }

  // User settings methods
  async updateSettings(settings: any): Promise<boolean> {
    const response = await this.makeRequest("/user/settings", {
      method: "PUT",
      body: { settings },
    });

    if (response.success) {
      vscode.window.showInformationMessage("Settings updated successfully");
      return true;
    } else {
      vscode.window.showErrorMessage(
        `Failed to update settings: ${response.error}`
      );
      return false;
    }
  }

  // Get user profile
  async getUserProfile(): Promise<any> {
    const response = await this.makeRequest("/user/profile");
    if (response.success) {
      return response.data;
    }
    throw new Error(response.error || "Failed to get user profile");
  }

  // Reset data (for testing)
  async resetAllData(): Promise<boolean> {
    const response = await this.makeRequest("/workouts/reset/all", {
      method: "DELETE",
    });

    if (response.success) {
      vscode.window.showInformationMessage(
        "🔄 Backend data reset successfully"
      );
      return true;
    } else {
      vscode.window.showErrorMessage(
        `❌ Failed to reset backend data: ${response.error}`
      );
      return false;
    }
  }

  // Health check
  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest("/health", {
        requireAuth: false,
      });
      return response.success;
    } catch {
      return false;
    }
  }
}
