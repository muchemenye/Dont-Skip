import * as vscode from "vscode";
import { CreditManager, WorkoutType } from "./creditManager";

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
}

export class WorkoutTracker {
  private context: vscode.ExtensionContext;
  private creditManager: CreditManager;

  constructor(context: vscode.ExtensionContext, creditManager: CreditManager) {
    this.context = context;
    this.creditManager = creditManager;
  }

  private calculateEvidenceBasedCredits(
    workoutType: string,
    duration: number
  ): number {
    // Evidence-based conversion ratios (WHO research-backed, matching iOS ratios)
    const workoutTypeLower = workoutType.toLowerCase();

    if (workoutTypeLower.includes("walk") || workoutTypeLower.includes("hik")) {
      return (duration * 8) / 60; // 8 minutes coding per 1 minute walk -> convert to hours
    } else if (
      workoutTypeLower.includes("run") ||
      workoutTypeLower.includes("cycl") ||
      workoutTypeLower.includes("swim")
    ) {
      return (duration * 12) / 60; // 12 minutes coding per 1 minute cardio
    } else if (
      workoutTypeLower.includes("strength") ||
      workoutTypeLower.includes("weight")
    ) {
      return (duration * 15) / 60; // 15 minutes coding per 1 minute strength
    } else if (
      workoutTypeLower.includes("hiit") ||
      workoutTypeLower.includes("interval") ||
      workoutTypeLower.includes("cross")
    ) {
      return (duration * 18) / 60; // 18 minutes coding per 1 minute HIIT
    } else if (
      workoutTypeLower.includes("yoga") ||
      workoutTypeLower.includes("pilates")
    ) {
      return (duration * 10) / 60; // 10 minutes coding per 1 minute mindful movement
    } else {
      return (duration * 12) / 60; // 12 minutes default (moderate activity)
    }
  }

  async recordWorkout(): Promise<void> {
    const config = vscode.workspace.getConfiguration("dontSkip");
    const workoutTypes = config.get<WorkoutType[]>("workoutTypes", []);

    if (workoutTypes.length === 0) {
      vscode.window
        .showWarningMessage(
          "No workout types configured. Please set up your workout preferences.",
          "Open Settings"
        )
        .then((selection) => {
          if (selection === "Open Settings") {
            vscode.commands.executeCommand("dontSkip.openSettings");
          }
        });
      return;
    }

    const workoutOptions = workoutTypes.map((type) => ({
      label: `${type.name}`,
      description: `${type.minDuration} min → ${type.codingHours} hours coding`,
      detail: `Minimum ${type.minDuration} minutes of exercise`,
      workoutType: type,
    }));

    const selected = await vscode.window.showQuickPick(workoutOptions, {
      placeHolder: "What type of workout did you complete?",
      ignoreFocusOut: true,
    });

    if (!selected) {
      return;
    }

    const durationInput = await vscode.window.showInputBox({
      prompt: `How many minutes did you exercise? (minimum: ${selected.workoutType.minDuration})`,
      placeHolder: selected.workoutType.minDuration.toString(),
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num < 1) {
          return "Please enter a valid number of minutes";
        }
        if (num < selected.workoutType.minDuration) {
          return `Minimum duration for ${selected.workoutType.name} is ${selected.workoutType.minDuration} minutes`;
        }
        return null;
      },
    });

    if (!durationInput) {
      return;
    }

    const duration = parseInt(durationInput);

    // Get optional workout details
    const caloriesInput = await vscode.window.showInputBox({
      prompt: "How many calories did you burn? (optional)",
      placeHolder: "Leave empty if unknown",
    });

    const calories = caloriesInput ? parseInt(caloriesInput) : undefined;

    // Create workout data
    const now = new Date();
    const startTime = new Date(now.getTime() - duration * 60 * 1000);

    const workoutData = {
      type: selected.workoutType.name.toLowerCase().replace(/\s+/g, "_"),
      startTime,
      endTime: now,
      duration,
      calories,
    };

    // Try to add to backend first (if available through creditManager)
    try {
      // The creditManager will handle backend sync if available
      // For now, we'll use local storage and let creditManager sync later
    } catch (error) {
      console.log("Backend unavailable, using local storage");
    }

    // Try to add to backend first (if available)
    let backendSuccess = false;
    if (this.creditManager.backendApi) {
      try {
        const isAuthenticated =
          await this.creditManager.backendApi.isAuthenticated();
        if (isAuthenticated) {
          backendSuccess = await this.creditManager.backendApi.addManualWorkout(
            {
              type: selected.workoutType.name
                .toLowerCase()
                .replace(/\s+/g, "_"),
              startTime,
              endTime: now,
              duration,
              calories,
            }
          );
        }
      } catch (error) {
        console.log("Backend unavailable, using local storage");
      }
    }

    // Calculate actual coding hours using evidence-based ratios
    let actualCodingHours = this.calculateEvidenceBasedCredits(
      selected.workoutType.name,
      duration
    );

    // Apply bonus for extra long workouts (1.5x if duration > 2x minimum)
    if (duration > selected.workoutType.minDuration * 2) {
      actualCodingHours *= 1.5;
    }

    // Fallback to local credit system if backend failed or unavailable
    if (!backendSuccess) {
      if (duration > selected.workoutType.minDuration * 2) {
        vscode.window.showInformationMessage(
          "🔥 Bonus time for an extra long workout!"
        );
      }

      const customWorkoutType: WorkoutType = {
        ...selected.workoutType,
        codingHours: actualCodingHours,
      };

      this.creditManager.addCredit(customWorkoutType);
    }

    this.storeWorkoutHistory({
      type: selected.workoutType.name,
      duration: duration,
      codingHours: actualCodingHours,
      verificationMethod: "manual",
      timestamp: now,
      synced: false,
    });
  }

  async importWorkouts(workouts: WorkoutData[]): Promise<void> {
    if (workouts.length === 0) {
      vscode.window.showInformationMessage("No workouts to import.");
      return;
    }

    const workoutOptions = workouts.map((workout) => ({
      label: `${this.getWorkoutTypeDisplay(workout.type)} - ${
        workout.duration
      }min`,
      description: `${workout.startTime.toLocaleDateString()} ${workout.startTime.toLocaleTimeString()}`,
      detail: `From ${workout.source} • ${
        workout.calories ? workout.calories + " cal" : "No calorie data"
      }`,
      workout: workout,
      picked: true,
    }));

    const selected = await vscode.window.showQuickPick(workoutOptions, {
      placeHolder: "Select workouts to import as coding credits",
      canPickMany: true,
      ignoreFocusOut: true,
    });

    if (!selected || selected.length === 0) {
      return;
    }

    let totalCreditsEarned = 0;
    for (const item of selected) {
      const workout = item.workout;
      const workoutType = this.mapWorkoutToType(workout);

      if (workoutType) {
        this.creditManager.addCredit(workoutType);
        totalCreditsEarned += workoutType.codingHours;

        this.storeWorkoutHistory({
          type: workoutType.name,
          duration: workout.duration,
          codingHours: workoutType.codingHours,
          verificationMethod: "fitness-tracker",
          source: workout.source,
          timestamp: workout.startTime,
          imported: true,
        });
      }
    }

    vscode.window
      .showInformationMessage(
        `🎉 Imported ${
          selected.length
        } workout(s)! Earned ${totalCreditsEarned.toFixed(
          1
        )} hours of coding time.`,
        "View Credits"
      )
      .then((selection) => {
        if (selection === "View Credits") {
          this.creditManager.showCreditsStatus();
        }
      });
  }

  async showImportableWorkouts(workouts: WorkoutData[]): Promise<void> {
    if (workouts.length === 0) {
      vscode.window.showInformationMessage(
        "No recent workouts found from connected integrations."
      );
      return;
    }

    let message = `📊 Found ${workouts.length} recent workout(s):\n\n`;

    workouts.slice(0, 10).forEach((workout) => {
      const date = workout.startTime.toLocaleDateString();
      const time = workout.startTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      const source =
        workout.source.charAt(0).toUpperCase() + workout.source.slice(1);

      message += `• ${this.getWorkoutTypeDisplay(workout.type)} (${
        workout.duration
      }min)\n`;
      message += `  ${date} ${time} • ${source}`;
      if (workout.calories) {
        message += ` • ${workout.calories} cal`;
      }
      message += "\n\n";
    });

    if (workouts.length > 10) {
      message += `... and ${workouts.length - 10} more\n\n`;
    }

    vscode.window
      .showInformationMessage(
        message,
        "Import All",
        "Select Workouts",
        "Manage Integrations"
      )
      .then((selection) => {
        switch (selection) {
          case "Import All":
            this.importWorkouts(workouts);
            break;
          case "Select Workouts":
            this.importWorkouts(workouts);
            break;
          case "Manage Integrations":
            vscode.commands.executeCommand("dontSkip.manageIntegrations");
            break;
        }
      });
  }

  private storeWorkoutHistory(workout: any): void {
    const history = this.context.globalState.get<any[]>("workoutHistory", []);
    history.push(workout);

    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }

    this.context.globalState.update("workoutHistory", history);
  }

  private mapWorkoutToType(workout: WorkoutData): WorkoutType | null {
    const config = vscode.workspace.getConfiguration("dontSkip");
    const workoutTypes = config.get<WorkoutType[]>("workoutTypes", []);

    const duration = workout.duration;

    let bestMatch: WorkoutType | null = null;
    let bestScore = -1;

    for (const type of workoutTypes) {
      let score = 0;

      if (duration >= type.minDuration) {
        score += 10;
        const durationRatio = Math.min(duration / type.minDuration, 2);
        score += durationRatio * 5;
      }

      if (this.workoutTypesMatch(workout.type, type.name)) {
        score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = type;
      }
    }

    if (!bestMatch || bestScore < 10) {
      if (duration >= 45) {
        return { name: "Long Workout", minDuration: 45, codingHours: 8 };
      } else if (duration >= 20) {
        return { name: "Medium Workout", minDuration: 20, codingHours: 4 };
      } else if (duration >= 5) {
        return { name: "Quick Workout", minDuration: 5, codingHours: 2 };
      }
    }

    return bestMatch;
  }

  private workoutTypesMatch(trackerType: string, configType: string): boolean {
    const trackerLower = trackerType.toLowerCase();
    const configLower = configType.toLowerCase();

    if (
      trackerLower.includes(configLower) ||
      configLower.includes(trackerLower)
    ) {
      return true;
    }

    const mappings: Record<string, string[]> = {
      running: ["run", "jog", "cardio"],
      cycling: ["bike", "cycle"],
      strength: ["weight", "gym", "lifting"],
      yoga: ["stretch", "flexibility"],
      walking: ["walk", "hike"],
    };

    for (const [key, values] of Object.entries(mappings)) {
      if (
        trackerLower.includes(key) &&
        values.some((v) => configLower.includes(v))
      ) {
        return true;
      }
      if (
        configLower.includes(key) &&
        values.some((v) => trackerLower.includes(v))
      ) {
        return true;
      }
    }

    return false;
  }

  private getWorkoutTypeDisplay(type: string): string {
    const typeMap: Record<string, string> = {
      running: "🏃‍♂️ Running",
      cycling: "🚴‍♂️ Cycling",
      walking: "🚶‍♂️ Walking",
      strength: "🏋️‍♂️ Strength",
      yoga: "🧘‍♂️ Yoga",
      swimming: "🏊‍♂️ Swimming",
      workout: "💪 Workout",
    };

    return typeMap[type.toLowerCase()] || `💪 ${type}`;
  }
}
