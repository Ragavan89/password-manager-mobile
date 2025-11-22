# 🔐 Password Manager

A secure, offline-first password manager built with React Native and Google Sheets as the backend. Features end-to-end encryption, automatic cloud sync, and works seamlessly across iOS, Android, and Web platforms.

## ✨ Features

- 🔒 **End-to-End Encryption** - All passwords encrypted with AES-256 before storage
- 📱 **Cross-Platform** - Works on iOS, Android, and Web
- 🌐 **Offline-First** - Full functionality without internet connection
- ☁️ **Cloud Sync** - Automatic synchronization with Google Sheets
- 🔄 **Smart Sync** - Syncs only when needed (app start, network change, after edits)
- 💾 **Local Storage** - SQLite on mobile, localStorage on web
- 📝 **Comments & Metadata** - Add notes and track last modified timestamps
- 🎨 **Modern UI** - Clean, intuitive interface with password visibility toggle

## 📋 Table of Contents

- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
- [Google Apps Script Setup](#google-apps-script-setup)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Security](#security)
- [Development](#development)

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
    └────┬───┴────┐
         │        │
    ┌────▼────┐   │
    │ Encrypt │   │
    └────┬────┘   │
         │        │
    ┌────▼────────▼───┐
    │  Google Apps    │
    │     Script      │
    └────┬────────────┘
         │
    ┌────▼────────┐
    │   Google    │
    │   Sheets    │
    └─────────────┘
```

## 🚀 Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Google Account (for Google Sheets backend)

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd password-manager
```

### 2. Install Dependencies

```bash
cd mobile
npm install
```

### 3. Google Apps Script Setup

See [Google Apps Script Setup](#google-apps-script-setup) section below.

### 4. Configure the App

On first launch, the app will guide you through:
1. Creating a Google Sheet
2. Setting up the Google Apps Script
3. Entering the Web App URL

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
3. Copy the entire contents of `google_apps_script.js` from this repository
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

### Development Mode

```bash
cd mobile
npm start
```

This will start the Expo development server. You can then:
- Press `w` to open in web browser
- Press `a` to open in Android emulator
- Press `i` to open in iOS simulator
- Scan QR code with Expo Go app on your phone

### Build for Production

#### Android APK
```bash
expo build:android
```

#### iOS IPA
```bash
expo build:ios
```

## 📁 Project Structure

```
password-manager/
├── google_apps_script.js          # Backend API (Google Apps Script)
├── mobile/
│   ├── App.js                     # Main app entry point
│   ├── src/
│   │   ├── screens/               # UI screens
│   │   │   ├── LoginScreen.js     # PIN authentication
│   │   │   ├── HomeScreen.js      # Password list & management
│   │   │   ├── AddPasswordScreen.js  # Add/Edit passwords
│   │   │   ├── SettingsScreen.js  # App settings
│   │   │   └── SetupGuideScreen.js   # First-time setup
│   │   └── services/              # Business logic
│   │       ├── Database.js        # Local SQLite/localStorage
│   │       ├── SyncService.js     # Offline sync & queue
│   │       ├── SheetsApi.js       # Google Sheets API client
│   │       └── Encryption.js      # AES-256 encryption
│   ├── package.json
│   └── app.json
└── README.md
```

## 🔄 How It Works

### Offline-First Architecture

1. **Local Storage**: All passwords are stored locally (SQLite on mobile, localStorage on web)
2. **Sync Queue**: When offline, operations (add/edit/delete) are queued
3. **Auto Sync**: When online, the queue is automatically processed
4. **Bidirectional Sync**: Changes are pushed to cloud and latest data is pulled

### Sync Triggers

Sync happens automatically when:
- ✅ App starts
- ✅ Network reconnects (offline → online)
- ✅ After adding/editing/deleting a password
- ✅ Manual sync button is pressed

Sync does **NOT** happen:
- ❌ On a timer/schedule
- ❌ When just viewing passwords
- ❌ When switching screens

### Data Flow

#### Adding a Password
```
User Input → Encrypt → Save to Local DB → Add to Sync Queue → Sync to Cloud
```

#### Syncing
```
Check Network → Process Queue (Push) → Pull Latest Data → Update Local DB
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
3. **Backend Changes**: Update `google_apps_script.js` and redeploy

### Debugging

- **Console Logs**: Check Expo DevTools console
- **Network**: Monitor sync logs in console
- **Database**: Use `console.log(getPasswords())` to view local data
- **Sync Queue**: Check `AsyncStorage` for `@sync_queue`

## 📝 API Reference

### Google Apps Script Endpoints

#### GET - Fetch All Passwords
```
GET {WEB_APP_URL}
Response: [
  {
    id: "1",
    siteName: "Example",
    username: "user@example.com",
    encryptedPassword: "...",
    lastModified: "2025-01-22T10:00:00.000Z",
    comments: "My notes"
  }
]
```

#### POST - Add Password
```
POST {WEB_APP_URL}
Body: {
  action: "add",
  siteName: "Example",
  username: "user@example.com",
  password: "encrypted_password",
  lastModified: "2025-01-22T10:00:00.000Z",
  comments: "My notes"
}
```

#### POST - Edit Password
```
POST {WEB_APP_URL}
Body: {
  action: "edit",
  id: "1",
  siteName: "Example",
  username: "user@example.com",
  password: "encrypted_password",
  lastModified: "2025-01-22T10:00:00.000Z",
  comments: "Updated notes"
}
```

#### POST - Delete Password
```
POST {WEB_APP_URL}
Body: {
  action: "delete",
  id: "1"
}
```

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- React Native community
- Expo team
- Google Apps Script platform

## 📞 Support

For issues or questions:
1. Check existing issues
2. Create a new issue with detailed description
3. Include error logs and steps to reproduce

---

**⚠️ Important**: This is a personal password manager. Always keep backups of your passwords and ensure your Google Account is secure with 2FA enabled.
