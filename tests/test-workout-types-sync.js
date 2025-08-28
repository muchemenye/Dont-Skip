#!/usr/bin/env node

/**
 * Test script for Custom Workout Types Sync
 * Tests if custom workout types can be saved to backend and retrieved by iOS app
 */

const https = require("https");
const http = require("http");

const BASE_URL = "http://localhost:3000/api";

// Test data
const testUser = {
  email: `test-${Date.now()}@example.com`,
  password: "TestPass123!",
  deviceId: "test-device-" + Math.random().toString(36).substring(7),
};

const customWorkoutTypes = [
  {
    name: "Quick Stretch",
    minDuration: 5,
    codingHoursEarned: 2,
  },
  {
    name: "Cardio Session",
    minDuration: 20,
    codingHoursEarned: 4,
  },
  {
    name: "Strength Training",
    minDuration: 45,
    codingHoursEarned: 8,
  },
];

let authToken = "";

async function makeRequest(endpoint, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${endpoint}`;
    const parsedUrl = new URL(url);

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname,
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    if (authToken) {
      requestOptions.headers["Authorization"] = `Bearer ${authToken}`;
    }

    const client = parsedUrl.protocol === "https:" ? https : http;
    const req = client.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTest() {
  console.log("🧪 Testing Custom Workout Types Sync\n");

  try {
    // 1. Register test user
    console.log("1. Registering test user...");
    const registerResponse = await makeRequest("/auth/register", {
      method: "POST",
      body: testUser,
    });

    console.log("Registration response status:", registerResponse.status);
    console.log("Registration response data:", registerResponse.data);

    if (
      ![200, 201].includes(registerResponse.status) ||
      !registerResponse.data.success
    ) {
      console.log(
        "❌ Registration failed - Status:",
        registerResponse.status,
        "Success:",
        registerResponse.data.success
      );
      return;
    }

    authToken = registerResponse.data.data.token;
    console.log("✅ User registered successfully");

    // 2. Update settings with custom workout types
    console.log("\n2. Saving custom workout types to backend...");
    console.log("Sending workout types:", customWorkoutTypes);

    const settingsUpdate = {
      settings: {
        workoutCreditRatio: 2.0,
        maxDailyCredits: 480,
        emergencyCredits: 30,
        creditExpiration: 48,
        workoutTypes: customWorkoutTypes,
        lockoutEnabled: true,
      },
    };

    const updateResponse = await makeRequest("/user/settings", {
      method: "PUT",
      body: settingsUpdate,
    });

    console.log("Settings update response status:", updateResponse.status);
    console.log(
      "Settings update response data:",
      JSON.stringify(updateResponse.data, null, 2)
    );

    if (updateResponse.status !== 200 || !updateResponse.data.success) {
      console.log("❌ Settings update failed:", updateResponse.data);
      return;
    }
    console.log("✅ Custom workout types saved to backend");

    // 3. Retrieve user profile (what iOS app would do)
    console.log("\n3. Retrieving user profile (iOS app perspective)...");
    const profileResponse = await makeRequest("/user/profile");

    console.log("Profile response status:", profileResponse.status);
    console.log(
      "Profile response data:",
      JSON.stringify(profileResponse.data, null, 2)
    );

    if (profileResponse.status !== 200 || !profileResponse.data.success) {
      console.log("❌ Profile retrieval failed:", profileResponse.data);
      return;
    }

    const userSettings = profileResponse.data.data.settings;
    console.log("✅ User profile retrieved");

    // 4. Verify workout types are available
    console.log("\n4. Verifying workout types sync...");

    if (!userSettings.workoutTypes) {
      console.log("❌ No workout types found in user settings");
      return;
    }

    if (userSettings.workoutTypes.length !== customWorkoutTypes.length) {
      console.log(
        `❌ Workout types count mismatch. Expected: ${customWorkoutTypes.length}, Got: ${userSettings.workoutTypes.length}`
      );
      return;
    }

    // Check each workout type
    let allMatch = true;
    for (let i = 0; i < customWorkoutTypes.length; i++) {
      const expected = customWorkoutTypes[i];
      const actual = userSettings.workoutTypes[i];

      if (
        actual.name !== expected.name ||
        actual.minDuration !== expected.minDuration ||
        actual.codingHoursEarned !== expected.codingHoursEarned
      ) {
        console.log(`❌ Workout type mismatch at index ${i}:`);
        console.log(`   Expected:`, expected);
        console.log(`   Got:`, actual);
        allMatch = false;
      }
    }

    if (allMatch) {
      console.log("✅ All custom workout types synced correctly!");
      console.log("\n📱 iOS App Integration:");
      console.log("   ✅ iOS app can now access custom workout types");
      console.log(
        "   ✅ Custom credit values will be consistent across platforms"
      );
      console.log("   ✅ Users can configure once in VS Code, use everywhere");
    } else {
      console.log("❌ Some workout types did not sync correctly");
    }

    // 5. Display the synced workout types
    console.log("\n📋 Synced Workout Types:");
    userSettings.workoutTypes.forEach((type, index) => {
      console.log(`   ${index + 1}. ${type.name}`);
      console.log(`      Duration: ${type.minDuration} minutes`);
      console.log(`      Credits: ${type.codingHoursEarned} hours`);
    });

    console.log("\n🎉 Custom Workout Types Sync Test: PASSED");
  } catch (error) {
    console.log("❌ Test failed with error:", error.message);
  }
}

// Run the test
runTest().catch(console.error);
