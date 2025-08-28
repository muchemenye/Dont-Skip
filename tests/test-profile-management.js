const axios = require("axios");

// Test configuration
const BASE_URL = "http://localhost:3000";
const TEST_EMAIL = `test-profile-${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPassword123!";
const NEW_PASSWORD = "NewPassword456@";
const DEVICE_ID = "test-device-profile";

let authToken = "";
let userId = "";

console.log("🧪 Testing Profile Management Endpoints\n");

async function runProfileTests() {
  try {
    // 1. Register a test user
    console.log("1. Registering test user...");
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      deviceId: DEVICE_ID,
    });

    if (registerResponse.status === 201 && registerResponse.data.success) {
      authToken = registerResponse.data.data.token;
      userId = registerResponse.data.data.user.id;
      console.log("✅ User registered successfully");
      console.log(`   Email: ${TEST_EMAIL}`);
      console.log(`   User ID: ${userId}`);
    } else {
      throw new Error("Registration failed");
    }

    // 2. Test profile update
    console.log("\n2. Testing profile update...");
    const newEmail = `updated-${TEST_EMAIL}`;
    const profileUpdateResponse = await axios.put(
      `${BASE_URL}/auth/profile`,
      {
        email: newEmail,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (
      profileUpdateResponse.status === 200 &&
      profileUpdateResponse.data.success
    ) {
      console.log("✅ Profile updated successfully");
      console.log(`   New email: ${profileUpdateResponse.data.data.email}`);
    } else {
      throw new Error("Profile update failed");
    }

    // 3. Test change password with wrong current password
    console.log("\n3. Testing change password with wrong current password...");
    try {
      await axios.put(
        `${BASE_URL}/auth/change-password`,
        {
          currentPassword: "WrongPassword123!",
          newPassword: NEW_PASSWORD,
        },
        {
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );
      console.log("❌ Should have failed with wrong password");
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log("✅ Correctly rejected wrong current password");
      } else {
        throw error;
      }
    }

    // 4. Test change password with correct current password
    console.log(
      "\n4. Testing change password with correct current password..."
    );
    const changePasswordResponse = await axios.put(
      `${BASE_URL}/auth/change-password`,
      {
        currentPassword: TEST_PASSWORD,
        newPassword: NEW_PASSWORD,
      },
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (
      changePasswordResponse.status === 200 &&
      changePasswordResponse.data.success
    ) {
      console.log("✅ Password changed successfully");
    } else {
      throw new Error("Password change failed");
    }

    // 5. Test login with old password (should fail)
    console.log("\n5. Testing login with old password...");
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: newEmail,
        password: TEST_PASSWORD,
        deviceId: DEVICE_ID,
      });
      console.log("❌ Should have failed with old password");
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log("✅ Correctly rejected old password");
      } else {
        throw error;
      }
    }

    // 6. Test login with new password (should succeed)
    console.log("\n6. Testing login with new password...");
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: newEmail,
      password: NEW_PASSWORD,
      deviceId: DEVICE_ID,
    });

    if (loginResponse.status === 200 && loginResponse.data.success) {
      console.log("✅ Login with new password successful");
      // Update token for delete test
      authToken = loginResponse.data.data.token;
    } else {
      throw new Error("Login with new password failed");
    }

    // 7. Test token verification
    console.log("\n7. Testing token verification...");
    const verifyResponse = await axios.get(`${BASE_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (verifyResponse.status === 200 && verifyResponse.data.success) {
      console.log("✅ Token verification successful");
      console.log(`   User: ${verifyResponse.data.data.user.email}`);
    } else {
      throw new Error("Token verification failed");
    }

    // 8. Test account deletion
    console.log("\n8. Testing account deletion...");
    const deleteResponse = await axios.delete(
      `${BASE_URL}/auth/delete-account`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    if (deleteResponse.status === 200 && deleteResponse.data.success) {
      console.log("✅ Account deleted successfully");
    } else {
      throw new Error("Account deletion failed");
    }

    // 9. Test that deleted account cannot login
    console.log("\n9. Testing that deleted account cannot login...");
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: newEmail,
        password: NEW_PASSWORD,
        deviceId: DEVICE_ID,
      });
      console.log("❌ Should have failed - account is deleted");
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log("✅ Correctly rejected login for deleted account");
      } else {
        throw error;
      }
    }

    // 10. Test that deleted token is invalid
    console.log("\n10. Testing that deleted account token is invalid...");
    try {
      await axios.get(`${BASE_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      console.log("❌ Should have failed - token should be invalid");
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log("✅ Correctly rejected invalid token for deleted account");
      } else {
        throw error;
      }
    }

    console.log("\n🎉 All profile management tests passed!");
  } catch (error) {
    console.error(
      "\n❌ Profile management test failed:",
      error.response?.data || error.message
    );

    // Cleanup: try to delete the test user if it exists
    if (authToken) {
      try {
        await axios.delete(`${BASE_URL}/auth/delete-account`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        console.log("🧹 Cleanup: Test user deleted");
      } catch (cleanupError) {
        console.log("⚠️ Cleanup failed (user might already be deleted)");
      }
    }
  }
}

// Additional security tests
async function runSecurityTests() {
  console.log("\n🔒 Running Security Tests\n");

  try {
    // Test password validation
    console.log("1. Testing weak password rejection...");
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        email: `weak-pass-${Date.now()}@example.com`,
        password: "weak",
        deviceId: "test-weak-device",
      });
      console.log("❌ Should have rejected weak password");
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log("✅ Correctly rejected weak password");
      } else {
        throw error;
      }
    }

    // Test unauthorized access to change password
    console.log("\n2. Testing unauthorized password change...");
    try {
      await axios.put(`${BASE_URL}/auth/change-password`, {
        currentPassword: "any",
        newPassword: "NewPassword123!",
      });
      console.log("❌ Should have rejected unauthorized request");
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log("✅ Correctly rejected unauthorized password change");
      } else {
        throw error;
      }
    }

    // Test unauthorized access to delete account
    console.log("\n3. Testing unauthorized account deletion...");
    try {
      await axios.delete(`${BASE_URL}/auth/delete-account`);
      console.log("❌ Should have rejected unauthorized request");
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log("✅ Correctly rejected unauthorized account deletion");
      } else {
        throw error;
      }
    }

    console.log("\n🔒 All security tests passed!");
  } catch (error) {
    console.error(
      "\n❌ Security test failed:",
      error.response?.data || error.message
    );
  }
}

// Run tests
async function main() {
  console.log("Starting profile management endpoint tests...\n");

  await runProfileTests();
  await runSecurityTests();

  console.log("\n✨ All tests completed!");
}

main().catch(console.error);
