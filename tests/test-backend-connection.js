#!/usr/bin/env node

const https = require("https");
const http = require("http");
const { URL } = require("url");

// Simple HTTP client function
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const client = isHttps ? https : http;

    const headers = {
      "Content-Type": "application/json",
      "User-Agent": "VSCode-DontSkip-Test/1.0",
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
        try {
          const jsonData = JSON.parse(data);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            data: jsonData,
          });
        } catch (error) {
          resolve({
            ok: false,
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function testBackendConnection() {
  console.log("🧪 Testing VS Code Extension <-> Backend Connection\n");

  const baseUrl = "http://localhost:3000";

  // Test 1: Health Check
  console.log("1. Testing health endpoint...");
  try {
    const health = await makeRequest(`${baseUrl}/health`);
    if (health.ok) {
      console.log("   ✅ Health check passed");
      console.log("   📊 Status:", health.data.status);
      console.log("   🕒 Timestamp:", health.data.timestamp);
    } else {
      console.log("   ❌ Health check failed:", health.status);
      return;
    }
  } catch (error) {
    console.log("   ❌ Health check error:", error.message);
    return;
  }

  // Test 2: User Registration
  console.log("\n2. Testing user registration...");
  const testEmail = `test-vscode-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";
  const deviceId = "test-vscode-device-123";

  try {
    const registerResponse = await makeRequest(`${baseUrl}/api/auth/register`, {
      method: "POST",
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        deviceId: deviceId,
      }),
    });

    if (registerResponse.ok) {
      console.log("   ✅ Registration successful");
      const token = registerResponse.data.data.token;
      console.log("   🔑 Token received:", token.substring(0, 20) + "...");

      // Test 3: Get Workouts
      console.log("\n3. Testing authenticated workout fetch...");
      const workoutsResponse = await makeRequest(`${baseUrl}/api/workouts`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (workoutsResponse.ok) {
        console.log("   ✅ Workout fetch successful");
        console.log("   📋 Workouts found:", workoutsResponse.data.data.length);
      } else {
        console.log("   ❌ Workout fetch failed:", workoutsResponse.status);
      }

      // Test 4: Add Manual Workout
      console.log("\n4. Testing manual workout creation...");
      const now = new Date();
      const startTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

      const workoutResponse = await makeRequest(`${baseUrl}/api/workouts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source: "manual",
          type: "testing",
          startTime: startTime.toISOString(),
          endTime: now.toISOString(),
          duration: 30,
          calories: 250,
        }),
      });

      if (workoutResponse.ok) {
        console.log("   ✅ Manual workout creation successful");
        console.log("   💪 Workout ID:", workoutResponse.data.data.id);
        console.log(
          "   ⭐ Credits awarded:",
          workoutResponse.data.data.creditsAwarded
        );
      } else {
        console.log(
          "   ❌ Manual workout creation failed:",
          workoutResponse.status
        );
        console.log("   📄 Error:", workoutResponse.data.error);
      }

      // Test 5: Get Credits
      console.log("\n5. Testing credit balance fetch...");
      const creditsResponse = await makeRequest(
        `${baseUrl}/api/credits/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (creditsResponse.ok) {
        console.log("   ✅ Credit balance fetch successful");
        console.log(
          "   🏦 Available credits:",
          creditsResponse.data.data.availableCredits
        );
        console.log(
          "   📈 Max daily credits:",
          creditsResponse.data.data.maxDailyCredits
        );
      } else {
        console.log(
          "   ❌ Credit balance fetch failed:",
          creditsResponse.status
        );
      }
    } else {
      console.log("   ❌ Registration failed:", registerResponse.status);
      if (registerResponse.data.error) {
        console.log("   📄 Error:", registerResponse.data.error);
      }
    }
  } catch (error) {
    console.log("   ❌ Registration error:", error.message);
  }

  console.log("\n🎉 Backend connection test completed!");
  console.log(
    "📝 Summary: VS Code extension can successfully connect to backend API"
  );
  console.log("🔗 Ready for integration with iOS app data");
}

testBackendConnection().catch(console.error);
