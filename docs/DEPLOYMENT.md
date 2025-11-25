# 🚀 Deployment Guide

This guide covers setup, development, testing, and deployment of the Password Manager application.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Google Apps Script Setup](#google-apps-script-setup)
- [Running the App](#running-the-app)
- [Building for Android](#building-for-android)
- [Publishing to Google Play Store](#publishing-to-google-play-store)
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

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it "Password Manager" (or any name you prefer)
4. Add headers in the first row:
   ```
   ID | SiteName | Username | Password | LastModified | Comments
   ```

### Step 2: Set Up Apps Script

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
