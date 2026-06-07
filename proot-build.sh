#!/bin/bash
# Nexus APK Builder — runs inside proot Ubuntu
set -e

echo "========================================="
echo " Nexus APK Builder — Ubuntu Environment"
echo "========================================="

# Update & install deps
echo "[1/5] Installing dependencies..."
apt-get update -qq
apt-get install -y -qq openjdk-17-jdk-headless unzip curl 2>&1 | tail -3

# Android SDK
echo "[2/5] Setting up Android SDK..."
ANDROID_HOME=/root/android-sdk
mkdir -p $ANDROID_HOME/cmdline-tools
cd $ANDROID_HOME/cmdline-tools
if [ ! -f tools.zip ]; then
    curl -L -o tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
fi
unzip -o tools.zip -d latest > /dev/null 2>&1
export ANDROID_HOME
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

# Accept licenses
yes | sdkmanager --licenses > /dev/null 2>&1 || true

# Install SDK components
echo "[3/5] Installing SDK components..."
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0" > /dev/null 2>&1 || true

# Build
echo "[4/5] Building APK..."
cd /root/nexus-project/android
echo "sdk.dir=$ANDROID_HOME" > local.properties
echo "android.suppressUnsupportedCompileSdk=35" >> gradle.properties 2>/dev/null || true

# Generate wrapper if needed
if [ ! -f gradlew ]; then
    gradle wrapper --gradle-version 8.5 --no-daemon 2>/dev/null || true
fi

# Build!
./gradlew assembleDebug --no-daemon --stacktrace 2>&1

# Check result
echo "[5/5] Checking result..."
APK=$(find app/build/outputs/apk -name "*.apk" 2>/dev/null | head -1)
if [ -n "$APK" ]; then
    cp "$APK" /root/output/Nexus-v1.0.apk
    echo "APK built: /root/output/Nexus-v1.0.apk ($(du -h "$APK" | cut -f1))"
else
    echo "Build failed — check logs above"
fi
