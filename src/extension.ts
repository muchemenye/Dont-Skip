import * as vscode from "vscode";
import { CreditManager } from "./creditManager";
import { WorkoutTracker } from "./workoutTracker";
import { LockoutManager } from "./lockoutManager";
import { SettingsWebview } from "./settingsWebview";
import { BackendApiService } from "./services/BackendApiService";

let creditManager: CreditManager;
let workoutTracker: WorkoutTracker;
let lockoutManager: LockoutManager;
let backendApi: BackendApiService;
let statusBarItem: vscode.StatusBarItem;
let statusUpdateTimer: NodeJS.Timeout;

export function activate(context: vscode.ExtensionContext) {
  console.log("Workout Lockout extension is now active!");

  // Initialize services
  backendApi = new BackendApiService(context);
  creditManager = new CreditManager(context, backendApi, updateStatusBar);
  workoutTracker = new WorkoutTracker(context, creditManager);
  lockoutManager = new LockoutManager(context, creditManager, updateStatusBar);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "dontSkip.viewCredits";
  context.subscriptions.push(statusBarItem);

  // Initialize and check authentication
  initializeExtension(context);

  // Register commands
  const recordWorkout = vscode.commands.registerCommand(
    "dontSkip.recordWorkout",
    () => {
      workoutTracker.recordWorkout();
    }
  );

  const viewCredits = vscode.commands.registerCommand(
    "dontSkip.viewCredits",
    () => {
      creditManager.showCreditsStatus();
    }
  );

  const openSettings = vscode.commands.registerCommand(
    "dontSkip.openSettings",
    () => {
      const settingsWebview = new SettingsWebview(
        context,
        creditManager,
        backendApi
      );
      settingsWebview.show();
    }
  );

  const emergencyUnlock = vscode.commands.registerCommand(
    "dontSkip.unlock",
    () => {
      lockoutManager.emergencyUnlock();
    }
  );

  const resetForTesting = vscode.commands.registerCommand(
    "dontSkip.resetForTesting",
    async () => {
      try {
        await creditManager.resetAllData();
        vscode.window.showInformationMessage("✅ Reset completed successfully");
      } catch (error) {
        vscode.window.showErrorMessage(`❌ Reset failed: ${error}`);
        console.error("Reset command error:", error);
      }
    }
  );

  const manageIntegrations = vscode.commands.registerCommand(
    "dontSkip.manageIntegrations",
    async () => {
      await showIntegrationManagement();
    }
  );

  const syncWorkouts = vscode.commands.registerCommand(
    "dontSkip.syncWorkouts",
    async () => {
      await syncWorkoutsFromBackend();
    }
  );

  const authenticate = vscode.commands.registerCommand(
    "dontSkip.authenticate",
    async () => {
      await quickSetupFlow();
    }
  );

  const logout = vscode.commands.registerCommand(
    "dontSkip.logout",
    async () => {
      const confirm = await vscode.window.showWarningMessage(
        "⚠️ Are you sure you want to logout?\n\nThis will:\n• Clear all local authentication data\n• Stop syncing with backend\n• Keep your local workout history",
        { modal: true },
        "Logout",
        "Cancel"
      );

      if (confirm === "Logout") {
        try {
          // SECURITY: Comprehensive logout with state clearing
          await backendApi.logout();
          await creditManager.clearLocalState();
          await updateStatusBar();

          vscode.window.showInformationMessage(
            "✅ Logged out successfully. Your local data has been cleared."
          );
        } catch (error) {
          console.error("Logout error:", error);
          vscode.window.showErrorMessage(
            `❌ Logout failed: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }
    }
  );

  const checkConnection = vscode.commands.registerCommand(
    "dontSkip.checkConnection",
    async () => {
      const connected = await backendApi.checkConnection();
      vscode.window.showInformationMessage(
        connected
          ? "✅ Backend connection successful"
          : "❌ Backend connection failed"
      );
    }
  );

  const debugLockout = vscode.commands.registerCommand(
    "dontSkip.debugLockout",
    async () => {
      const availableHours = await creditManager.getAvailableHours();
      const canCodeToday = creditManager.canCodeToday();
      const isLocked = lockoutManager.isLocked;

      vscode.window.showInformationMessage(
        `🔍 Debug Info:\n` +
          `Available Hours: ${availableHours.toFixed(2)}\n` +
          `Can Code Today: ${canCodeToday}\n` +
          `Is Locked: ${isLocked}\n` +
          `Session Active: ${lockoutManager.isSessionActive()}`
      );
    }
  );

  // Start monitoring
  lockoutManager.startMonitoring();

  // Add to subscriptions
  context.subscriptions.push(
    recordWorkout,
    viewCredits,
    openSettings,
    emergencyUnlock,
    resetForTesting,
    manageIntegrations,
    syncWorkouts,
    authenticate,
    logout,
    checkConnection,
    debugLockout
  );
}

async function initializeExtension(context: vscode.ExtensionContext) {
  // Check if state clearing is enabled (for debugging)
  const config = vscode.workspace.getConfiguration("dontSkip");
  const clearStateOnStartup = config.get("clearStateOnStartup", false);

  if (clearStateOnStartup) {
    console.log("Clearing state on startup (debug mode)");
    try {
      await creditManager.clearLocalState();
      await backendApi.clearAuthToken();
      vscode.window.showInformationMessage("🔄 State cleared on startup");
    } catch (error) {
      console.error("Failed to clear state on startup:", error);
    }
  }

  // Always start with local functionality - no login required!
  await updateStatusBar();

  // Start periodic status bar updates (every 30 seconds to reduce API calls)
  statusUpdateTimer = setInterval(async () => {
    await updateStatusBar();
  }, 30000); // Increased from 10s to 30s

  // Add to context for cleanup
  context.subscriptions.push({
    dispose: () => {
      if (statusUpdateTimer) {
        clearInterval(statusUpdateTimer);
      }
    },
  });

  // Check if user has backend connection (optional)
  const isAuthenticated = await backendApi.isAuthenticated();

  if (isAuthenticated) {
    // Silently sync in background if already connected
    await syncWorkoutsFromBackend();
  } else {
    // Show friendly one-time welcome (only first install)
    const hasSeenWelcome = context.globalState.get("hasSeenWelcome", false);

    if (!hasSeenWelcome) {
      await context.globalState.update("hasSeenWelcome", true);

      vscode.window
        .showInformationMessage(
          "🏃‍♂️ Don't Skip is ready! Record workouts to earn coding credits.",
          "Record First Workout",
          "Connect Fitness Apps"
        )
        .then((selection) => {
          if (selection === "Record First Workout") {
            vscode.commands.executeCommand("dontSkip.recordWorkout");
          } else if (selection === "Connect Fitness Apps") {
            vscode.commands.executeCommand("dontSkip.manageIntegrations");
          }
        });
    }
  }
}

async function quickSetupFlow(): Promise<void> {
  // Step 1: Check if returning user
  const action = await vscode.window.showQuickPick(
    [
      {
        label: "$(person-add) I'm new - Create account",
        description: "Set up a new Workout Lockout account",
        action: "register",
      },
      {
        label: "$(sign-in) I have an account - Sign in",
        description: "Sign in to existing account",
        action: "login",
      },
    ],
    {
      placeHolder: "Choose your setup option",
    }
  );

  if (!action) return;

  if (action.action === "register") {
    await registerNewUser();
  } else {
    await loginExistingUser();
  }
}

async function registerNewUser(): Promise<void> {
  // Get email with enhanced validation
  const email = await vscode.window.showInputBox({
    prompt: "📧 Enter your email address",
    placeHolder: "your.email@example.com",
    validateInput: (value) => {
      if (!value) return "Email is required";

      const trimmed = value.trim().toLowerCase();
      if (trimmed.length > 254) return "Email is too long";

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        return "Please enter a valid email address";
      }

      // SECURITY: Basic injection prevention
      if (
        trimmed.includes("<") ||
        trimmed.includes(">") ||
        trimmed.includes('"')
      ) {
        return "Email contains invalid characters";
      }

      return null;
    },
  });

  if (!email) return;

  // Get password with enhanced validation
  const password = await vscode.window.showInputBox({
    prompt: "🔒 Create a secure password (8+ characters)",
    placeHolder:
      "Must include: uppercase, lowercase, number, special character",
    password: true,
    validateInput: (value) => {
      if (!value) return "Password is required";
      if (value.length < 8) return "Password must be at least 8 characters";
      if (value.length > 128) return "Password is too long";

      // SECURITY: Comprehensive password validation
      const hasLower = /[a-z]/.test(value);
      const hasUpper = /[A-Z]/.test(value);
      const hasNumber = /\d/.test(value);
      const hasSpecial = /[@$!%*?&]/.test(value);

      if (!hasLower) return "Password must include a lowercase letter";
      if (!hasUpper) return "Password must include an uppercase letter";
      if (!hasNumber) return "Password must include a number";
      if (!hasSpecial)
        return "Password must include a special character (@$!%*?&)";

      // SECURITY: Check for common weak patterns
      if (/(.)\1{2,}/.test(value))
        return "Password cannot have repeated characters";
      if (/123|abc|password|admin/i.test(value))
        return "Password cannot contain common patterns";

      return null;
    },
  });

  if (!password) return;

  try {
    // SECURITY: Additional client-side validation before sending
    const emailTrimmed = email.trim().toLowerCase();

    const success = await backendApi.register(emailTrimmed, password);
    if (success) {
      vscode.window.showInformationMessage(
        "🎉 Account created! You're all set to track workouts and earn coding credits."
      );
      await updateStatusBar();
      await syncWorkoutsFromBackend();
    } else {
      vscode.window.showErrorMessage(
        "❌ Registration failed. Email might already be in use."
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `❌ Registration failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function loginExistingUser(): Promise<void> {
  // Get email with validation
  const email = await vscode.window.showInputBox({
    prompt: "📧 Enter your email address",
    placeHolder: "your.email@example.com",
    validateInput: (value) => {
      if (!value) return "Email is required";

      const trimmed = value.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        return "Please enter a valid email address";
      }

      // SECURITY: Basic injection prevention
      if (
        trimmed.includes("<") ||
        trimmed.includes(">") ||
        trimmed.includes('"')
      ) {
        return "Email contains invalid characters";
      }

      return null;
    },
  });

  if (!email) return;

  // Get password
  const password = await vscode.window.showInputBox({
    prompt: "🔒 Enter your password",
    password: true,
    validateInput: (value) => {
      if (!value) return "Password is required";
      if (value.length > 128) return "Password is too long";
      return null;
    },
  });

  if (!password) return;

  try {
    // SECURITY: Sanitize input before sending
    const emailTrimmed = email.trim().toLowerCase();

    const success = await backendApi.login(emailTrimmed, password);
    if (success) {
      vscode.window.showInformationMessage(
        "✅ Welcome back! Syncing your data..."
      );
      await updateStatusBar();
      await syncWorkoutsFromBackend();
    } else {
      vscode.window.showErrorMessage(
        "❌ Login failed. Check your email and password."
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `❌ Login failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function syncWorkoutsFromBackend(): Promise<void> {
  try {
    // Check if user is authenticated before syncing
    const isAuthenticated = await backendApi.isAuthenticated();
    if (!isAuthenticated) {
      console.log("User not authenticated, skipping workout sync");
      return;
    }

    const workouts = await backendApi.syncWorkouts(24);
    if (workouts.length > 0) {
      await updateStatusBar();
    }
  } catch (error) {
    console.error("Error syncing workouts:", error);
    // Don't show error to user as this is a background operation
  }
}

async function showIntegrationManagement(): Promise<void> {
  // Check if user is authenticated for secure integrations
  const isAuthenticated = await backendApi.isAuthenticated();

  if (!isAuthenticated) {
    // Offer secure account for integrations
    const result = await vscode.window.showInformationMessage(
      "🔐 Fitness app integrations require a secure account to protect your API tokens.\n\nThis keeps your Whoop, Strava, and Fitbit data safe.",
      "Create Secure Account",
      "Manual Entry Only"
    );

    if (result === "Create Secure Account") {
      await quickSetupFlow();
      return;
    } else if (result === "Manual Entry Only") {
      vscode.window.showInformationMessage(
        "💪 You can still record workouts manually using 'Record Workout' command."
      );
      return;
    }
    return;
  }

  // User is authenticated - show integration options
  const integrations = await backendApi.getIntegrations();

  const options = [
    "Connect Whoop",
    "Connect Strava",
    "Connect Fitbit",
    "View Connected Apps",
    "Sync Now",
  ];

  const selection = await vscode.window.showQuickPick(options, {
    placeHolder: "Manage fitness integrations",
  });

  switch (selection) {
    case "Connect Whoop":
      await connectFitnessApp("whoop");
      break;
    case "Connect Strava":
      await connectFitnessApp("strava");
      break;
    case "Connect Fitbit":
      await connectFitnessApp("fitbit");
      break;
    case "View Connected Apps":
      await showConnectedApps(integrations);
      break;
    case "Sync Now":
      await syncWorkoutsFromBackend();
      break;
  }
}

async function connectFitnessApp(provider: string): Promise<void> {
  const instructions = {
    whoop: "Get your Whoop API token from developer.whoop.com",
    strava: "Get your Strava access token from developers.strava.com",
    fitbit: "Get your Fitbit access token from dev.fitbit.com",
  };

  const result = await vscode.window.showInformationMessage(
    `To connect ${provider}:\n\n${
      instructions[provider as keyof typeof instructions]
    }`,
    "Enter Token",
    "Learn More"
  );

  if (result === "Enter Token") {
    const token = await vscode.window.showInputBox({
      prompt: `Enter your ${provider} access token`,
      password: true,
      placeHolder: `${provider}_access_token_here`,
    });

    if (token) {
      const success = await backendApi.connectIntegration(provider, token);
      if (success) {
        await syncWorkoutsFromBackend();
      }
    }
  } else if (result === "Learn More") {
    const urls = {
      whoop: "https://developer.whoop.com",
      strava: "https://developers.strava.com",
      fitbit: "https://dev.fitbit.com",
    };
    vscode.env.openExternal(
      vscode.Uri.parse(urls[provider as keyof typeof urls])
    );
  }
}

async function showConnectedApps(integrations: any[]): Promise<void> {
  if (integrations.length === 0) {
    vscode.window.showInformationMessage("No fitness apps connected yet.");
    return;
  }

  const items = integrations.map((integration) => ({
    label: `${integration.provider} - ${
      integration.isActive ? "✅ Active" : "❌ Inactive"
    }`,
    description: `Last sync: ${new Date(
      integration.lastSync
    ).toLocaleString()}`,
    integration,
  }));

  const selection = await vscode.window.showQuickPick(items, {
    placeHolder: "Connected fitness apps",
  });

  if (selection) {
    const actions = ["Test Connection", "Disconnect"];
    const action = await vscode.window.showQuickPick(actions, {
      placeHolder: `Actions for ${selection.integration.provider}`,
    });

    if (action === "Disconnect") {
      const confirm = await vscode.window.showWarningMessage(
        `Disconnect from ${selection.integration.provider}?`,
        "Yes",
        "No"
      );
      if (confirm === "Yes") {
        await backendApi.disconnectIntegration(selection.integration.provider);
      }
    }
  }
}

async function updateStatusBar(): Promise<void> {
  try {
    // Check if locked first
    if (lockoutManager && lockoutManager.isLocked) {
      statusBarItem.text = "🔒 LOCKED";
      statusBarItem.tooltip = "Editor is locked - Record a workout to unlock!";
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground"
      );
      statusBarItem.show();
      return;
    }

    // Always show credits - try backend first, then local
    const availableHours = await creditManager.getAvailableHours();
    const availableMinutes = Math.ceil(availableHours * 60);

    // Check if using backend sync
    const isAuthenticated = await backendApi.isAuthenticated();

    // Clear any error background
    statusBarItem.backgroundColor = undefined;

    if (availableMinutes <= 0) {
      statusBarItem.text = "🔒 No Credits";
      statusBarItem.tooltip = "No coding credits available - Record a workout!";
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
    } else if (availableMinutes < 60) {
      statusBarItem.text = `⚠️ ${availableMinutes}min`;
      statusBarItem.tooltip = `Low credits: ${availableMinutes} min remaining`;
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.warningBackground"
      );
    } else if (isAuthenticated) {
      statusBarItem.text = `💪 ${availableMinutes}min`;
      statusBarItem.tooltip = `Workout Lockout (Cloud Sync)\nAvailable: ${availableMinutes} min\nClick to view details`;
    } else {
      statusBarItem.text = `💪 ${availableMinutes}min`;
      statusBarItem.tooltip = `Workout Lockout (Local Mode)\nAvailable: ${availableMinutes} min\nClick to view details`;
    }

    statusBarItem.show();
  } catch (error) {
    statusBarItem.text = "💪 0min";
    statusBarItem.tooltip = "Workout Lockout - Click to record workout";
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );
    statusBarItem.show();
  }
}

export function deactivate() {
  if (lockoutManager) {
    lockoutManager.dispose();
  }
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
