import * as vscode from "vscode";
import { CreditManager } from "./creditManager";

export class LockoutManager {
  private context: vscode.ExtensionContext;
  private creditManager: CreditManager;
  private sessionStartTime: Date | null = null;
  private isLocked = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private documentChangeListener: vscode.Disposable | null = null;
  private willSaveListener: vscode.Disposable | null = null;
  private lastEditTime = 0;

  constructor(context: vscode.ExtensionContext, creditManager: CreditManager) {
    this.context = context;
    this.creditManager = creditManager;
  }

  startMonitoring(): void {
    // Check every 10 seconds for more responsive countdown
    this.checkInterval = setInterval(() => {
      this.checkLockoutStatus();
    }, 10000);

    // Listen for document changes to track active coding
    this.documentChangeListener = vscode.workspace.onDidChangeTextDocument(
      (event) => {
        if (event.document.uri.scheme === "file") {
          this.handleCodingActivity(event);
        }
      }
    );

    // Block saves when locked
    this.willSaveListener = vscode.workspace.onWillSaveTextDocument((event) => {
      if (this.isLocked && event.document.uri.scheme === "file") {
        event.waitUntil(this.blockSave());
      }
    });

    // Initial check
    this.checkLockoutStatus();
  }

  private async handleCodingActivity(
    event: vscode.TextDocumentChangeEvent
  ): Promise<void> {
    // Throttle to prevent excessive processing
    const now = Date.now();
    if (now - this.lastEditTime < 500) {
      // 500ms throttle
      return;
    }
    this.lastEditTime = now;

    if (this.isLocked) {
      // Immediately undo the change and show message
      setTimeout(() => {
        vscode.commands.executeCommand("undo");
        this.showLockoutMessage();
      }, 10);
      return;
    }

    // Start session if not already started
    if (!this.sessionStartTime) {
      this.sessionStartTime = new Date();
    }

    // Add 1 minute of coding time for each edit (for testing purposes)
    this.creditManager.addTodaysCodingTime(1);

    // Consume credits (1 minute = 1/60 hour)
    const consumed = await this.creditManager.consumeHours(1 / 60);
    if (!consumed) {
      this.lockEditor();
      // Undo this change too since we just got locked
      setTimeout(() => {
        vscode.commands.executeCommand("undo");
      }, 10);
      return;
    }

    // Check if we have credits and can code today
    const availableHours = await this.creditManager.getAvailableHours();
    const canCodeToday = this.creditManager.canCodeToday();

    if (availableHours <= 0 || !canCodeToday) {
      this.lockEditor();
      // Undo this change too since we just got locked
      setTimeout(() => {
        vscode.commands.executeCommand("undo");
      }, 10);
    }
  }

  private async blockSave(): Promise<vscode.TextEdit[]> {
    this.showLockoutMessage();
    return []; // Return empty array to prevent save
  }

  private async checkLockoutStatus(): Promise<void> {
    const availableHours = await this.creditManager.getAvailableHours();
    const canCodeToday = this.creditManager.canCodeToday();

    if (availableHours <= 0 || !canCodeToday) {
      if (!this.isLocked) {
        this.lockEditor();
      }
    } else {
      if (this.isLocked) {
        this.unlockEditor();
      }
    }
  }

  private lockEditor(): void {
    this.isLocked = true;
    this.showLockoutMessage();
  }

  private unlockEditor(): void {
    this.isLocked = false;
    vscode.window.showInformationMessage("🔓 Editor unlocked! Happy coding!");
  }

  private async showLockoutMessage(): Promise<void> {
    const availableHours = await this.creditManager.getAvailableHours();
    const canCodeToday = this.creditManager.canCodeToday();

    let message = "";
    if (availableHours <= 0) {
      message =
        "🔒 No coding credits available! Complete a workout to unlock the editor.";
    } else if (!canCodeToday) {
      const config = vscode.workspace.getConfiguration("dontSkip");
      const maxDaily = config.get<number>("maxDailyCoding", 8);
      message = `🔒 Daily coding limit reached (${maxDaily}h)! Take a break or wait until tomorrow.`;
    }

    vscode.window
      .showWarningMessage(
        message,
        "Record Workout",
        "Emergency Unlock",
        "View Credits",
        "Sync Workouts"
      )
      .then((selection) => {
        switch (selection) {
          case "Record Workout":
            vscode.commands.executeCommand("dontSkip.recordWorkout");
            break;
          case "Emergency Unlock":
            this.emergencyUnlock();
            break;
          case "View Credits":
            vscode.commands.executeCommand("dontSkip.viewCredits");
            break;
          case "Sync Workouts":
            vscode.commands.executeCommand("dontSkip.syncWorkouts");
            break;
        }
      });
  }

  async emergencyUnlock(): Promise<void> {
    const config = vscode.workspace.getConfiguration("dontSkip");
    const gracePeriod = config.get<number>("gracePeriodMinutes", 30);

    const result = await vscode.window.showWarningMessage(
      `⚠️ Emergency unlock will give you ${gracePeriod} minutes of coding time. Use this only for urgent fixes!`,
      "Yes, unlock now",
      "Cancel"
    );

    if (result === "Yes, unlock now") {
      // Try backend emergency credits first
      try {
        // The backend API service will handle emergency credits
        const emergencyCredit = {
          workoutType: "Emergency Unlock",
          earnedAt: new Date(),
          codingHours: gracePeriod / 60,
          usedHours: 0,
          expiresAt: new Date(Date.now() + gracePeriod * 60 * 1000),
          isEmergency: true,
        };

        await this.creditManager.addEmergencyCredit(emergencyCredit);
        this.unlockEditor();

        // Set reminder for workout
        setTimeout(() => {
          vscode.window
            .showInformationMessage(
              "⏰ Emergency time is running out! Consider recording a workout.",
              "Record Workout"
            )
            .then((sel) => {
              if (sel === "Record Workout") {
                vscode.commands.executeCommand("dontSkip.recordWorkout");
              }
            });
        }, (gracePeriod - 5) * 60 * 1000); // 5 minutes before expiry
      } catch (error) {
        vscode.window.showErrorMessage(
          "Failed to activate emergency unlock. Please try again."
        );
      }
    }
  }

  dispose(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    if (this.documentChangeListener) {
      this.documentChangeListener.dispose();
    }
    if (this.willSaveListener) {
      this.willSaveListener.dispose();
    }
  }
}
