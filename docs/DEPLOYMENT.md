# 🚀 Deployment Guide

This guide covers setup, development, testing, and deployment of the Password Manager application.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Google Apps Script Setup](#google-apps-script-setup)
- [Running the App](#running-the-app)
- [Building for Android](#building-for-android)
- [Publishing to Google Play Store](#publishing-to-google-play-store)
- [Android SDK Setup](#android-sdk-setup)
- [Android Simulator Testing](#android-simulator-testing)
- [APK Transfer Guide](#apk-transfer-guide)
- [Local Build Setup](#local-build-setup)
- [Build Checklist](#build-checklist)
- [Build Fix Summary](#build-fix-summary)
- [Troubleshooting](#troubleshooting)
- [Architecture](#architecture)
- [Security](#security)
- [Development](#development)

## 🛠️ Prerequisites

Before running any commands, ensure you have:
1. **Node.js** (v14 or higher) & npm
2. **Expo CLI**: `npm install -g expo-cli`
3. **EAS CLI**: `npm install -g eas-cli`
4. **Expo Go** app installed on your phone
5. **Google Account** (for Google Sheets backend)
6. **Logged in** to Expo: `eas login`

## 📊 Google Apps Script Setup

### Step 1: Create a Google Sheet

**Option A: Use Template (Recommended)**
1. Click this link to make a copy: [Password Manager Template](https://docs.google.com/spreadsheets/d/115IizwRB6BFuIKbWIFeuKsAEtIhm3ON50RRGv3sRIu8/copy)
2. Rename your copy (e.g., "My Password Manager")
3. The headers and Apps Script are already set up! Skip to **Step 3**.

**Option B: Create from Scratch**
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "Password Manager" (or any name you prefer)
4. Add headers in the first row:
   ```
   ID | SiteName | Username | Password | LastModified | Comments
   ```

### Step 2: Set Up Apps Script (Skip if you used the template)

1. In your Google Sheet, click **Extensions** → **Apps Script**
2. Delete any existing code
3. Copy the entire contents of `docs/google_apps_script.js` from this repository
4. Paste it into the Apps Script editor
5. Click **Save** (💾 icon)

### Step 3: Deploy as Web App

1. Click **Deploy** → **New deployment**
2. Click the gear icon (⚙️) next to "Select type"
3. Choose **Web app**
4. Configure:
   - **Description**: "Password Manager API"
   - **Execute as**: Me
   - **Who has access**: Anyone
5. Click **Deploy**
6. **Copy the Web App URL** (you'll need this in the app)
7. Click **Done**

### Step 4: Configure the Mobile App

1. Launch the mobile app
2. On first run, you'll see the Setup Guide
3. Paste the Web App URL you copied
4. Click "Save & Test Connection"

## 🏃 Running the App

### 1️⃣ Phase 1: Local Development
*Goal: Run the app on your phone while coding to see changes instantly.*

**Command:**
```bash
cd mobile
npm start
```

**How to use:**
1. Run the command in your terminal.
2. Scan the QR code with the **Expo Go** app on your Android/iOS device.
3. The app will load and update automatically as you save code changes.

You can also:
- Press `w` to open in web browser
- Press `a` to open in Android emulator
- Press `i` to open in iOS simulator

## 📦 Building for Android

### 2️⃣ Phase 2: Internal Testing (APK)
*Goal: Generate a standalone `.apk` file to install and test manually on Android devices.*

**Command:**
```bash
npm run build:android
```

**What happens:**
- This builds a **Universal APK** (~70MB).
- **Why so big?** It contains code for ALL device chips (ARM, x86, etc.) so it works on any phone or emulator you test on.
- **Output:** You will get a download link for the `.apk` file.

**How to Install:**
1. **Download:** Download the `.apk` file to your phone (or transfer it via USB/Google Drive).
2. **Open:** Tap the file in your phone's File Manager.
3. **Allow:** If prompted, allow installation from "Unknown Sources".
4. **Install:** Tap "Install" and open the app.

### 3️⃣ Phase 3: Production Release (Play Store)
*Goal: Generate an optimized `.aab` file for the Google Play Store.*

**Command:**
```bash
npm run build:prod
```

**What happens:**
- This builds an **Android App Bundle (.aab)**.
- **Size:** Much smaller (~15-25MB for users).
- **Usage:** You **cannot** install this file directly. You must upload it to the Google Play Console. Google then optimizes it for each user's device.

## 🎯 Publishing to Google Play Store

### Step 1: Google Play Console Account
- Go to [Google Play Console](https://play.google.com/console).
- Pay a **one-time fee of $25**.
- Verify your identity.

### Step 2: Create Your App
- Click **"Create App"**.
- Enter App Name (e.g., "KeyVault Pro").
- Select **App** (not Game) and **Free** (or Paid).

### Step 3: Store Listing Setup
You must provide:
- **Short Description** (80 chars).
- **Full Description** (4000 chars).
- **Graphics**:
  - App Icon: 512x512 px (PNG).
  - Feature Graphic: 1024x500 px (PNG).
  - Phone Screenshots: At least 2 (16:9 or 9:16).

### Step 4: Uploading the Bundle
1. Run `npm run build:prod` to generate the `.aab` file.
2. In Play Console, go to **Testing > Internal testing** (recommended for first time).
3. Click **"Create new release"**.
4. Upload the `.aab` file.
5. Add release notes (e.g., "Initial release").
6. Click **"Next"** and **"Save"**.

### Step 5: Release Tracks & Review Times
- **Internal Testing**: Available to testers within **minutes**. Great for rapid daily updates.
- **Closed Testing**: Available to specific email lists. Requires review (hours to days).
- **Production**: Public to everyone.
  - **First Review**: Can take **1-7 days**.
  - **Updates**: Usually approved in **1-24 hours**.

### FAQ: Can I publish multiple versions every day?
- **Yes, for Testing Tracks:** You can release to "Internal Testing" as many times as you want instantly.
- **No, for Production:** Since every update requires a Google review (which takes hours), you practically cannot release to *Production* multiple times a day.

### The "Promotion" Workflow
This is the standard lifecycle of an update:
1. **Upload to Internal Testing**: You upload your `.aab`. It is available immediately to you and your team.
2. **Verify**: You test the app on your phones.
3. **Promote to Production**: In the Play Console, you click a button to "Promote release to Production".
4. **Google Review**: Google reviews this specific version (takes 1-24 hours).
5. **Live**: Once approved, it becomes available to the public.

### Managing Testers
How do testers know there is an update?
1. **Email List**: In the Play Console, you create an email list (e.g., "My Team") and add their Gmail addresses.
2. **Opt-in Link**: Google generates a special "Opt-in URL" for your app. You send this link to your testers **once**.
3. **Acceptance**: Testers click the link and accept the invitation.
4. **Download**:
   - They can now find and install your "Internal" version from the Play Store just like a normal app.
   - **Updates**: When you upload a new version, their Play Store app will update it automatically (or they can click "Update" manually). They do **not** get an email for every single update; the Play Store handles it.

### Who sees what?
| Track | Audience | Purpose |
| :--- | :--- | :--- |
| **Internal Testing** | **Only people you invite** (by email). | For you and your team to test daily builds. |
| **Production** | **The whole world** (anyone on Play Store). | For your real users. |

**Key Concept:** The public *never* sees your Internal Testing version. They only see what you explicitly "Promote" to Production.

## 📝 Summary of Commands

| Goal | Command | Output |
| :--- | :--- | :--- |
| **Develop** | `npm start` | QR Code (Expo Go) |
| **Test** | `npm run build:android` | `.apk` file (Large) |
| **Publish** | `npm run build:prod` | `.aab` file (Small) |

## 🏗️ Architecture

```
┌─────────────────┐
│  React Native   │
│   Mobile App    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────┐
│SQLite │ │ Network │
│ Local │ │ Monitor │
└───┬───┘ └──┬──────┘
    │        │
    │   ┌────▼────────┐
    │   │ Sync Queue  │
    │   └────┬────────┘
    │        │
    │   ┌────▼────────┐
    │   │ Encrypt     │
    │   └────┬────────┘
    │        │
    │   ┌────▼────────▼───┐
    │   │  Google Apps    │
    │   │     Script      │
    │   └────┬────────────┘
         │
    ┌────▼────────┐
    │   Google    │
    │   Sheets    │
    └─────────────┘
```

## 🔒 Security

### Encryption

- **Algorithm**: AES-256-CBC
- **Key**: Hardcoded in `Encryption.js` (⚠️ **Change this in production!**)
- **Scope**: Passwords are encrypted before:
  - Storing locally
  - Syncing to Google Sheets
  - Displaying in UI (decrypted on-the-fly)

### Authentication

- **PIN-based**: Simple 4-digit PIN (default: `1234`)
- **Local only**: PIN is checked locally, not sent to server
- **Session**: Remains logged in until app is closed or logout

### ⚠️ Security Recommendations for Production

1. **Change the encryption key** in `src/services/Encryption.js`
2. **Implement proper key management** (use device keychain/keystore)
3. **Add biometric authentication** (fingerprint/Face ID)
4. **Use a stronger PIN** or passphrase
5. **Enable 2FA** for your Google Account
6. **Restrict Apps Script access** to specific Google accounts

## 🛠️ Development

### Key Technologies

- **React Native** - Cross-platform mobile framework
- **Expo** - Development tooling and build service
- **React Navigation** - Screen navigation
- **expo-sqlite** - Local database (mobile)
- **expo-secure-store** - Secure storage (mobile)
- **@react-native-community/netinfo** - Network monitoring
- **Google Apps Script** - Serverless backend
- **Google Sheets** - Database

### Adding New Features

1. **New Screen**: Add to `src/screens/` and register in `App.js`
2. **New Service**: Add to `src/services/`
3. **Backend Changes**: Update `docs/google_apps_script.js` and redeploy

### Debugging

- **Console Logs**: Check Expo DevTools console
- **Network**: Monitor sync logs in console
- **Database**: Use `console.log(getPasswords())` to view local data
- **Sync Queue**: Check `AsyncStorage` for `@sync_queue`

---

## Android SDK Setup

### Quick Fix for "Failed to resolve Android SDK path"

### Step 1: Install Android Studio

1. Download: https://developer.android.com/studio
2. Install with default settings
3. Open Android Studio → **More Actions** → **SDK Manager**

### Step 2: Find Your Android SDK Path

**Common locations:**
- `C:\Users\<YourUsername>\AppData\Local\Android\Sdk`
- `C:\Android\Sdk`
- Or check: Android Studio → **Settings** → **Appearance & Behavior** → **System Settings** → **Android SDK** → **Android SDK Location**

**Important**: Android Studio Installation ≠ Android SDK Location
- ❌ **NOT this:** `C:\Program Files\Android\Android Studio` (This is the IDE installation)
- ✅ **THIS:** `C:\Users\<YourUsername>\AppData\Local\Android\Sdk` (This is the SDK location)

**Method 1: Via SDK Manager (EASIEST - Recommended!)**
1. Open **Android Studio**
2. In the top menu, click **Tools** → **SDK Manager**
   - OR if you're on the welcome screen: **More Actions** → **SDK Manager**
3. At the very top of the SDK Manager window, you'll see:
   - **"Android SDK Location:"** followed by a path field
   - This shows your SDK path! (usually `C:\Users\<YourUsername>\AppData\Local\Android\Sdk`)
4. **Copy this path** - this is what you need for ANDROID_HOME!

**Method 2: Via Settings (Alternative)**
1. Open **Android Studio**
2. Go to **File** → **Settings** (or press `Ctrl + Alt + S`)
3. Navigate to **Appearance & Behavior** → **System Settings** → **Android SDK**
   - *Note: If you don't see "Android SDK" here, use Method 1 (SDK Manager) instead*
4. Copy the **Android SDK Location** path shown at the top

### Step 3: Set Environment Variables (Windows)

#### Method A: Using GUI (Easiest)

1. **Open System Properties**:
   - Press `Win + R`
   - Type `sysdm.cpl` and press Enter
   - Go to **Advanced** tab
   - Click **Environment Variables**

2. **Add ANDROID_HOME**:
   - Under **User variables**, click **New**
   - Variable name: `ANDROID_HOME`
   - Variable value: `C:\Users\<YourUsername>\AppData\Local\Android\Sdk` (or your SDK path)
   - Click **OK**

3. **Update PATH**:
   - Under **User variables**, find **Path** and click **Edit**
   - Click **New** and add: `%ANDROID_HOME%\platform-tools`
   - Click **New** and add: `%ANDROID_HOME%\tools`
   - Click **New** and add: `%ANDROID_HOME%\tools\bin`
   - Click **OK** on all dialogs

4. **Restart PowerShell/Terminal** (important!)

#### Method B: Using PowerShell (Quick)

```powershell
# Replace with your actual SDK path
$sdkPath = "C:\Users\<YourUsername>\AppData\Local\Android\Sdk"

# Set ANDROID_HOME (for current session)
$env:ANDROID_HOME = $sdkPath
$env:PATH += ";$sdkPath\platform-tools;$sdkPath\tools;$sdkPath\tools\bin"

# Set permanently (requires admin)
[System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdkPath, "User")
$currentPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$newPath = "$currentPath;$sdkPath\platform-tools;$sdkPath\tools;$sdkPath\tools\bin"
[System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
```

**Note**: After running PowerShell commands, restart your terminal.

### Step 4: Verify Setup

Open a **new** PowerShell window and run:

```powershell
# Check ANDROID_HOME
echo $env:ANDROID_HOME

# Check adb
adb version

# Check Android SDK
$env:ANDROID_HOME
```

You should see:
- ANDROID_HOME path displayed
- adb version information
- No "not recognized" errors

### Step 5: Install Required SDK Components

1. Open **Android Studio**
2. Go to **Tools** → **SDK Manager**
3. Install:
   - ✅ **Android SDK Platform** (API 33 or 34)
   - ✅ **Android SDK Build-Tools**
   - ✅ **Android SDK Platform-Tools**
   - ✅ **Android Emulator** (if you want to use emulator)

### Step 6: Try Again

```bash
cd mobile
npx expo run:android
```

---

## Android Simulator Testing

### Prerequisites Checklist

- [x] Android Studio installed
- [ ] Android SDK configured
- [ ] Environment variables set (ANDROID_HOME)
- [ ] Android Virtual Device (AVD) created
- [ ] Node.js and npm installed
- [ ] Dependencies installed in the project

### Step 1: Set Up Android SDK Environment Variables

See [Android SDK Setup](#android-sdk-setup) section above.

### Step 2: Install Required SDK Components

1. Open **Android Studio**
2. Go to **Tools** → **SDK Manager** (or **More Actions** → **SDK Manager**)
3. In the **SDK Platforms** tab, check:
   - ✅ **Android 13.0 (Tiramisu)** - API Level 33 (recommended)
   - ✅ **Android 14.0 (UpsideDownCake)** - API Level 34 (optional)
4. In the **SDK Tools** tab, ensure these are checked:
   - ✅ **Android SDK Build-Tools**
   - ✅ **Android SDK Platform-Tools**
   - ✅ **Android SDK Command-line Tools**
   - ✅ **Android Emulator**
5. Click **Apply** and wait for installation to complete

### Step 3: Create an Android Virtual Device (AVD)

1. In **Android Studio**, go to **Tools** → **Device Manager** (or click the device icon in the toolbar)
2. Click **Create Device** (or **+ Create Virtual Device**)
3. Select a device definition:
   - **Recommended**: **Pixel 5** or **Pixel 6** (good balance of performance and features)
   - Click **Next**
4. Select a system image:
   - **Recommended**: **API 33 (Android 13)** - **Tiramisu**
   - If not downloaded, click **Download** next to it and wait
   - Click **Next**
5. Configure AVD:
   - **AVD Name**: Keep default or name it (e.g., "Pixel_5_API_33")
   - **Startup orientation**: Portrait
   - Click **Finish**
6. Your AVD should now appear in the Device Manager list

### Step 4: Start the Android Emulator

#### Option A: From Android Studio

1. Open **Android Studio**
2. Go to **Tools** → **Device Manager**
3. Find your AVD in the list
4. Click the **Play** (▶️) button next to it
5. Wait for the emulator to boot up (first time takes 1-2 minutes)

#### Option B: From Command Line

Once the emulator is running, you can start it from command line next time:

```powershell
# List available AVDs
emulator -list-avds

# Start a specific AVD (replace with your AVD name)
emulator -avd Pixel_5_API_33
```

### Step 5: Install Project Dependencies

Open a terminal/PowerShell in the project directory:

```powershell
# Navigate to the mobile directory
cd d:\Ragav\projects\codebase\password-manager\mobile

# Install dependencies (if not already installed)
npm install
```

### Step 6: Verify Emulator is Connected

In a new PowerShell window, run:

```powershell
# Check if emulator is detected
adb devices
```

You should see something like:
```
List of devices attached
emulator-5554    device
```

If you see "device" (not "offline"), you're good to go!

### Step 7: Run the App on the Simulator

#### Method 1: Using Expo (Recommended for Development)

Make sure your Android emulator is running, then:

```powershell
# Make sure you're in the mobile directory
cd d:\Ragav\projects\codebase\password-manager\mobile

# Start the Expo development server
npm start
```

Then:
- Press **`a`** in the terminal to open on Android emulator
- OR scan the QR code if using Expo Go (not needed for simulator)

The app will build and install on your emulator automatically!

#### Method 2: Direct Android Run

```powershell
# Make sure you're in the mobile directory
cd d:\Ragav\projects\codebase\password-manager\mobile

# Build and run directly on Android
npm run android
# OR
npx expo run:android
```

This will:
1. Build the Android app
2. Install it on the running emulator
3. Launch the app automatically

**Note**: First build takes 5-10 minutes (downloads dependencies). Subsequent builds are faster.

### Step 8: Testing Your App

Once the app launches on the simulator:

1. **First Run Setup**: Follow any setup wizard that appears
2. **Test Features**: 
   - Create an account or login
   - Add passwords
   - Test sync functionality
   - Try different screens

### Useful Simulator Tips

- **Rotate Device**: `Ctrl + F11` or `Ctrl + F12`
- **Go Back**: `Esc` key
- **Home**: `Home` key
- **Menu**: `Ctrl + M` or `Cmd + M`
- **Zoom**: `Ctrl + Plus/Minus`
- **Swipe**: Click and drag

---

## APK Transfer Guide

After building the APK, here are several easy ways to get it on your phone.

### Method 1: QR Code Download (Easiest) ⭐ RECOMMENDED

**Best for**: Quick testing, no cables needed

1. **After build completes**, EAS will show a download link
2. **Copy the download URL** from the terminal
3. **Generate QR code**:
   - Go to https://qr-code-generator.com or any QR generator
   - Paste the download URL
   - Generate QR code
4. **On your phone**:
   - Open camera app or QR scanner
   - Scan the QR code
   - It will open the download link in browser
   - Download and install the APK

**OR** - EAS Build page shows a QR code automatically:
- Go to https://expo.dev/accounts/[your-account]/builds
- Find your build
- Scan the QR code shown there

### Method 2: Google Drive / Cloud Storage (Very Easy)

**Best for**: Sharing with multiple devices or testers

1. **After build completes**, download the APK to your laptop
2. **Upload to Google Drive**:
   - Go to drive.google.com
   - Upload the APK file
   - Right-click → Get link → Make it accessible to anyone with link
3. **On your phone**:
   - Open Google Drive app (or browser)
   - Open the shared file
   - Download the APK
   - Install it

**Alternative cloud services**: Dropbox, OneDrive, WeTransfer

### Method 3: Email to Yourself (Easy)

**Best for**: Simple one-time transfer

1. **After build completes**, download the APK to your laptop
2. **Email it to yourself**:
   - Attach the APK file to an email
   - Send to your own email address
3. **On your phone**:
   - Open email app
   - Download the attachment
   - Install the APK

**Note**: Some email providers have file size limits (~25MB). APKs are usually 50-100MB, so this might not work.

### Method 4: USB Cable (Reliable)

**Best for**: Large files, reliable transfer

1. **Connect phone to laptop** with USB cable
2. **Enable File Transfer mode** on phone:
   - When connected, pull down notification panel
   - Tap "USB" or "Charging this device"
   - Select "File Transfer" or "MTP"
3. **On laptop**:
   - Open File Explorer (Windows) or Finder (Mac)
   - Your phone should appear as a drive
   - Copy the APK file to your phone's Download folder
4. **On phone**:
   - Open File Manager
   - Go to Download folder
   - Tap the APK file to install

### Method 5: ADB Install (For Developers)

**Best for**: If you have Android SDK/ADB installed

1. **Connect phone via USB** with USB debugging enabled
2. **On laptop**, run:
   ```bash
   adb install path/to/your-app.apk
   ```

---

## Local Build Setup

### Why Local Build?

- ✅ **No build limits** - Build as many times as you want
- ✅ **Faster** - No queue waiting
- ✅ **Free** - No usage restrictions
- ✅ **Better for development** - Quick iteration

### Prerequisites

1. **Android Studio** installed
2. **Android SDK** configured
3. **Environment variables** set

### Step-by-Step Setup

1. Install Android Studio (see Android SDK Setup section)
2. Install Required SDK Components (see Android SDK Setup section)
3. Find Your SDK Path (see Android SDK Setup section)
4. Set Environment Variables (see Android SDK Setup section)
5. Verify Setup (see Android SDK Setup section)
6. Install Java JDK (if not installed)
7. Prebuild Android Project:
   ```bash
   cd mobile
   npx expo prebuild
   ```
8. Build APK Locally:
   ```bash
   # Debug APK (for testing)
   npx expo run:android
   
   # Or build APK directly
   cd android
   .\gradlew assembleDebug
   
   # APK location:
   # android\app\build\outputs\apk\debug\app-debug.apk
   ```

### Quick Commands Reference

```bash
# Prebuild (first time only, or after major changes)
npx expo prebuild

# Build and install on device/emulator
npx expo run:android

# Build APK only (without installing)
cd android
.\gradlew assembleDebug

# Build Release APK (signed)
.\gradlew assembleRelease
```

---

## Build Checklist

Use this checklist before running `npm run build:android` to ensure your build succeeds.

### Configuration Checks

#### 1. **app.json Configuration**
- ✅ **App Name**: "KeyVault Pro" ✓
- ✅ **Slug**: "mobile" ✓
- ✅ **Version**: "1.0.0" ✓
- ✅ **Android Package**: "com.veni.keyvault" ✓
- ✅ **Project ID**: "e9a1da51-f4d8-4391-bfb3-e7b9dcf5eccb" ✓
- ✅ **Icon Path**: "./assets/icon.png" (verify file exists)
- ✅ **Splash Image**: "./assets/splash-icon.png" (verify file exists)
- ✅ **Adaptive Icon**: "./assets/adaptive-icon.png" (verify file exists)

#### 2. **eas.json Configuration**
- ✅ **CLI Version**: ">= 10.0.0" ✓
- ✅ **Preview Profile**: Configured for APK build ✓
- ✅ **Production Profile**: Configured ✓

#### 3. **Dependencies**
- ✅ All dependencies installed (`npm install` completed)
- ✅ No missing peer dependencies
- ✅ Expo SDK version: ~54.0.25 ✓
- ✅ React Native version: 0.81.5 ✓

### Asset Files Verification

Run these commands to verify assets exist:

```bash
cd mobile
# Check if all required assets exist
ls assets/icon.png
ls assets/splash-icon.png
ls assets/adaptive-icon.png
ls assets/favicon.png
```

**Required Assets:**
- ✅ `assets/icon.png` (1024x1024px recommended)
- ✅ `assets/splash-icon.png` (1284x2778px recommended)
- ✅ `assets/adaptive-icon.png` (1024x1024px recommended)
- ✅ `assets/favicon.png` (for web)

### Code Quality Checks

1. **Syntax Errors**: Run `npm start` and check console
2. **Import Errors**: Verify all imports resolve correctly
3. **Critical Files**: Ensure all required files exist

### Firebase Configuration

1. **google-services.json**: File exists at `mobile/google-services.json`
2. **firebase.config.js**: Firebase config is properly initialized

### Dependency Conflict Fix

✅ React 19 Compatibility Issue - RESOLVED
- `react-test-renderer@19.1.0` is now correctly installed (matches React 19.1.0)
- `.npmrc` file created with `legacy-peer-deps=true` to handle any remaining conflicts
- `eas.json` updated with npm config for builds
- `package-lock.json` has correct versions locked

---

## Build Fix Summary

### Problem from Previous Build

Your previous build failed with this error:
```
ERESOLVE could not resolve dependency
Found: react@19.1.0
While resolving: react-test-renderer@18.3.1
Conflicting peer dependency: react@18.3.1
```

**Root Cause**: 
- Your project uses React 19.1.0
- Testing libraries (`jest-expo`, `@testing-library/react-native`) were trying to install `react-test-renderer@18.3.1`
- This created a peer dependency conflict that `npm ci` couldn't resolve

### What Was Fixed

1. **Dependency Resolution** ✅
   - **Before**: `react-test-renderer@18.3.1` (incompatible with React 19)
   - **After**: `react-test-renderer@19.1.0` (matches React 19.1.0)
   - **Status**: ✅ Correctly installed and locked in `package-lock.json`

2. **Created `.npmrc` File** ✅
   Created `mobile/.npmrc` with:
   ```
   legacy-peer-deps=true
   ```
   This tells npm to use legacy peer dependency resolution, which is more lenient with peer dependency conflicts.

3. **Updated `eas.json`** ✅
   Added npm configuration to build profiles:
   ```json
   "env": {
       "NPM_CONFIG_LEGACY_PEER_DEPS": "true"
   }
   ```
   This ensures EAS Build uses the same npm settings.

### Current Dependency Status

| Package | Version | Status |
|---------|---------|--------|
| `react` | 19.1.0 | ✅ |
| `react-dom` | 19.1.0 | ✅ |
| `react-test-renderer` | 19.1.0 | ✅ **FIXED** |
| `jest-expo` | 54.0.13 | ✅ Compatible |
| `@testing-library/react-native` | 12.9.0 | ✅ Compatible |

### Why `.npmrc` is Required

The `.npmrc` file with `legacy-peer-deps=true` is a **safety net** to prevent EAS Build from failing due to strict peer dependency checks. It might not be strictly necessary now, but it's recommended for React 19 projects.

**What it does:**
- Tells npm to use legacy peer dependency resolution algorithm
- Allows installation even if peer dependencies have minor mismatches
- Only fails if there are actual runtime conflicts (not just warnings)
- Uses npm v6 behavior (more lenient) instead of npm v7+ (strict)

**Is it strictly necessary?** Probably not, since your dependencies are correct. But it's recommended because:
- ✅ Zero risk - prevents any potential issues
- ✅ Common practice for React 19 projects
- ✅ No downside - doesn't affect functionality
- ✅ Prevents future build failures

---

## Troubleshooting

### "ANDROID_HOME not found"

**Solution:**
1. Verify SDK path exists: `Test-Path C:\Users\<YourUsername>\AppData\Local\Android\Sdk`
2. Check environment variable: `echo $env:ANDROID_HOME`
3. If empty, set it again using GUI method (see Android SDK Setup)
4. **Restart your terminal** (very important!)

### "adb not recognized" after setting PATH

**Solution:**
1. Close ALL terminal windows
2. Open a NEW PowerShell window
3. Try `adb version` again

### "SDK location not found"

**Solution:**
1. Open Android Studio
2. Go to **Settings** → **Appearance & Behavior** → **System Settings** → **Android SDK**
3. Copy the exact path shown
4. Use that path for ANDROID_HOME

### Still not working?

**Alternative**: Use EAS cloud build instead:
```bash
cd mobile
npm run build:android
```
This builds in the cloud, no local SDK needed!

### "Can't install APK" error
- **Enable Unknown Sources**: Settings → Security → Unknown Sources (enable)
- **Or**: When installing, tap "Settings" in the prompt and enable

### "APK not downloading"
- Check internet connection on phone
- Try different browser
- Try Google Drive method instead

### "Build taking too long"
- First build: 10-15 minutes (normal)
- Subsequent builds: 5-10 minutes
- Check EAS build status at expo.dev

### Web Testing Issues

**Issue: Nothing happens when loading `http://localhost:8081/`**

**Solution:**
1. Make sure you ran `npm start` in the `mobile` directory
2. Wait for the server to start (you'll see "Metro waiting on...")
3. Press `w` in the terminal, or use the URL shown in terminal
4. The correct URL format is usually: `http://localhost:8081/` or `http://localhost:19006/`

**Web Version Limitations:**
- ❌ Can't test native features (camera, secure storage, etc.)
- ❌ Offline detection might not work the same way
- ❌ Some features may behave differently
- ✅ Good for UI/UX testing
- ✅ Good for basic functionality

**Note**: Your password manager uses native features (SQLite, SecureStore), so web version will have limited functionality. For offline testing, use a real Android device or emulator.

---

## Quick Reference

### Setup Checklist

- [ ] Android Studio installed
- [ ] ANDROID_HOME environment variable set
- [ ] PATH includes platform-tools
- [ ] Restarted terminal/PowerShell
- [ ] Verified with `adb version`
- [ ] SDK components installed in Android Studio

### Pro Tips

1. **Bookmark EAS builds page**: https://expo.dev/accounts/[your-account]/builds
   - Easy to access all your builds
   - QR codes for each build
   - Download links

2. **Use same WiFi**: If transferring via network, ensure phone and laptop on same network

3. **Keep APK**: Save the APK file for future testing or sharing

4. **Test on multiple devices**: Install on different phones to test compatibility

5. **First build takes 10-15 minutes** (downloads dependencies)
6. **Subsequent builds are faster** (2-5 minutes)
7. **Keep Android Studio closed** during builds (frees resources)
8. **Use emulator or connect device** before building
9. **Clean build if issues**: `cd android && .\gradlew clean`

---

**Last Updated**: 2025-12-02
