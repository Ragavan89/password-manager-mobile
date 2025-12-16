# Deployment and Build Guide

This comprehensive guide outlines the procedures for setting up the development environment, running the application locally, building artifacts for Android, and deploying to the Google Play Store.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Environment Setup](#development-environment-setup)
3. [Backend Configuration](#backend-configuration)
4. [Running the Application](#running-the-application)
5. [Build Procedures](#build-procedures)
6. [Google Play Console Deployment](#google-play-console-deployment)
7. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## 🛠️ Prerequisites

Ensure the following tools and accounts are prepared before initiating the development or deployment process:

*   **Node.js**: Version 14 or higher (LTS recommended).
*   **Package Managers**: `npm` (bundled with Node.js).
*   **Expo CLI**: Install globally via `npm install -g expo-cli`.
*   **EAS CLI**: Install globally via `npm install -g eas-cli`.
*   **Mobile Testing**: Expo Go app installed on a physical Android/iOS device.
*   **Accounts**:
    *   **Expo Account**: Log in via terminal using `eas login`.
    *   **Google Account**: Required for Google Sheets backend and Play Store Console.

---

## ⚙️ Development Environment Setup

To run the application locally or build native binaries, the Android SDK must be properly configured.

### Android SDK Configuration

1.  **Install Android Studio**: Download from the [official website](https://developer.android.com/studio) and install with default settings.
2.  **Install SDK Components**:
    *   Open Android Studio → **More Actions** → **SDK Manager**.
    *   **SDK Platforms**: Select Android 13 (API 33) or Android 14 (API 34).
    *   **SDK Tools**: Ensure the following are installed:
        *   Android SDK Build-Tools
        *   Android SDK Platform-Tools
        *   Android SDK Command-line Tools
        *   Android Emulator
3.  **Configure Environment Variables**:
    *   Set `ANDROID_HOME` to your SDK location (typically `C:\Users\<User>\AppData\Local\Android\Sdk`).
    *   Add the following to your system `PATH`:
        *   `%ANDROID_HOME%\platform-tools`
        *   `%ANDROID_HOME%\tools`
        *   `%ANDROID_HOME%\tools\bin`

### Android Emulator Setup

For testing without a physical device:
1.  Open **Device Manager** in Android Studio.
2.  Create a new virtual device (e.g., Pixel 6).
3.  Select the system image matching your SDK API level (e.g., API 33).
4.  Launch the emulator via the **Play** button.

---

## ☁️ Backend Configuration

The application utilizes Google Sheets as a database and Google Apps Script as the API layer.

### 1. Database Setup (Google Sheets)
*   **Template Method (Recommended)**: Make a copy of the [Password Manager Template](https://docs.google.com/spreadsheets/d/115IizwRB6BFuIKbWIFeuKsAEtIhm3ON50RRGv3sRIu8/copy).
*   **Manual Method**: Create a new Google Sheet with the following headers in the first row:
    `ID | SiteName | Username | Password | LastModified | Comments`

### 2. API Deployment (Apps Script)
1.  In your Google Sheet, navigate to **Extensions** → **Apps Script**.
2.  Replace the default code with the contents of `docs/google_apps_script.js`.
3.  Save the project.
4.  Deploy as a Web App:
    *   **Deploy** → **New deployment** → **Web app**.
    *   **Execute as**: Me.
    *   **Who has access**: Anyone.
5.  **Important**: Copy the generated Web App URL for use in the mobile application.

---

## 🏃 Running the Application

### Local Development Loop
To run the application in development mode with hot-reloading:

```bash
cd mobile
npm start
```

*   **Physical Device**: Scan the QR code using the Expo Go app.
*   **Emulator**: Press `a` in the terminal to launch on the connected Android emulator.

---

## 📦 Build Procedures

### 1. Development/Internal Build (APK)
Generates a standalone `.apk` file for manual testing on Android devices. This build is universal and works on most architectures.

```bash
npm run build:android
```
*   **Artifact**: Universal APK (~70MB).
*   **Use Case**: Manual distribution to testers via direct download or USB.

### 2. Production Build (AAB)
Generates an optimized Android App Bundle (`.aab`) required for Google Play Store submission.

```bash
npm run build:prod
```
*   **Artifact**: Android App Bundle (~20MB).
*   **Use Case**: Upload to Google Play Console for release.

### 3. Local Native Build
For building binaries directly on your machine without using EAS Cloud services (requires configured Android SDK):

```bash
# Prebuild config
npx expo prebuild

# Build Debug APK locally
cd android && ./gradlew assembleDebug
```
*   **Output**: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🚀 Google Play Console Deployment

### 1. Initial Setup
1.  Create a developer account at [Google Play Console](https://play.google.com/console).
2.  Create a new app entity (Type: App, Free).
3.  Complete the **Store Listing**:
    *   **Assets**: App Icon (512x512), Feature Graphic (1024x500), Phone Screenshots.
    *   **Privacy Policy**: Provide a valid URL.
    *   **Data Safety Form**: Declare data encryption practices.

### 2. Release Management
1.  **Internal Testing Track**:
    *   Create a new release.
    *   Upload the `.aab` file generated from `npm run build:prod`.
    *   Add tester emails.
    *   Testers download via the specific opt-in link.
2.  **Production Track**:
    *   Promote the release from Internal Testing -> Production.
    *   Submit for Google Review (typically 1-7 days for first review).

### Release Lifecycle
*   **Development**: `npm run build:android` -> Test APK locally.
*   **Staging**: `npm run build:prod` -> Upload to Internal Testing Track -> QA Team verifies.
*   **Production**: Promote Internal Release -> Production -> Public availability.

---

## 🔧 Troubleshooting & FAQ

### Common Build Issues

#### Failed to resolve Android SDK path
*   **Cause**: `ANDROID_HOME` is not set or incorrect.
*   **Fix**: Verify the path using `echo $env:ANDROID_HOME` in PowerShell. Restart the terminal after setting environment variables.

#### Network Error During Sync
*   **Cause**: Device offline or Google Script blocked.
*   **Fix**: Check internet connection. Verify the Web App URL in settings is correct and the Apps Script deployment permissions are set to "Anyone".

### Build Fix Summary (Recent)
*   **React 19 Compatibility**: Fixed peer dependency conflicts in test renderers.
*   **ProGuard Rules**: Optimized for Expo managed workflow to reduce AAB size.
*   **Asset Generation**: Fixed adaptive icon generation for Android 13+.

---

## 📝 Build Checklist
Before triggering a production build, verify:
*   [ ] `app.json`: Version code and version number are incremented.
*   [ ] `app.json`: Package name matches Google Play Console.
*   [ ] Assets: Icons and splash screens are correctly linked.
*   [ ] Functionality: Run full unit test suite (`npm test`).
*   [ ] Security: Ensure no secrets are hardcoded in the codebase (excluding public env vars).
