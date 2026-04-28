#!/bin/bash
set -e

# Configuration
PROJECT_ROOT="/home/singer-nike/project/core/ai/trener"
GRADLE_FILE="$PROJECT_ROOT/android/app/build.gradle"
SIGN_SCRIPT="/home/singer-nike/project/core/ai/android.sign.sh"
APK_UNSIGNED="$PROJECT_ROOT/android/app/build/outputs/apk/release/app-release-unsigned.apk"
APK_SIGNED="$PROJECT_ROOT/Trener.signed.apk"

cd "$PROJECT_ROOT"

echo "📍 Starting Release Build..."

# 1. Increment Version
echo "🔧 Incrementing Version..."
# Read current version code
CURRENT_CODE=$(grep "versionCode" "$GRADLE_FILE" | awk '{print $2}')
NEW_CODE=$((CURRENT_CODE + 1))

# Read current version name
CURRENT_NAME=$(grep "versionName" "$GRADLE_FILE" | awk '{print $2}' | tr -d '"')
# Simple patch increment: 1.0 -> 1.1
MAJOR=$(echo "$CURRENT_NAME" | cut -d. -f1)
MINOR=$(echo "$CURRENT_NAME" | cut -d. -f2)
NEW_MINOR=$((MINOR + 1))
NEW_NAME="$MAJOR.$NEW_MINOR"

# Update build.gradle using sed (inplace)
sed -i "s/versionCode $CURRENT_CODE/versionCode $NEW_CODE/" "$GRADLE_FILE"
sed -i "s/versionName \"$CURRENT_NAME\"/versionName \"$NEW_NAME\"/" "$GRADLE_FILE"


echo "✅ Version bumped: $CURRENT_CODE ($CURRENT_NAME) -> $NEW_CODE ($NEW_NAME)"

# Sync package.json version
echo "📦 Updating package.json to $NEW_NAME.0..."
npm version "$NEW_NAME.0" --no-git-tag-version --allow-same-version


# 2. Build Web
echo "📦 Building Web Assets..."
npm run build
npx cap sync

# 3. Build Android APK
echo "🤖 Building Android APK..."
cd android
./gradlew assembleRelease
cd ..

# Check if APK exists
if [ ! -f "$APK_UNSIGNED" ]; then
    echo "❌ Error: Release APK not found at $APK_UNSIGNED"
    exit 1
fi

# 4. Sign APK
echo "🔐 Signing APK..."
"$SIGN_SCRIPT" "$APK_UNSIGNED" "$APK_SIGNED"

# 5. Install
echo "📲 Installing to Device..."
adb install -r "$APK_SIGNED"

echo "🚀 DONE! Installed version $NEW_NAME ($NEW_CODE)"
