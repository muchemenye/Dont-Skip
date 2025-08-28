#!/bin/bash

BASE_URL="http://localhost:3000"
TEST_EMAIL="test-profile-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"
NEW_PASSWORD="NewPassword456@"
DEVICE_ID="test-device-profile-$(date +%s)"

echo "🧪 Testing Profile Management Endpoints"
echo "========================================"
echo ""

# 1. Register a test user
echo "1. Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"deviceId\":\"$DEVICE_ID\"}")

echo "Registration response: $REGISTER_RESPONSE"

# Extract token and user ID
TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Registration failed - no token received"
  exit 1
fi

echo "✅ User registered successfully"
echo "   Email: $TEST_EMAIL"
echo "   User ID: $USER_ID"
echo "   Token: ${TOKEN:0:20}..."
echo ""

# 2. Test profile update
echo "2. Testing profile update..."
NEW_EMAIL="updated-$TEST_EMAIL"
PROFILE_UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/auth/profile" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"email\":\"$NEW_EMAIL\"}")

echo "Profile update response: $PROFILE_UPDATE_RESPONSE"

if echo "$PROFILE_UPDATE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Profile updated successfully"
else
  echo "❌ Profile update failed"
fi
echo ""

# 3. Test change password with wrong current password
echo "3. Testing change password with wrong current password..."
WRONG_PASSWORD_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/auth/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"currentPassword\":\"WrongPassword123!\",\"newPassword\":\"$NEW_PASSWORD\"}")

echo "Wrong password response: $WRONG_PASSWORD_RESPONSE"

if echo "$WRONG_PASSWORD_RESPONSE" | grep -q '"success":false'; then
  echo "✅ Correctly rejected wrong current password"
else
  echo "❌ Should have rejected wrong password"
fi
echo ""

# 4. Test change password with correct current password
echo "4. Testing change password with correct current password..."
CHANGE_PASSWORD_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/auth/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"currentPassword\":\"$TEST_PASSWORD\",\"newPassword\":\"$NEW_PASSWORD\"}")

echo "Change password response: $CHANGE_PASSWORD_RESPONSE"

if echo "$CHANGE_PASSWORD_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Password changed successfully"
else
  echo "❌ Password change failed"
fi
echo ""

# 5. Test login with old password (should fail)
echo "5. Testing login with old password..."
OLD_PASSWORD_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"deviceId\":\"$DEVICE_ID\"}")

echo "Old password login response: $OLD_PASSWORD_LOGIN"

if echo "$OLD_PASSWORD_LOGIN" | grep -q '"success":false'; then
  echo "✅ Correctly rejected old password"
else
  echo "❌ Should have rejected old password"
fi
echo ""

# 6. Test login with new password (should succeed)
echo "6. Testing login with new password..."
NEW_PASSWORD_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASSWORD\",\"deviceId\":\"$DEVICE_ID\"}")

echo "New password login response: $NEW_PASSWORD_LOGIN"

if echo "$NEW_PASSWORD_LOGIN" | grep -q '"success":true'; then
  # Update token for delete test
  TOKEN=$(echo "$NEW_PASSWORD_LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  echo "✅ Login with new password successful"
else
  echo "❌ Login with new password failed"
fi
echo ""

# 7. Test token verification
echo "7. Testing token verification..."
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/verify" \
  -H "Authorization: Bearer $TOKEN")

echo "Verify response: $VERIFY_RESPONSE"

if echo "$VERIFY_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Token verification successful"
else
  echo "❌ Token verification failed"
fi
echo ""

# 8. Test account deletion
echo "8. Testing account deletion..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/api/auth/delete-account" \
  -H "Authorization: Bearer $TOKEN")

echo "Delete response: $DELETE_RESPONSE"

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Account deleted successfully"
else
  echo "❌ Account deletion failed"
fi
echo ""

# 9. Test that deleted account cannot login
echo "9. Testing that deleted account cannot login..."
DELETED_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$NEW_EMAIL\",\"password\":\"$NEW_PASSWORD\",\"deviceId\":\"$DEVICE_ID\"}")

echo "Deleted account login response: $DELETED_LOGIN"

if echo "$DELETED_LOGIN" | grep -q '"success":false'; then
  echo "✅ Correctly rejected login for deleted account"
else
  echo "❌ Should have rejected login for deleted account"
fi
echo ""

# 10. Test that deleted token is invalid
echo "10. Testing that deleted account token is invalid..."
INVALID_TOKEN_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/verify" \
  -H "Authorization: Bearer $TOKEN")

echo "Invalid token response: $INVALID_TOKEN_RESPONSE"

if echo "$INVALID_TOKEN_RESPONSE" | grep -q '"success":false'; then
  echo "✅ Correctly rejected invalid token for deleted account"
else
  echo "❌ Should have rejected invalid token"
fi
echo ""

echo "🎉 Profile management endpoint tests completed!"
echo ""

# Security Tests
echo "🔒 Running Security Tests"
echo "========================="
echo ""

# Test unauthorized access to change password
echo "1. Testing unauthorized password change..."
UNAUTHORIZED_PASSWORD=$(curl -s -X PUT "$BASE_URL/auth/change-password" \
  -H "Content-Type: application/json" \
  -d "{\"currentPassword\":\"any\",\"newPassword\":\"NewPassword123!\"}")

echo "Unauthorized password response: $UNAUTHORIZED_PASSWORD"

if echo "$UNAUTHORIZED_PASSWORD" | grep -q '"success":false'; then
  echo "✅ Correctly rejected unauthorized password change"
else
  echo "❌ Should have rejected unauthorized request"
fi
echo ""

# Test unauthorized access to delete account
echo "2. Testing unauthorized account deletion..."
UNAUTHORIZED_DELETE=$(curl -s -X DELETE "$BASE_URL/auth/delete-account")

echo "Unauthorized delete response: $UNAUTHORIZED_DELETE"

if echo "$UNAUTHORIZED_DELETE" | grep -q '"success":false'; then
  echo "✅ Correctly rejected unauthorized account deletion"
else
  echo "❌ Should have rejected unauthorized request"
fi
echo ""

echo "✨ All tests completed!"
