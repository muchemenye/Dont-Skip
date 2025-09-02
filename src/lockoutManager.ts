import * as vscode from "vscode";
import { CreditManager } from "./creditManager";

export class LockoutManager {
  private context: vscode.ExtensionContext;
  private creditManager: CreditManager;
  private updateStatusBar?: () => Promise<void>;
  private sessionStartTime: Date | null = null;
  private lastCreditConsumption: Date | null = null;
  public isLocked = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private consumptionInterval: NodeJS.Timeout | null = null;
  private documentChangeListener: vscode.Disposable | null = null;
  private willSaveListener: vscode.Disposable | null = null;
  private windowStateListener: vscode.Disposable | null = null;
  private lastEditTime = 0;
  private isVSCodeFocused = true; // Assume focused on startup

  constructor(
    context: vscode.ExtensionContext,
    creditManager: CreditManager,
    updateStatusBar?: () => Promise<void>
  ) {
    this.context = context;
    this.creditManager = creditManager;
    this.updateStatusBar = updateStatusBar;
  }

  startMonitoring(): void {
    // Start coding session immediately when monitoring begins
    this.sessionStartTime = new Date();
    this.lastCreditConsumption = new Date();
    console.log(
      "LockoutManager: Started monitoring - focus-based time tracking active"
    );

    // Check every 10 seconds for more responsive countdown
    this.checkInterval = setInterval(() => {
      this.checkLockoutStatus();
    }, 10000);

    // Consume credits every minute during active VS Code usage
    this.consumptionInterval = setInterval(() => {
      this.consumeTimeBasedCredits();
    }, 60000); // Every 60 seconds

    // Listen for window state changes to track focus
    this.windowStateListener = vscode.window.onDidChangeWindowState((state) => {
      this.isVSCodeFocused = state.focused;
      console.log(
        `LockoutManager: VS Code focus changed: ${
          state.focused ? "FOCUSED" : "UNFOCUSED"
        }`
      );

      if (state.focused && !this.sessionStartTime) {
        // Resume session when VS Code regains focus
        this.sessionStartTime = new Date();
        this.lastCreditConsumption = new Date();
        console.log("LockoutManager: Resumed coding session on focus");
      }
    });

    // Listen for document changes to track active coding and block when locked
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
    if (this.isLocked) {
      // BLOCK EDITS: Undo the changes immediately when locked
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document) {
        await vscode.commands.executeCommand("undo");
        this.showLockoutMessage();
      }
      return;
    }

    const now = Date.now();
    if (now - this.lastEditTime < 1000) {
      // Debounce rapid edits
      return;
    }
    this.lastEditTime = now;

    // Track typing activity (for potential future features or debugging)
    console.log("LockoutManager: Typing activity detected");
  }

  private async consumeTimeBasedCredits(): Promise<void> {
    // Only consume credits if we have an active session and VS Code is focused
    if (!this.sessionStartTime || this.isLocked) {
      return;
    }

    // Check if VS Code is currently the focused application
    if (!this.isVSCodeFocused) {
      console.log(
        "LockoutManager: VS Code not focused, pausing credit consumption"
      );
      return;
    }

    console.log(
      "LockoutManager: Consuming 1 minute of credits (VS Code focused time-based)"
    );

    // Add 1 minute of coding time
    this.creditManager.addTodaysCodingTime(1);

    // Consume credits (1 minute = 1/60 hour)
    const consumed = await this.creditManager.consumeHours(1 / 60);
    if (!consumed) {
      console.log("LockoutManager: No credits available, locking editor");
      this.lockEditor();
      return;
    }

    // Update status bar immediately after consuming credits
    if (this.updateStatusBar) {
      await this.updateStatusBar();
    }

    this.lastCreditConsumption = new Date();

    // Check if we have credits and can code today
    const availableHours = await this.creditManager.getAvailableHours();
    const canCodeToday = this.creditManager.canCodeToday();

    console.log(
      `LockoutManager: Available hours after consumption: ${availableHours.toFixed(
        2
      )}`
    );

    if (availableHours <= 0 || !canCodeToday) {
      this.lockEditor();
    }
  }

  // Session management methods
  public pauseSession(): void {
    this.sessionStartTime = null;
    this.lastCreditConsumption = null;
  }

  public resumeSession(): void {
    if (!this.sessionStartTime) {
      this.sessionStartTime = new Date();
      this.lastCreditConsumption = new Date();
    }
  }

  public isSessionActive(): boolean {
    if (!this.sessionStartTime) {
      return false;
    }

    // Session is active if VS Code is focused and not locked
    return this.isVSCodeFocused && !this.isLocked;
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
    console.log("🔒 LOCKOUT ACTIVATED - Editor is now locked!");
    this.showLockoutMessage();

    // Show persistent warning in status bar
    if (this.updateStatusBar) {
      this.updateStatusBar();
    }
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
    if (this.consumptionInterval) {
      clearInterval(this.consumptionInterval);
    }
    if (this.documentChangeListener) {
      this.documentChangeListener.dispose();
    }
    if (this.willSaveListener) {
      this.willSaveListener.dispose();
    }
    if (this.windowStateListener) {
      this.windowStateListener.dispose();
    }
  }
}
