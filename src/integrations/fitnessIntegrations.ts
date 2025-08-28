import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import { URL } from "url";
import * as crypto from "crypto";

// HTTP helper function to replace fetch
function makeRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
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

export interface WorkoutData {
  id: string;
  source: "whoop" | "strava" | "fitbit" | "apple-health" | "manual";
  type: string; // 'running', 'cycling', 'strength', etc.
  startTime: Date;
  endTime: Date;
  duration: number; // minutes
  calories?: number;
  heartRate?: {
    average?: number;
    max?: number;
  };
  distance?: number; // meters
  verified: boolean;
}

export interface FitnessIntegration {
  name: string;
  isConnected(): Promise<boolean>;
  authenticate(): Promise<boolean>;
  getRecentWorkouts(hours?: number): Promise<WorkoutData[]>;
  disconnect(): Promise<void>;
}

export class FitnessIntegrationManager {
  private context: vscode.ExtensionContext;
  private integrations: Map<string, FitnessIntegration> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.initializeIntegrations();
  }

  private initializeIntegrations(): void {
    // Register available integrations
    this.integrations.set("whoop", new WhoopIntegration(this.context));
    this.integrations.set("strava", new StravaIntegration(this.context));
    this.integrations.set("fitbit", new FitbitIntegration(this.context));
    this.integrations.set(
      "ios-companion",
      new iOSCompanionIntegration(this.context)
    );
  }

  async getConnectedIntegrations(): Promise<string[]> {
    const connected: string[] = [];
    for (const [name, integration] of this.integrations) {
      if (await integration.isConnected()) {
        connected.push(name);
      }
    }
    return connected;
  }

  async connectIntegration(name: string): Promise<boolean> {
    const integration = this.integrations.get(name);
    if (!integration) {
      throw new Error(`Integration ${name} not found`);
    }
    return await integration.authenticate();
  }

  async getRecentWorkouts(hours: number = 24): Promise<WorkoutData[]> {
    const allWorkouts: WorkoutData[] = [];

    for (const [name, integration] of this.integrations) {
      if (await integration.isConnected()) {
        try {
          const workouts = await integration.getRecentWorkouts(hours);
          allWorkouts.push(...workouts);
        } catch (error) {
          console.error(`Error fetching workouts from ${name}:`, error);
        }
      }
    }

    // Remove duplicates and sort by start time
    return this.deduplicateWorkouts(allWorkouts).sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );
  }

  private deduplicateWorkouts(workouts: WorkoutData[]): WorkoutData[] {
    const seen = new Set<string>();
    return workouts.filter((workout) => {
      // Create a unique key based on start time and duration
      const key = `${workout.startTime.getTime()}-${workout.duration}-${
        workout.type
      }`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async disconnectIntegration(name: string): Promise<void> {
    const integration = this.integrations.get(name);
    if (integration) {
      await integration.disconnect();
    }
  }

  async showIntegrationStatus(): Promise<void> {
    const connected = await this.getConnectedIntegrations();
    const available = Array.from(this.integrations.keys());

    let message = "🔗 Fitness Integrations:\n\n";

    if (connected.length === 0) {
      message += "❌ No integrations connected\n\n";
    } else {
      message += "✅ Connected:\n";
      connected.forEach((name) => {
        message += `• ${this.getIntegrationDisplayName(name)}\n`;
      });
      message += "\n";
    }

    const disconnected = available.filter((name) => !connected.includes(name));
    if (disconnected.length > 0) {
      message += "⚪ Available:\n";
      disconnected.forEach((name) => {
        message += `• ${this.getIntegrationDisplayName(name)}\n`;
      });
    }

    const actions = ["Connect Integration", "Disconnect", "Refresh"];
    const selection = await vscode.window.showInformationMessage(
      message,
      ...actions
    );

    if (selection === "Connect Integration") {
      await this.showConnectDialog();
    } else if (selection === "Disconnect") {
      await this.showDisconnectDialog();
    } else if (selection === "Refresh") {
      await this.showIntegrationStatus();
    }
  }

  private async showConnectDialog(): Promise<void> {
    const connected = await this.getConnectedIntegrations();
    const available = Array.from(this.integrations.keys())
      .filter((name) => !connected.includes(name))
      .map((name) => ({
        label: this.getIntegrationDisplayName(name),
        description: this.getIntegrationDescription(name),
        integration: name,
      }));

    if (available.length === 0) {
      vscode.window.showInformationMessage(
        "All available integrations are already connected!"
      );
      return;
    }

    const selection = await vscode.window.showQuickPick(available, {
      placeHolder: "Select a fitness integration to connect",
    });

    if (selection) {
      try {
        const success = await this.connectIntegration(selection.integration);
        if (success) {
          vscode.window.showInformationMessage(
            `✅ Connected to ${selection.label}!`
          );
        } else {
          vscode.window.showWarningMessage(
            `❌ Failed to connect to ${selection.label}`
          );
        }
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error connecting to ${selection.label}: ${error}`
        );
      }
    }
  }

  private async showDisconnectDialog(): Promise<void> {
    const connected = await this.getConnectedIntegrations();

    if (connected.length === 0) {
      vscode.window.showInformationMessage("No integrations to disconnect.");
      return;
    }

    const options = connected.map((name) => ({
      label: this.getIntegrationDisplayName(name),
      integration: name,
    }));

    const selection = await vscode.window.showQuickPick(options, {
      placeHolder: "Select integration to disconnect",
    });

    if (selection) {
      await this.disconnectIntegration(selection.integration);
      vscode.window.showInformationMessage(
        `Disconnected from ${selection.label}`
      );
    }
  }

  private getIntegrationDisplayName(name: string): string {
    const names: Record<string, string> = {
      whoop: "🟡 Whoop",
      strava: "🟠 Strava",
      fitbit: "🔵 Fitbit",
      "ios-companion": "📱 iOS Companion App",
    };
    return names[name] || name;
  }

  private getIntegrationDescription(name: string): string {
    const descriptions: Record<string, string> = {
      whoop: "Strain, recovery, and workout data",
      strava: "Running, cycling, and activity tracking",
      fitbit: "Steps, workouts, and health metrics",
      "ios-companion": "Apple Health and manual workout entry",
    };
    return descriptions[name] || "";
  }
}

// Base class for integrations
abstract class BaseFitnessIntegration implements FitnessIntegration {
  protected context: vscode.ExtensionContext;
  abstract name: string;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  abstract isConnected(): Promise<boolean>;
  abstract authenticate(): Promise<boolean>;
  abstract getRecentWorkouts(hours?: number): Promise<WorkoutData[]>;
  abstract disconnect(): Promise<void>;

  protected getStoredToken(): string | undefined {
    return this.context.globalState.get(`${this.name}_token`);
  }

  protected async storeToken(token: string): Promise<void> {
    await this.context.globalState.update(`${this.name}_token`, token);
  }

  protected async clearToken(): Promise<void> {
    await this.context.globalState.update(`${this.name}_token`, undefined);
  }
}

// Whoop Integration
class WhoopIntegration extends BaseFitnessIntegration {
  name = "whoop";
  private readonly apiBase = "https://api.prod.whoop.com/developer";

  async isConnected(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token) return false;

    try {
      const response = await makeRequest(
        `${this.apiBase}/v1/user/profile/basic`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async authenticate(): Promise<boolean> {
    // For now, show instructions for manual token entry
    // In production, this would use OAuth 2.0 flow
    const token = await vscode.window.showInputBox({
      prompt:
        "Enter your Whoop API token (create app at developer.whoop.com, then generate token)",
      password: true,
      placeHolder: "whoop_access_token_here",
      validateInput: (value) => {
        if (!value || value.length < 10) {
          return "Please enter a valid Whoop API token";
        }
        return null;
      },
    });

    if (!token) return false;

    try {
      const response = await makeRequest(
        `${this.apiBase}/v1/user/profile/basic`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        await this.storeToken(token);
        return true;
      } else {
        vscode.window.showErrorMessage("Invalid Whoop token");
        return false;
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Whoop authentication error: ${error}`);
      return false;
    }
  }

  async getRecentWorkouts(hours: number = 24): Promise<WorkoutData[]> {
    const token = this.getStoredToken();
    if (!token) return [];

    try {
      const end = new Date();
      const start = new Date(end.getTime() - hours * 60 * 60 * 1000);

      const response = await makeRequest(
        `${
          this.apiBase
        }/v1/activity/workout?start=${start.toISOString()}&end=${end.toISOString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) return [];

      const data = await response.json();
      return (
        data.records?.map((workout: any) => ({
          id: workout.id,
          source: "whoop" as const,
          type: this.mapWhoopSportId(workout.sport_id) || "workout",
          startTime: new Date(workout.start),
          endTime: new Date(workout.end),
          duration: Math.round(
            (new Date(workout.end).getTime() -
              new Date(workout.start).getTime()) /
              (1000 * 60)
          ),
          calories: workout.score?.kilojoule
            ? Math.round(workout.score.kilojoule * 0.239006)
            : undefined,
          heartRate: workout.score?.average_heart_rate
            ? {
                average: Math.round(workout.score.average_heart_rate),
                max: Math.round(workout.score.max_heart_rate || 0),
              }
            : undefined,
          verified: true,
        })) || []
      );
    } catch (error) {
      console.error("Whoop API error:", error);
      return [];
    }
  }

  async disconnect(): Promise<void> {
    await this.clearToken();
  }

  private mapWhoopSportId(sportId: number): string {
    // Official Whoop sport IDs from API documentation
    const sportMap: Record<number, string> = {
      0: "running",
      1: "cycling",
      16: "baseball",
      17: "basketball",
      18: "rowing",
      22: "golf",
      24: "ice_hockey",
      29: "skiing",
      30: "soccer",
      33: "swimming",
      34: "tennis",
      39: "boxing",
      43: "pilates",
      44: "yoga",
      45: "weightlifting",
      48: "functional_fitness",
      51: "hiking",
      55: "martial_arts",
      56: "meditation",
      63: "rock_climbing",
      69: "snowboarding",
      79: "walking",
      85: "strength_training",
      98: "jump_rope",
      101: "elliptical",
      103: "lap_swimming",
      104: "running",
    };

    return sportMap[sportId] || "workout";
  }
}

// Strava Integration
class StravaIntegration extends BaseFitnessIntegration {
  name = "strava";
  private readonly apiBase = "https://www.strava.com/api/v3";

  async isConnected(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token) return false;

    try {
      const response = await makeRequest(`${this.apiBase}/athlete`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async authenticate(): Promise<boolean> {
    // Placeholder for OAuth flow - would need proper OAuth 2.0 implementation
    const result = await vscode.window.showInformationMessage(
      "Strava integration requires OAuth 2.0 setup:\n\n" +
        "1. Create app at developers.strava.com\n" +
        "2. Get Client ID and Secret\n" +
        "3. Implement OAuth flow\n\n" +
        "For now, you can manually enter an access token for testing:",
      "Enter Token Manually",
      "Cancel"
    );

    if (result === "Enter Token Manually") {
      const token = await vscode.window.showInputBox({
        prompt: "Enter your Strava access token (for testing only)",
        password: true,
        placeHolder: "strava_access_token_here",
      });

      if (token) {
        try {
          const response = await makeRequest(`${this.apiBase}/athlete`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.ok) {
            await this.storeToken(token);
            return true;
          } else {
            vscode.window.showErrorMessage("Invalid Strava token");
            return false;
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Strava authentication error: ${error}`
          );
          return false;
        }
      }
    }

    return false;
  }

  async getRecentWorkouts(hours: number = 24): Promise<WorkoutData[]> {
    const token = this.getStoredToken();
    if (!token) return [];

    try {
      const after = Math.floor((Date.now() - hours * 60 * 60 * 1000) / 1000);

      const response = await makeRequest(
        `${this.apiBase}/athlete/activities?after=${after}&per_page=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) return [];

      const activities = await response.json();
      return activities.map((activity: any) => ({
        id: activity.id.toString(),
        source: "strava" as const,
        type: this.mapStravaActivityType(activity.type),
        startTime: new Date(activity.start_date),
        endTime: new Date(
          new Date(activity.start_date).getTime() + activity.elapsed_time * 1000
        ),
        duration: Math.round(activity.moving_time / 60), // Convert seconds to minutes
        calories: activity.calories || undefined,
        heartRate: activity.average_heartrate
          ? {
              average: Math.round(activity.average_heartrate),
              max: Math.round(activity.max_heartrate || 0),
            }
          : undefined,
        distance: activity.distance || undefined, // meters
        verified: true,
      }));
    } catch (error) {
      console.error("Strava API error:", error);
      return [];
    }
  }

  private mapStravaActivityType(type: string): string {
    const typeMap: Record<string, string> = {
      Run: "running",
      Ride: "cycling",
      Swim: "swimming",
      Hike: "hiking",
      Walk: "walking",
      AlpineSki: "skiing",
      BackcountrySki: "skiing",
      Canoeing: "paddling",
      Crossfit: "functional_fitness",
      EBikeRide: "cycling",
      Elliptical: "elliptical",
      Golf: "golf",
      Handcycle: "cycling",
      HighIntensityIntervalTraining: "functional_fitness",
      IceSkate: "skating",
      InlineSkate: "skating",
      Kayaking: "paddling",
      Kitesurf: "kitesurfing",
      MountainBikeRide: "cycling",
      NordicSki: "skiing",
      Pilates: "pilates",
      Racquetball: "racquetball",
      RockClimbing: "rock_climbing",
      RollerSki: "skiing",
      Rowing: "rowing",
      Sail: "sailing",
      Skateboard: "skateboarding",
      Snowboard: "snowboarding",
      Snowshoe: "snowshoeing",
      Soccer: "soccer",
      StairStepper: "stair_climbing",
      StandUpPaddling: "standup_paddleboarding",
      Surfing: "surfing",
      Tennis: "tennis",
      TrailRun: "running",
      Velomobile: "cycling",
      VirtualRide: "cycling",
      VirtualRun: "running",
      WaterSport: "water_sport",
      WeightTraining: "strength_training",
      Wheelchair: "wheelchair",
      Windsurf: "windsurfing",
      Workout: "workout",
      Yoga: "yoga",
    };

    return typeMap[type] || type.toLowerCase();
  }

  async disconnect(): Promise<void> {
    await this.clearToken();
  }
}

// Fitbit Integration
class FitbitIntegration extends BaseFitnessIntegration {
  name = "fitbit";
  private readonly apiBase = "https://api.fitbit.com/1";

  async isConnected(): Promise<boolean> {
    const token = this.getStoredToken();
    if (!token) return false;

    try {
      const response = await makeRequest(
        `${this.apiBase}/user/-/profile.json`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async authenticate(): Promise<boolean> {
    // For now, manual token entry - would need proper OAuth 2.0 in production
    const result = await vscode.window.showInformationMessage(
      "Fitbit integration requires OAuth 2.0 setup:\n\n" +
        "1. Create app at dev.fitbit.com/apps\n" +
        "2. Get Client ID and Secret\n" +
        "3. Implement OAuth flow\n\n" +
        "For now, you can manually enter an access token for testing:",
      "Enter Token Manually",
      "Learn More",
      "Cancel"
    );

    if (result === "Learn More") {
      vscode.env.openExternal(
        vscode.Uri.parse(
          "https://dev.fitbit.com/build/reference/web-api/developer-guide/getting-started/"
        )
      );
      return false;
    }

    if (result === "Enter Token Manually") {
      const token = await vscode.window.showInputBox({
        prompt: "Enter your Fitbit access token (for testing only)",
        password: true,
        placeHolder: "fitbit_access_token_here",
        validateInput: (value) => {
          if (!value || value.length < 10) {
            return "Please enter a valid Fitbit access token";
          }
          return null;
        },
      });

      if (token) {
        try {
          const response = await makeRequest(
            `${this.apiBase}/user/-/profile.json`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.ok) {
            await this.storeToken(token);
            return true;
          } else {
            vscode.window.showErrorMessage("Invalid Fitbit token");
            return false;
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Fitbit authentication error: ${error}`
          );
          return false;
        }
      }
    }

    return false;
  }

  async getRecentWorkouts(hours: number = 24): Promise<WorkoutData[]> {
    const token = this.getStoredToken();
    if (!token) return [];

    try {
      const end = new Date();
      const start = new Date(end.getTime() - hours * 60 * 60 * 1000);

      // Get activities for the date range
      const activities: WorkoutData[] = [];

      // Fitbit API requires date-by-date requests
      const currentDate = new Date(start);
      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().split("T")[0]; // YYYY-MM-DD format

        try {
          const response = await makeRequest(
            `${this.apiBase}/user/-/activities/date/${dateStr}.json`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (response.ok) {
            const data = await response.json();

            // Process activities for this date
            if (data.activities && data.activities.length > 0) {
              for (const activity of data.activities) {
                // Only include activities within our time window
                const activityStart = new Date(
                  `${activity.startDate}T${activity.startTime}`
                );
                if (activityStart >= start && activityStart <= end) {
                  activities.push({
                    id: activity.logId.toString(),
                    source: "fitbit" as const,
                    type: this.mapFitbitActivityType(activity.activityName),
                    startTime: activityStart,
                    endTime: new Date(
                      activityStart.getTime() + (activity.duration || 0)
                    ),
                    duration: Math.round(
                      (activity.duration || 0) / (1000 * 60)
                    ), // Convert ms to minutes
                    calories: activity.calories || undefined,
                    heartRate: activity.averageHeartRate
                      ? {
                          average: Math.round(activity.averageHeartRate),
                          max: Math.round(activity.maxHeartRate || 0),
                        }
                      : undefined,
                    distance: activity.distance
                      ? Math.round(activity.distance * 1609.34)
                      : undefined, // Convert miles to meters
                    verified: true,
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching Fitbit data for ${dateStr}:`, error);
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return activities;
    } catch (error) {
      console.error("Fitbit API error:", error);
      return [];
    }
  }

  private mapFitbitActivityType(activityName: string): string {
    const typeMap: Record<string, string> = {
      // Cardio activities
      Running: "running",
      Treadmill: "running",
      Walk: "walking",
      "Outdoor Bike": "cycling",
      Bike: "cycling",
      "Stationary Bike": "cycling",
      Elliptical: "elliptical",
      Swimming: "swimming",
      Sport: "workout",

      // Strength and fitness
      Weights: "strength_training",
      "Weight Lifting": "strength_training",
      Workout: "workout",
      CrossFit: "functional_fitness",
      "Circuit Training": "functional_fitness",
      "Interval Workout": "functional_fitness",
      Bootcamp: "functional_fitness",

      // Flexibility and mind-body
      Yoga: "yoga",
      Pilates: "pilates",
      Stretching: "stretching",
      Meditation: "meditation",

      // Sports
      Tennis: "tennis",
      Basketball: "basketball",
      Soccer: "soccer",
      Golf: "golf",
      Baseball: "baseball",
      Volleyball: "volleyball",

      // Outdoor activities
      Hike: "hiking",
      "Rock Climbing": "rock_climbing",
      Kayaking: "paddling",
      Skiing: "skiing",
      Snowboarding: "snowboarding",

      // Dance and martial arts
      Dancing: "dance",
      "Martial Arts": "martial_arts",
      Boxing: "boxing",

      // Other activities
      Stairs: "stair_climbing",
      Aerobics: "aerobics",
      Spinning: "cycling",
    };

    // Try exact match first
    if (typeMap[activityName]) {
      return typeMap[activityName];
    }

    // Try partial matches
    const activityLower = activityName.toLowerCase();
    for (const [key, value] of Object.entries(typeMap)) {
      if (
        activityLower.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(activityLower)
      ) {
        return value;
      }
    }

    return activityLower.replace(/\s+/g, "_");
  }

  async disconnect(): Promise<void> {
    await this.clearToken();
  }
}

// iOS Companion App Integration
class iOSCompanionIntegration extends BaseFitnessIntegration {
  name = "ios-companion";

  async isConnected(): Promise<boolean> {
    // Check if iOS app has synced recently
    const lastSync = this.context.globalState.get<number>("ios_last_sync");
    if (!lastSync) return false;

    // Consider connected if synced within last 24 hours
    return Date.now() - lastSync < 24 * 60 * 60 * 1000;
  }

  async authenticate(): Promise<boolean> {
    const result = await vscode.window.showInformationMessage(
      "📱 iOS Companion App Setup:\n\n" +
        "The iOS app will integrate with Apple HealthKit to automatically sync:\n" +
        "• Workout sessions from Apple Watch\n" +
        "• Third-party fitness apps (Nike Run Club, Strava, etc.)\n" +
        "• Manual workouts entered in Apple Health\n" +
        "• Heart rate and calorie data\n\n" +
        "Required HealthKit permissions:\n" +
        "• Read Workout data (HKWorkoutType)\n" +
        "• Read Active Energy (HKActiveEnergyBurnedType)\n" +
        "• Read Heart Rate (HKHeartRateType)\n" +
        "• Read Exercise Minutes (HKExerciseTimeType)",
      "Download iOS App",
      "Test Sync",
      "Got it"
    );

    if (result === "Download iOS App") {
      vscode.env.openExternal(
        vscode.Uri.parse("https://apps.apple.com/app/workout-lockout")
      );
      return false;
    } else if (result === "Test Sync") {
      // Simulate a test sync for development
      await this.simulateTestSync();
      return true;
    }

    return false;
  }

  async getRecentWorkouts(hours: number = 24): Promise<WorkoutData[]> {
    // Get workouts synced from iOS app via HealthKit
    const workouts = this.context.globalState.get<WorkoutData[]>(
      "ios_synced_workouts",
      []
    );
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    return workouts
      .filter((workout) => new Date(workout.startTime) > cutoff)
      .map((workout) => ({
        ...workout,
        startTime: new Date(workout.startTime),
        endTime: new Date(workout.endTime),
        source: "apple-health" as const,
        verified: true, // HealthKit data is considered verified
      }));
  }

  // Method to be called by iOS app when syncing HealthKit data
  async syncHealthKitWorkouts(healthKitWorkouts: any[]): Promise<void> {
    const workouts: WorkoutData[] = healthKitWorkouts.map((workout) => ({
      id: workout.uuid,
      source: "apple-health" as const,
      type: this.mapHealthKitWorkoutType(workout.workoutActivityType),
      startTime: new Date(workout.startDate),
      endTime: new Date(workout.endDate),
      duration: Math.round(
        (new Date(workout.endDate).getTime() -
          new Date(workout.startDate).getTime()) /
          (1000 * 60)
      ),
      calories: workout.totalEnergyBurned
        ? Math.round(workout.totalEnergyBurned)
        : undefined,
      heartRate: workout.averageHeartRate
        ? {
            average: Math.round(workout.averageHeartRate),
            max: Math.round(workout.maxHeartRate || 0),
          }
        : undefined,
      distance: workout.totalDistance
        ? Math.round(workout.totalDistance)
        : undefined, // meters
      verified: true,
    }));

    // Store synced workouts
    await this.context.globalState.update("ios_synced_workouts", workouts);
    await this.context.globalState.update("ios_last_sync", Date.now());

    vscode.window
      .showInformationMessage(
        `📱 Synced ${workouts.length} workout(s) from Apple Health`,
        "Import Workouts"
      )
      .then((selection) => {
        if (selection === "Import Workouts") {
          vscode.commands.executeCommand("dontSkip.syncWorkouts");
        }
      });
  }

  private mapHealthKitWorkoutType(activityType: number): string {
    // Apple HealthKit HKWorkoutActivityType enum values
    const healthKitTypeMap: Record<number, string> = {
      1: "running", // HKWorkoutActivityTypeRunning
      2: "cycling", // HKWorkoutActivityTypeCycling
      3: "walking", // HKWorkoutActivityTypeWalking
      4: "swimming", // HKWorkoutActivityTypeSwimming
      5: "tennis", // HKWorkoutActivityTypeTennis
      6: "basketball", // HKWorkoutActivityTypeBasketball
      7: "volleyball", // HKWorkoutActivityTypeVolleyball
      8: "baseball", // HKWorkoutActivityTypeBaseball
      9: "soccer", // HKWorkoutActivityTypeSoccer
      10: "football", // HKWorkoutActivityTypeAmericanFootball
      11: "golf", // HKWorkoutActivityTypeGolf
      12: "hiking", // HKWorkoutActivityTypeHiking
      13: "strength_training", // HKWorkoutActivityTypeTraditionalStrengthTraining
      14: "yoga", // HKWorkoutActivityTypeYoga
      15: "dance", // HKWorkoutActivityTypeDance
      16: "elliptical", // HKWorkoutActivityTypeElliptical
      17: "functional_fitness", // HKWorkoutActivityTypeFunctionalStrengthTraining
      18: "boxing", // HKWorkoutActivityTypeBoxing
      19: "martial_arts", // HKWorkoutActivityTypeMartialArts
      20: "pilates", // HKWorkoutActivityTypePilates
      21: "badminton", // HKWorkoutActivityTypeBadminton
      22: "racquetball", // HKWorkoutActivityTypeRacquetball
      23: "squash", // HKWorkoutActivityTypeSquash
      24: "stair_climbing", // HKWorkoutActivityTypeStairClimbing
      25: "sailing", // HKWorkoutActivityTypeSailing
      26: "rock_climbing", // HKWorkoutActivityTypeClimbing
      27: "rowing", // HKWorkoutActivityTypeRowing
      28: "skiing", // HKWorkoutActivityTypeDownhillSkiing
      29: "snowboarding", // HKWorkoutActivityTypeSnowboarding
      30: "skateboarding", // HKWorkoutActivityTypeSkateboarding
      31: "paddling", // HKWorkoutActivityTypePaddleSports
      32: "surfing", // HKWorkoutActivityTypeSurfingSports
      33: "fishing", // HKWorkoutActivityTypeFishing
      34: "hunting", // HKWorkoutActivityTypeHunting
      35: "equestrian", // HKWorkoutActivityTypeEquestrianSports
      36: "archery", // HKWorkoutActivityTypeArchery
      37: "softball", // HKWorkoutActivityTypeSoftball
      38: "lacrosse", // HKWorkoutActivityTypeLacrosse
      39: "bowling", // HKWorkoutActivityTypeBowling
      40: "cricket", // HKWorkoutActivityTypeCricket
      41: "cross_country_skiing", // HKWorkoutActivityTypeCrossCountrySkiing
      42: "curling", // HKWorkoutActivityTypeCurling
      43: "fencing", // HKWorkoutActivityTypeFencing
      44: "gymnastics", // HKWorkoutActivityTypeGymnastics
      45: "handball", // HKWorkoutActivityTypeHandball
      46: "hockey", // HKWorkoutActivityTypeHockey
      47: "ice_skating", // HKWorkoutActivityTypeIceSkating
      48: "jump_rope", // HKWorkoutActivityTypeJumpRope
      49: "kickboxing", // HKWorkoutActivityTypeKickboxing
      50: "paddling", // HKWorkoutActivityTypePaddleSports
      51: "rugby", // HKWorkoutActivityTypeRugby
      52: "skating", // HKWorkoutActivityTypeSkating
      53: "snow_sports", // HKWorkoutActivityTypeSnowSports
      54: "table_tennis", // HKWorkoutActivityTypeTableTennis
      55: "tai_chi", // HKWorkoutActivityTypeTaiChi
      56: "track_and_field", // HKWorkoutActivityTypeTrackAndField
      57: "water_polo", // HKWorkoutActivityTypeWaterPolo
      58: "water_sports", // HKWorkoutActivityTypeWaterSports
      59: "wrestling", // HKWorkoutActivityTypeWrestling
      60: "barre", // HKWorkoutActivityTypeBarre
      61: "core_training", // HKWorkoutActivityTypeCoreTraining
      62: "cross_training", // HKWorkoutActivityTypeCrossTraining
      63: "flexibility", // HKWorkoutActivityTypeFlexibility
      64: "high_intensity_interval_training", // HKWorkoutActivityTypeHighIntensityIntervalTraining
      65: "mixed_cardio", // HKWorkoutActivityTypeMixedCardio
      66: "stairs", // HKWorkoutActivityTypeStairs
      67: "step_training", // HKWorkoutActivityTypeStepTraining
      68: "wheelchair_walk_pace", // HKWorkoutActivityTypeWheelchairWalkPace
      69: "wheelchair_run_pace", // HKWorkoutActivityTypeWheelchairRunPace
      70: "treadmill", // HKWorkoutActivityTypeTreadmill
      71: "mixed_metabolic_cardio", // HKWorkoutActivityTypeMixedMetabolicCardioTraining
      72: "hand_cycling", // HKWorkoutActivityTypeHandCycling
      73: "disc_sports", // HKWorkoutActivityTypeDiscSports
      74: "fitness_gaming", // HKWorkoutActivityTypeFitnessGaming
      75: "cardiodance", // HKWorkoutActivityTypeCardioDance
      76: "social_dance", // HKWorkoutActivityTypeSocialDance
      77: "pickleball", // HKWorkoutActivityTypePickleball
      78: "cooldown", // HKWorkoutActivityTypeCooldown
      3000: "workout", // HKWorkoutActivityTypeOther
    };

    return healthKitTypeMap[activityType] || "workout";
  }

  private async simulateTestSync(): Promise<void> {
    // Simulate some test HealthKit workouts for development
    const testWorkouts: WorkoutData[] = [
      {
        id: "test-1",
        source: "apple-health" as const,
        type: "running",
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        endTime: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
        duration: 30,
        calories: 300,
        heartRate: { average: 150, max: 175 },
        distance: 5000, // 5km in meters
        verified: true,
      },
      {
        id: "test-2",
        source: "apple-health" as const,
        type: "strength_training",
        startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        endTime: new Date(Date.now() - 23.5 * 60 * 60 * 1000),
        duration: 45,
        calories: 250,
        heartRate: { average: 120, max: 160 },
        verified: true,
      },
    ];

    await this.context.globalState.update("ios_synced_workouts", testWorkouts);
    await this.context.globalState.update("ios_last_sync", Date.now());

    vscode.window
      .showInformationMessage(
        `📱 Test sync complete! Found ${testWorkouts.length} simulated HealthKit workouts.`,
        "Import Workouts"
      )
      .then((selection) => {
        if (selection === "Import Workouts") {
          vscode.commands.executeCommand("dontSkip.syncWorkouts");
        }
      });
  }

  async disconnect(): Promise<void> {
    await this.context.globalState.update("ios_last_sync", undefined);
    await this.context.globalState.update("ios_synced_workouts", []);
  }
}
