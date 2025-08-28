import * as vscode from "vscode";
import { CreditManager, WorkoutType } from "./creditManager";
import { BackendApiService } from "./services/BackendApiService";

export class SettingsWebview {
  private context: vscode.ExtensionContext;
  private creditManager: CreditManager;
  private backendApi: BackendApiService;
  private panel: vscode.WebviewPanel | null = null;

  constructor(
    context: vscode.ExtensionContext,
    creditManager: CreditManager,
    backendApi: BackendApiService
  ) {
    this.context = context;
    this.creditManager = creditManager;
    this.backendApi = backendApi;
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "workoutLockoutSettings",
      "Workout Lockout Settings",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = this.getWebviewContent();

    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      this.context.subscriptions
    );

    this.panel.onDidDispose(() => {
      this.panel = null;
    });
  }

  private handleMessage(message: any): void {
    switch (message.command) {
      case "saveSettings":
        this.saveSettings(message.settings);
        break;
      case "loadSettings":
        this.loadSettings();
        break;
      case "addWorkoutType":
        this.addWorkoutType();
        break;
    }
  }

  private saveSettings(settings: any): void {
    const config = vscode.workspace.getConfiguration("dontSkip");

    // Save settings locally (for backward compatibility)
    config.update(
      "workoutTypes",
      settings.workoutTypes,
      vscode.ConfigurationTarget.Global
    );
    config.update(
      "maxDailyCoding",
      settings.maxDailyCoding,
      vscode.ConfigurationTarget.Global
    );
    config.update(
      "creditRolloverDays",
      settings.creditRolloverDays,
      vscode.ConfigurationTarget.Global
    );
    config.update(
      "gracePeriodMinutes",
      settings.gracePeriodMinutes,
      vscode.ConfigurationTarget.Global
    );

    // Also sync to backend if authenticated
    this.syncSettingsToBackend(settings);

    vscode.window.showInformationMessage("Settings saved successfully!");
  }

  private async syncSettingsToBackend(settings: any): Promise<void> {
    try {
      if (await this.backendApi.isAuthenticated()) {
        // Map VS Code settings to backend format
        const backendSettings = {
          workoutCreditRatio: 2.0, // Default, can be made configurable
          maxDailyCredits: settings.maxDailyCoding * 60 || 480, // Convert hours to minutes
          emergencyCredits: 30, // Default, can be made configurable
          creditExpiration: settings.creditRolloverDays * 24 || 48, // Convert days to hours
          workoutTypes: settings.workoutTypes || [],
          lockoutEnabled: true, // Default, can be made configurable
        };

        await this.backendApi.updateSettings(backendSettings);
        console.log("Settings synced to backend successfully");
      }
    } catch (error) {
      console.warn("Failed to sync settings to backend:", error);
      // Don't show error to user - local settings still work
    }
  }

  private loadSettings(): void {
    const config = vscode.workspace.getConfiguration("dontSkip");

    const settings = {
      workoutTypes: config.get("workoutTypes"),
      maxDailyCoding: config.get("maxDailyCoding"),
      creditRolloverDays: config.get("creditRolloverDays"),
      gracePeriodMinutes: config.get("gracePeriodMinutes"),
    };

    // Try to load settings from backend and merge
    this.loadSettingsFromBackend(settings);
  }

  private async loadSettingsFromBackend(localSettings: any): Promise<void> {
    try {
      if (await this.backendApi.isAuthenticated()) {
        const userProfile = await this.backendApi.getUserProfile();
        if (userProfile && userProfile.settings) {
          // Merge backend settings with local settings (backend takes precedence for workout types)
          const mergedSettings = {
            ...localSettings,
            workoutTypes:
              userProfile.settings.workoutTypes ||
              localSettings.workoutTypes ||
              [],
            maxDailyCoding: userProfile.settings.maxDailyCredits
              ? Math.round(userProfile.settings.maxDailyCredits / 60)
              : localSettings.maxDailyCoding,
            creditRolloverDays: userProfile.settings.creditExpiration
              ? Math.round(userProfile.settings.creditExpiration / 24)
              : localSettings.creditRolloverDays,
          };

          this.panel?.webview.postMessage({
            command: "settingsLoaded",
            settings: mergedSettings,
          });
          return;
        }
      }
    } catch (error) {
      console.warn("Failed to load settings from backend:", error);
    }

    // Fallback to local settings
    this.panel?.webview.postMessage({
      command: "settingsLoaded",
      settings: localSettings,
    });
  }

  private addWorkoutType(): void {
    // This will be handled by the webview UI
  }

  private getWebviewContent(): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Workout Lockout Settings</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                .section {
                    margin-bottom: 30px;
                    padding: 20px;
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 8px;
                }
                .section h2 {
                    margin-top: 0;
                    color: var(--vscode-textLink-foreground);
                }
                .form-group {
                    margin-bottom: 15px;
                }
                label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                input, select {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border-radius: 4px;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 10px;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .workout-type {
                    border: 1px solid var(--vscode-input-border);
                    padding: 15px;
                    margin-bottom: 10px;
                    border-radius: 4px;
                    background-color: var(--vscode-input-background);
                }
                .workout-type-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .remove-btn {
                    background-color: var(--vscode-errorForeground);
                    padding: 5px 10px;
                    font-size: 12px;
                }
                .add-btn {
                    background-color: var(--vscode-textLink-foreground);
                }
                .form-row {
                    display: flex;
                    gap: 15px;
                }
                .form-row .form-group {
                    flex: 1;
                }
                .description {
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 15px;
                }
            </style>
        </head>
        <body>
            <h1>🏋️‍♂️ Workout Lockout Settings</h1>
            
            <div class="section">
                <h2>Workout Types</h2>
                <div class="description">
                    Define your workout types and how much coding time each one earns you.
                </div>
                <div id="workoutTypes"></div>
                <button class="add-btn" onclick="addWorkoutType()">+ Add Workout Type</button>
            </div>

            <div class="section">
                <h2>Daily Limits</h2>
                <div class="description">
                    Set your maximum daily coding time and credit management preferences.
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="maxDailyCoding">Max Daily Coding (hours)</label>
                        <input type="number" id="maxDailyCoding" min="1" max="24" step="0.5">
                    </div>
                    <div class="form-group">
                        <label for="creditRolloverDays">Credit Rollover (days)</label>
                        <input type="number" id="creditRolloverDays" min="1" max="7">
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="gracePeriodMinutes">Emergency Unlock Duration (minutes)</label>
                    <input type="number" id="gracePeriodMinutes" min="5" max="120" step="5">
                </div>
            </div>

            <div class="section">
                <button onclick="saveSettings()">💾 Save Settings</button>
                <button onclick="resetToDefaults()">🔄 Reset to Defaults</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let workoutTypes = [];

                // Load settings on startup
                window.addEventListener('load', () => {
                    vscode.postMessage({ command: 'loadSettings' });
                });

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'settingsLoaded') {
                        loadSettingsIntoUI(message.settings);
                    }
                });

                function loadSettingsIntoUI(settings) {
                    workoutTypes = settings.workoutTypes || [];
                    document.getElementById('maxDailyCoding').value = settings.maxDailyCoding || 8;
                    document.getElementById('creditRolloverDays').value = settings.creditRolloverDays || 2;
                    document.getElementById('gracePeriodMinutes').value = settings.gracePeriodMinutes || 30;
                    
                    renderWorkoutTypes();
                }

                function renderWorkoutTypes() {
                    const container = document.getElementById('workoutTypes');
                    container.innerHTML = '';

                    workoutTypes.forEach((type, index) => {
                        const div = document.createElement('div');
                        div.className = 'workout-type';
                        div.innerHTML = \`
                            <div class="workout-type-header">
                                <strong>\${type.name}</strong>
                                <button class="remove-btn" onclick="removeWorkoutType(\${index})">Remove</button>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Workout Name</label>
                                    <input type="text" value="\${type.name}" onchange="updateWorkoutType(\${index}, 'name', this.value)">
                                </div>
                                <div class="form-group">
                                    <label>Min Duration (minutes)</label>
                                    <input type="number" value="\${type.minDuration}" min="1" onchange="updateWorkoutType(\${index}, 'minDuration', parseInt(this.value))">
                                </div>
                                <div class="form-group">
                                    <label>Coding Hours Earned</label>
                                    <input type="number" value="\${type.codingHours}" min="0.5" step="0.5" onchange="updateWorkoutType(\${index}, 'codingHours', parseFloat(this.value))">
                                </div>
                            </div>
                        \`;
                        container.appendChild(div);
                    });
                }

                function addWorkoutType() {
                    workoutTypes.push({
                        name: 'New Workout',
                        minDuration: 15,
                        codingHours: 2
                    });
                    renderWorkoutTypes();
                }

                function removeWorkoutType(index) {
                    workoutTypes.splice(index, 1);
                    renderWorkoutTypes();
                }

                function updateWorkoutType(index, field, value) {
                    workoutTypes[index][field] = value;
                }

                function saveSettings() {
                    const settings = {
                        workoutTypes: workoutTypes,
                        maxDailyCoding: parseFloat(document.getElementById('maxDailyCoding').value),
                        creditRolloverDays: parseInt(document.getElementById('creditRolloverDays').value),
                        gracePeriodMinutes: parseInt(document.getElementById('gracePeriodMinutes').value)
                    };

                    vscode.postMessage({
                        command: 'saveSettings',
                        settings: settings
                    });
                }

                function resetToDefaults() {
                    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
                        loadSettingsIntoUI({
                            workoutTypes: [
                                { name: 'Quick Stretch', minDuration: 5, codingHours: 2 },
                                { name: 'Cardio Session', minDuration: 20, codingHours: 4 },
                                { name: 'Strength Training', minDuration: 45, codingHours: 8 }
                            ],
                            maxDailyCoding: 8,
                            creditRolloverDays: 2,
                            gracePeriodMinutes: 30
                        });
                    }
                }
            </script>
        </body>
        </html>
        `;
  }
}
