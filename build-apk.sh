#!/bin/bash
# Nexus Platform — One-Click APK Build
# Run: bash build-apk.sh
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=================================="
echo " Nexus APK Builder v1.0"
echo "=================================="

PROJECT="$HOME/nexus-platform/android"
ANDROID_HOME="$HOME/android-sdk"
GRADLE_HOME="$HOME/gradle-8.5"

# 1. Extract Gradle
if [ ! -d "$GRADLE_HOME" ]; then
    echo "[1/4] Extracting Gradle..."
    cd ~
    unzip -o gradle.zip -d gradle-8.5 > /dev/null 2>&1
    echo "  ✓ Gradle ready"
else
    echo "[1/4] Gradle: already extracted"
fi
export PATH="$GRADLE_HOME/bin:$PATH"

# 2. Extract Android SDK tools
if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    echo "[2/4] Setting up Android SDK..."
    mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
    cd "$ANDROID_HOME/cmdline-tools"
    unzip -o tools.zip -d latest > /dev/null 2>&1
    echo "  ✓ SDK tools ready"
else
    echo "[2/4] SDK tools: already ready"
fi

# 3. Install SDK components
echo "[3/4] Installing SDK components..."
export ANDROID_HOME
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

yes | sdkmanager --licenses > /dev/null 2>&1 || true
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" > /dev/null 2>&1 || true
echo "  ✓ SDK components installed"

# 4. Build APK
echo "[4/4] Building APK..."
cd "$PROJECT"

# Write local.properties
echo "sdk.dir=$ANDROID_HOME" > local.properties

# Generate gradle wrapper if needed
if [ ! -f gradlew ]; then
    gradle wrapper --gradle-version 8.5 --no-daemon 2>/dev/null || true
fi

# Build!
./gradlew assembleDebug --no-daemon --stacktrace 2>&1 | tail -30

# Check result
APK=$(find app/build/outputs/apk -name "*.apk" 2>/dev/null | head -1)
if [ -n "$APK" ]; then
    SIZE=$(du -h "$APK" | cut -f1)
    echo ""
    echo -e "${GREEN}=================================="
    echo "  APK BUILD SUCCESS!"
    echo "=================================="
    echo "  File: $APK"
    echo "  Size: $SIZE"
    echo -e "==================================${NC}"
    
    # Copy to downloads
    cp "$APK" ~/storage/downloads/Nexus-v1.0.apk 2>/dev/null && echo "  Copied to Downloads/Nexus-v1.0.apk"
    
    # Open install
    termux-open "$APK" 2>/dev/null && echo "  Opening installer..."
else
    echo -e "${RED}Build failed. Check errors above.${NC}"
fi
