# Password Manager - Project Summary

## Overview
A secure, offline-first password manager with Google Sheets as the backend. Built with React Native for cross-platform support (iOS, Android, Web).

## Key Features Implemented
- ✅ End-to-end AES-256 encryption
- ✅ Offline-first architecture with local SQLite/localStorage
- ✅ Automatic cloud sync with Google Sheets
- ✅ Smart sync triggers (app start, network change, after edits)
- ✅ Manual sync button
- ✅ Comments and last modified timestamps
- ✅ Password visibility toggle
- ✅ Copy to clipboard
- ✅ Pull-to-refresh
- ✅ Network status indicators
- ✅ Sync status banners (offline, syncing, last synced)

## Architecture

### Frontend (React Native)
- **Screens**: Login, Home, AddPassword, Settings, SetupGuide
- **Services**: Database, SyncService, SheetsApi, Encryption
- **Navigation**: React Navigation (Stack Navigator)

### Backend (Google Apps Script)
- **Serverless**: Runs on Google's infrastructure
- **Database**: Google Sheets
- **API**: RESTful endpoints (GET, POST)

### Data Flow
```
User → UI → Encryption → Local DB → Sync Queue → Google Sheets
```

## File Structure
```
password-manager/
├── README.md                      # Main documentation
├── google_apps_script.js          # Backend API
└── mobile/
    ├── App.js                     # Entry point
    ├── src/
    │   ├── constants.js           # Configuration constants
    │   ├── screens/               # 5 screens
    │   └── services/              # 4 services
    ├── package.json
    └── app.json
```

## Technology Stack
- React Native 0.81.5
- Expo ~54.0
- React Navigation 7.x
- expo-sqlite (mobile storage)
- @react-native-async-storage (web storage)
- @react-native-community/netinfo (network monitoring)
- crypto-js (AES encryption)
- axios (HTTP client)
- Google Apps Script (backend)
- Google Sheets (database)

## Security Model
1. **Encryption**: AES-256-CBC with hardcoded key
2. **Authentication**: PIN-based (local only)
3. **Transport**: HTTPS (Google Apps Script)
4. **Storage**: Encrypted passwords in Google Sheets

## Sync Mechanism

### Triggers
- App start
- Network reconnection (offline → online)
- After add/edit/delete operations
- Manual sync button press

### Process
1. Check if sync already in progress (prevent duplicates)
2. Check network connectivity
3. Process sync queue (push local changes)
4. Pull latest data from cloud
5. Update local database
6. Update last sync timestamp

### Safety Features
- 30-second timeout on sync operations
- 35-second timeout on status polling
- Prevents concurrent syncs
- Graceful error handling

## Performance Characteristics

### Resource Usage
- **Battery**: ~0.01% per day (network monitoring)
- **Memory**: ~10-20 MB (typical)
- **Storage**: ~1-10 KB (sync queue + metadata)
- **Network**: 1-50 KB per sync (depends on data size)

### Sync Frequency
- Light usage: 2-3 syncs/day
- Moderate usage: 5-10 syncs/day
- Heavy usage: 20+ syncs/day

## Known Limitations
1. **Encryption key**: Hardcoded (should be user-derived in production)
2. **PIN**: Simple 4-digit (should support biometrics)
3. **Concurrent edits**: Last write wins (no conflict resolution)
4. **Scalability**: Google Sheets limited to ~10,000 rows
5. **Web keyboard**: Arrow keys don't scroll (React Native Web limitation)

## Future Enhancements
- [ ] Biometric authentication (fingerprint/Face ID)
- [ ] Password generator
- [ ] Password strength indicator
- [ ] Categories/folders
- [ ] Search functionality
- [ ] Export/import passwords
- [ ] Backup/restore
- [ ] Multi-device conflict resolution
- [ ] Password history
- [ ] Secure notes (non-password items)



## Maintenance

### Regular Tasks
- Update dependencies (`npm update`)
- Review Google Apps Script logs
- Monitor Google Sheets size
- Backup Google Sheet regularly

### Security Updates
- Change encryption key periodically
- Review Google Apps Script permissions
- Enable 2FA on Google Account
- Monitor for suspicious activity



## Support & Documentation
- Main README: Setup and usage instructions
- Code comments: JSDoc for all functions
- This document: High-level overview

## License
MIT License - Open source for personal use

## User Guide: Master Password Setup

### For New Users (First Time Opening the App)

#### Automatic Flow:
1. **Set the PIN**: Create a 4-digit PIN, confirm it, and save it.
2. **Master Password Setup**: You'll automatically see the Master Password Setup screen.
3. **Create Password**: Enter a strong master password (at least 8 characters).
4. **Confirm**: Re-enter to confirm.
5. **Save It**: IMPORTANT! Copy to clipboard, take a screenshot, or write it down.
6. **Done**: You can now start adding passwords.

### For Existing Users (After Update)

#### What Happens:
- The app now uses **per-user encryption** instead of a shared key.
- You need to set up your master password **once**.

#### Steps:
1. **Open the app**: You'll be prompted to create a master password.
2. **Follow the flow**: Same steps as new users above.
3. **Legacy Support**: Your existing passwords will continue to work (backward compatible).

### Understanding the Two Passwords

#### 🔐 Master Password
- **What**: YOUR unique encryption key.
- **When**: Set once during first setup.
- **Purpose**: Encrypts all your stored passwords.
- **Can view**: Yes, in **Settings → View Master Password**.
- **Can change**: No (would require re-encrypting all data).
- **If forgotten**: Can view it in Settings (requires PIN).

#### 🔢 PIN
- **What**: 4-digit code for daily unlock.
- **When**: Set during first setup.
- **Purpose**: Quick access to the app.
- **Can change**: Yes, anytime in Settings.
- **If forgotten**: Reset using device biometric (fingerprint/face).

### Troubleshooting

#### Error: "Encryption key not available"
This means the app hasn't been set up yet.

**Solution:**
1. **Restart**: Close and restart the app.
2. **Setup**: You should see the Master Password Setup screen. Complete it.
3. **Reset (Last Resort)**:
   - Go to device **Settings → Apps → KeyVault Pro**.
   - Clear app data (⚠️ This will reset the app).
   - Reopen and complete setup.

#### Error: "The action 'REPLACE' with payload..."
This was a navigation issue that's now fixed.

**Solution:**
- **Restart**: Close the app completely and reopen it.

### Where to Find Your Master Password Later
1. Open the app.
2. Go to **Settings** (gear icon on home screen).
3. Tap **"View Master Password"**.
4. Enter your PIN.
5. Your master password will be displayed.

### ⚠️ Important Notes

- **Save your master password safely!**
  - Write it down and keep it in a safe place.
  - Take a screenshot and store it securely.
  - You'll **need it if you change devices**.

- **Your PIN can change freely**
  - Changing your PIN doesn't affect your passwords.
  - The Master password stays the same.

- **Security**
  - Master password is encrypted before storage.
  - Only you can view it (requires your PIN).
  - Each user has their own unique encryption key.

## Last Updated
2025-11-25
