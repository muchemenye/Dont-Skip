import * as vscode from "vscode";
import { BackendApiService } from "./services/BackendApiService";

export interface WorkoutType {
  name: string;
  minDuration: number; // minutes
  codingHours: number;
}

export interface CodingCredit {
  workoutType: string;
  earnedAt: Date;
  codingHours: number;
  usedHours: number;
  expiresAt: Date;
  isEmergency?: boolean;
  emergencyMinutesRemaining?: number;
  lastActiveTime?: Date;
}

export class CreditManager {
  private context: vscode.ExtensionContext;
  private credits: CodingCredit[] = [];
  private pendingSpendMinutes: number = 0; // Track local usage not yet synced
  private lastSyncTime: number = 0;
  private syncTimer?: NodeJS.Timeout;
  private onBalanceChange?: () => Promise<void>;
  public backendApi?: BackendApiService;

  constructor(
    context: vscode.ExtensionContext,
    backendApi?: BackendApiService,
    onBalanceChange?: () => Promise<void>
  ) {
    this.context = context;
    this.backendApi = backendApi;
    this.onBalanceChange = onBalanceChange;
    this.loadCredits();
    this.cleanupExpiredCredits();
    
    // Load pending spend amount
    this.pendingSpendMinutes = this.context.globalState.get<number>("pendingSpendMinutes", 0);
    
    // Start periodic sync to backend
    this.startPeriodicSync();
    
    // Cleanup on extension deactivation
    context.subscriptions.push({
      dispose: () => this.stopPeriodicSync()
    });
  }

  private loadCredits(): void {
    const stored = this.context.globalState.get<CodingCredit[]>(
      "codingCredits",
      []
    );
    this.credits = stored.map((credit) => ({
      ...credit,
      earnedAt: new Date(credit.earnedAt),
      expiresAt: new Date(credit.expiresAt),
    }));
  }

  private saveCredits(): void {
    this.context.globalState.update("codingCredits", this.credits);
  }

  private cleanupExpiredCredits(): void {
    const now = new Date();
    this.credits = this.credits.filter((credit) => credit.expiresAt > now);
    this.saveCredits();
  }

  addCredit(workoutType: WorkoutType): void {
    const config = vscode.workspace.getConfiguration("dontSkip");
    const rolloverDays = config.get<number>("creditRolloverDays", 2);

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + rolloverDays * 24 * 60 * 60 * 1000
    );

    const credit: CodingCredit = {
      workoutType: workoutType.name,
      earnedAt: now,
      codingHours: workoutType.codingHours,
      usedHours: 0,
      expiresAt: expiresAt,
    };

    this.credits.push(credit);
    this.saveCredits();

    // Notify about balance change
    if (this.onBalanceChange) {
      this.onBalanceChange().catch(console.error);
    }

    vscode.window
      .showInformationMessage(
        `🎉 Workout completed! Earned ${workoutType.codingHours} hours of coding time`,
        "View Credits"
      )
      .then((selection) => {
        if (selection === "View Credits") {
          this.showCreditsStatus();
        }
      });
  }

  async getAvailableHours(): Promise<number> {
    // Try to get from backend first (only if authenticated)
    if (this.backendApi) {
      try {
        const isAuthenticated = await this.backendApi.isAuthenticated();
        if (isAuthenticated) {
          const balance = await this.backendApi.getCreditBalance();
          if (balance) {
            // Subtract any pending local usage that hasn't been synced yet
            const backendMinutes = balance.availableCredits;
            const adjustedMinutes = Math.max(0, backendMinutes - this.pendingSpendMinutes);
            return adjustedMinutes / 60; // Convert minutes to hours
          }
        }
      } catch (error) {
        // Silently fall back to local credits - no error messages
      }
    }

    // Fallback to local credits
    this.cleanupExpiredCredits();
    return this.credits.reduce((total, credit) => {
      return total + (credit.codingHours - credit.usedHours);
    }, 0);
  }

  async consumeHours(hours: number): Promise<boolean> {
    const minutes = Math.ceil(hours * 60);

    // Check if we have enough credits (including backend balance minus pending usage)
    const availableHours = await this.getAvailableHours();
    if (availableHours < hours) {
      return false;
    }

    // Track locally immediately for UI responsiveness
    this.pendingSpendMinutes += minutes;
    this.context.globalState.update("pendingSpendMinutes", this.pendingSpendMinutes);

    // Also update local credits as fallback
    this.cleanupExpiredCredits();
    let remainingToConsume = hours;
    const sortedCredits = [...this.credits].sort(
      (a, b) => a.expiresAt.getTime() - b.expiresAt.getTime()
    );

    for (const credit of sortedCredits) {
      if (remainingToConsume <= 0) break;
      const availableInCredit = credit.codingHours - credit.usedHours;
      if (availableInCredit > 0) {
        const toConsume = Math.min(remainingToConsume, availableInCredit);
        credit.usedHours += toConsume;
        remainingToConsume -= toConsume;
      }
    }

    this.saveCredits();
    
    // Notify about balance change
    if (this.onBalanceChange) {
      this.onBalanceChange().catch(console.error);
    }
    
    return true;
  }

  private startPeriodicSync(): void {
    // Sync every 30 seconds
    this.syncTimer = setInterval(() => {
      this.syncToBackend();
    }, 30000);
  }

  private stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  private async syncToBackend(): Promise<void> {
    // Only sync if we have pending changes and backend is available
    if (this.pendingSpendMinutes <= 0 || !this.backendApi) {
      return;
    }

    try {
      const isAuthenticated = await this.backendApi.isAuthenticated();
      if (!isAuthenticated) {
        return;
      }

      const success = await this.backendApi.spendCredits(
        this.pendingSpendMinutes, 
        "VS Code session (batched)"
      );
      
      if (success) {
        // Clear pending usage on successful sync
        this.pendingSpendMinutes = 0;
        this.context.globalState.update("pendingSpendMinutes", 0);
        console.log(`Synced pending usage to backend`);
        
        // Notify about balance change after sync
        if (this.onBalanceChange) {
          this.onBalanceChange().catch(console.error);
        }
      }
    } catch (error) {
      console.log("Failed to sync pending usage to backend:", error);
      // Keep pending usage for next sync attempt
    }
  }

  dispose(): void {
    this.stopPeriodicSync();
  }

  async showCreditsStatus(): Promise<void> {
    this.cleanupExpiredCredits();

    const availableHours = await this.getAvailableHours();
    const config = vscode.workspace.getConfiguration("dontSkip");
    const maxDaily = config.get<number>("maxDailyCoding", 8);

    let creditsDisplay: string;
    if (availableHours < 2) {
      const availableMinutes = Math.ceil(availableHours * 60);
      creditsDisplay = `${availableMinutes} minutes available`;
    } else {
      creditsDisplay = `${availableHours.toFixed(1)} hours available`;
    }

    let message = `💪 Coding Credits: ${creditsDisplay}\n`;
    message += `📅 Daily limit: ${maxDaily} hours\n\n`;

    // Show current mode status
    if (this.backendApi) {
      try {
        const isAuthenticated = await this.backendApi.isAuthenticated();
        if (isAuthenticated) {
          const balance = await this.backendApi.getCreditBalance();
          if (balance) {
            message += `🌐 Cloud sync enabled - data backed up\n`;
            message += `📊 Emergency credits: ${balance.emergencyCredits} min\n\n`;
          } else {
            message += `📱 Local mode - works great offline\n\n`;
          }
        } else {
          message += `📱 Local mode - works great offline\n`;
          message += `🔗 Want to sync across devices? Connect fitness apps!\n\n`;
        }
      } catch {
        message += `📱 Local mode - works great offline\n\n`;
      }
    } else {
      message += `📱 Local mode - works great offline\n\n`;
    }

    if (this.credits.length === 0 && availableHours === 0) {
      message += "🏃‍♂️ No recent workouts - time to get moving!";
    } else {
      message += "Recent activity:\n";
      this.credits
        .sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime())
        .slice(0, 5)
        .forEach((credit) => {
          const remaining = credit.codingHours - credit.usedHours;
          const daysUntilExpiry = Math.ceil(
            (credit.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
          );

          if (credit.workoutType === "Emergency Unlock") {
            const remainingMinutes = Math.ceil(remaining * 60);
            message += `🚨 ${credit.workoutType}: ${remainingMinutes}min emergency time remaining\n`;
          } else {
            let remainingDisplay: string;
            if (remaining < 2) {
              const remainingMinutes = Math.ceil(remaining * 60);
              remainingDisplay = `${remainingMinutes}min remaining`;
            } else {
              remainingDisplay = `${remaining.toFixed(1)}h remaining`;
            }

            message += `• ${credit.workoutType}: ${remainingDisplay} (expires in ${daysUntilExpiry}d)\n`;
          }
        });
    }

    vscode.window
      .showInformationMessage(message, "Record Workout", "Sync Now", "Settings")
      .then((selection) => {
        if (selection === "Record Workout") {
          vscode.commands.executeCommand("dontSkip.recordWorkout");
        } else if (selection === "Sync Now") {
          vscode.commands.executeCommand("dontSkip.syncWorkouts");
        } else if (selection === "Settings") {
          vscode.commands.executeCommand("dontSkip.openSettings");
        }
      });
  }

  getTodaysCodingTime(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.context.globalState.get<number>(
      `codingTime_${today.toISOString().split("T")[0]}`,
      0
    );
  }

  addTodaysCodingTime(minutes: number): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const key = `codingTime_${today.toISOString().split("T")[0]}`;

    const current = this.context.globalState.get<number>(key, 0);
    this.context.globalState.update(key, current + minutes);
  }

  canCodeToday(): boolean {
    const config = vscode.workspace.getConfiguration("dontSkip");
    const maxDaily = config.get<number>("maxDailyCoding", 8) * 60;

    return this.getTodaysCodingTime() < maxDaily;
  }

  getEmergencyCredit(): CodingCredit | null {
    this.cleanupExpiredCredits();
    return (
      this.credits.find(
        (credit) => credit.isEmergency && credit.usedHours < credit.codingHours
      ) || null
    );
  }

  getEmergencyTimeRemaining(): number {
    const emergencyCredit = this.getEmergencyCredit();
    if (!emergencyCredit) {
      return 0;
    }

    if (emergencyCredit.emergencyMinutesRemaining !== undefined) {
      return emergencyCredit.emergencyMinutesRemaining / 60;
    }

    const timeUntilExpiry =
      (emergencyCredit.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
    return Math.max(0, timeUntilExpiry);
  }

  getEmergencyTimeRemainingMinutes(): number {
    return Math.ceil(this.getEmergencyTimeRemaining() * 60);
  }

  isUsingEmergencyCredit(): boolean {
    return this.getEmergencyCredit() !== null;
  }

  async addEmergencyCredit(credit: CodingCredit): Promise<void> {
    // Try backend emergency credits first
    if (this.backendApi) {
      try {
        const minutes = Math.ceil(credit.codingHours * 60);
        const success = await this.backendApi.useEmergencyCredits(minutes);
        if (success) {
          return;
        }
      } catch (error) {
        console.log("Backend unavailable, using local emergency credits");
      }
    }

    // Fallback to local emergency credits
    credit.emergencyMinutesRemaining = Math.ceil(credit.codingHours * 60);
    credit.lastActiveTime = new Date();

    this.credits.push(credit);
    this.saveCredits();

    vscode.window.showWarningMessage(
      `🚨 Emergency unlock activated! You have ${credit.emergencyMinutesRemaining} minutes of active coding time.`,
      "Got it"
    );
  }

  resumeEmergencyTimer(): void {
    const emergencyCredit = this.getEmergencyCredit();
    if (!emergencyCredit || !emergencyCredit.lastActiveTime) {
      return;
    }

    emergencyCredit.lastActiveTime = new Date();
    this.saveCredits();
  }

  consumeEmergencyTime(minutes: number): void {
    const emergencyCredit = this.getEmergencyCredit();
    if (
      !emergencyCredit ||
      emergencyCredit.emergencyMinutesRemaining === undefined
    ) {
      return;
    }

    emergencyCredit.emergencyMinutesRemaining = Math.max(
      0,
      emergencyCredit.emergencyMinutesRemaining - minutes
    );
    emergencyCredit.lastActiveTime = new Date();

    if (emergencyCredit.emergencyMinutesRemaining <= 0) {
      emergencyCredit.expiresAt = new Date();
    }

    this.saveCredits();
  }

  async resetAllData(): Promise<void> {
    const selection = await vscode.window.showWarningMessage(
      "⚠️ This will reset all workout credits and daily coding time. Use only for testing!",
      "Yes, reset everything",
      "Cancel"
    );

    if (selection === "Yes, reset everything") {
      try {
        // Reset local credits
        this.credits = [];
        this.saveCredits();

        // Reset daily coding time
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const key = `codingTime_${today.toISOString().split("T")[0]}`;
        await this.context.globalState.update(key, 0);

        // Reset workout history
        await this.context.globalState.update("workoutHistory", []);

        // Reset backend data if authenticated
        if (this.backendApi) {
          try {
            const isAuthenticated = await this.backendApi.isAuthenticated();
            if (isAuthenticated) {
              const backendReset = await this.backendApi.resetAllData();
              if (!backendReset) {
                console.log("Backend reset failed, but local data was reset");
              }
            }
          } catch (error) {
            console.log("Backend reset failed, local data reset completed");
          }
        }

        vscode.window.showInformationMessage(
          "🔄 All data reset! You should now be locked out."
        );

        // Show credits status to confirm reset
        setTimeout(() => {
          vscode.commands.executeCommand("dontSkip.viewCredits");
        }, 1000);
      } catch (error) {
        throw new Error(`Failed to reset data: ${error}`);
      }
    }
  }

  async clearLocalState(): Promise<void> {
    try {
      // Clear credits
      this.credits = [];
      this.saveCredits();

      // Clear all cached data without prompting
      await this.context.globalState.update("workoutHistory", []);
      await this.context.globalState.update("lastSyncTime", undefined);
      await this.context.globalState.update("cachedCreditBalance", undefined);
      await this.context.globalState.update("emergencyCreditsUsed", undefined);

      // Clear daily coding time tracking
      const keys = this.context.globalState.keys();
      for (const key of keys) {
        if (key.startsWith("codingTime_")) {
          await this.context.globalState.update(key, undefined);
        }
      }

      console.log("Local state cleared successfully");
    } catch (error) {
      console.error("Failed to clear local state:", error);
      throw error;
    }
  }
}
