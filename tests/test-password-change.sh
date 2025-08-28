#!/bin/bash

BASE_URL="http://localhost:3000"
TEST_EMAIL="test-password-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123!"
NEW_PASSWORD="NewPassword456@"
DEVICE_ID="test-device-password-$(date +%s)"

echo "🔐 Testing Password Change Specifically"
echo "======================================="
echo ""

# 1. Register a test user
echo "1. Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"deviceId\":\"$DEVICE_ID\"}")

TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo "✅ User registered successfully"
  echo "   Email: $TEST_EMAIL"
  echo "   Token: ${TOKEN:0:20}..."
else
  echo "❌ Registration failed"
  echo "Response: $REGISTER_RESPONSE"
  exit 1
fi
echo ""

# 2. Test password change with correct current password
echo "2. Testing password change with correct current password..."
CHANGE_PASSWORD_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/auth/change-password" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"currentPassword\":\"$TEST_PASSWORD\",\"newPassword\":\"$NEW_PASSWORD\"}")

echo "Change password response: $CHANGE_PASSWORD_RESPONSE"

if echo "$CHANGE_PASSWORD_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Password changed successfully"
else
  echo "❌ Password change failed"
  exit 1
fi
echo ""

# 3. Test login with old password (should fail)
echo "3. Testing login with old password..."
OLD_PASSWORD_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"deviceId\":\"$DEVICE_ID\"}")

echo "Old password login response: $OLD_PASSWORD_LOGIN"

if echo "$OLD_PASSWORD_LOGIN" | grep -q '"success":false'; then
  echo "✅ Correctly rejected old password"
else
  echo "❌ Should have rejected old password"
fi
echo ""

# 4. Test login with new password (should succeed)
echo "4. Testing login with new password..."
NEW_PASSWORD_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$NEW_PASSWORD\",\"deviceId\":\"$DEVICE_ID\"}")

echo "New password login response: $NEW_PASSWORD_LOGIN"

if echo "$NEW_PASSWORD_LOGIN" | grep -q '"success":true'; then
  echo "✅ Login with new password successful"
else
  echo "❌ Login with new password failed"
fi
echo ""

echo "🎉 Password change test completed!"
