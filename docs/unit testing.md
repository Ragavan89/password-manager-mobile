# Unit Testing Guide and Manual Testing Scenarios

## Table of Contents

1. [Unit Testing Guide](#unit-testing-guide)
2. [Manual Testing Scenarios](#manual-testing-scenarios)
3. [Tombstone Deletion Logic](#tombstone-deletion-logic)
4. [Offline Testing Guide](#offline-testing-guide)
5. [Testing Checklist](#testing-checklist)
6. [Salt Creation Verification](#salt-creation-verification)

---

# Unit Testing Guide

## Running Tests

### Quick Start

```bash
cd d:\Ragav\projects\codebase\password-manager\mobile

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Run Specific Tests

```bash
# Specific test file
npm test -- Database.test.js

# Specific test suite
npm test -- -t "New Entry Tests"

# With verbose output
npm test -- --verbose
```

## Test Coverage

**Total Tests**: 545+ test cases across 6 test files

| Test File | Tests | Coverage |
|-----------|-------|----------|
| Database.test.js | 95 | Local storage CRUD operations |
| Encryption.test.js | 85 | PIN/password encryption |
| FirestoreService.test.js | 75 | Cloud storage operations |
| HybridStorageService.test.js | 120 | Sync and hybrid storage |
| HybridStorageService.edgecases.test.js | 60 | Edge cases and tombstones |
| SyncService.test.js | 110 | Offline queue management |

## Test Scenarios Covered

### ✅ Scenario 1: New Entry
- Add password successfully
- Handle missing fields
- Check storage limits
- Save to local and cloud

### ✅ Scenario 2: Edit Data and Save
- Update existing password
- Handle non-existent password
- Sync updates to cloud
- Validate data integrity

### ✅ Scenario 3: Local Storage
- Retrieve all passwords
- Handle database errors
- Initialize database
- Update sync status

### ✅ Scenario 4: Cloud Storage and Sync
- Save to Firestore
- Bidirectional sync
- Handle network errors
- Conflict resolution (Last-Write-Wins)

### ✅ Scenario 5: Limit Checks
- Fetch cloud password limit
- Allow save within limit
- Reject when limit exceeded
- Handle limit fetch errors

### ✅ Scenario 6: Sync After New Login
- Download passwords on new device
- Merge local and cloud data
- Handle sync conflicts
- Maintain data consistency

### ✅ Scenario 7: Device Switch Sync
- Download passwords on new device
- Merge existing data
- Handle missing cloud data

### ✅ Scenario 8: Delete in Offline and Sync
- Queue delete operation offline
- Process queue when online
- Sync delete operations
- Handle tombstones correctly

## Troubleshooting

### Tests Fail with "Cannot find module"
```bash
cd mobile
npm install
```

### Tests Timeout
Increase timeout in `package.json`:
```json
"jest": {
  "testTimeout": 10000
}
```

### Clear Jest Cache
```bash
npm test -- --clearCache
```

---

# Manual Testing Scenarios

## Positive Test Cases

### 1. New Password Entry

**Test Case ID**: TC-001  
**Priority**: High  
**Preconditions**: App installed and PIN set up

**Steps**:
1. Open app and enter PIN
2. Tap "Add New Password" button
3. Enter:
   - Site Name: "gmail.com"
   - Username: "test@gmail.com"
   - Password: "SecurePass123!"
   - Comments: "Personal email"
4. Tap "Save"

**Expected Result**:
- ✅ Password saved successfully
- ✅ Success message displayed
- ✅ Password appears in list
- ✅ Synced to cloud (if enabled)

---

### 2. Edit Existing Password

**Test Case ID**: TC-002  
**Priority**: High

**Steps**:
1. Open app
2. Tap on existing password entry
3. Tap "Edit" button
4. Modify username to "newemail@gmail.com"
5. Tap "Save"

**Expected Result**:
- ✅ Password updated successfully
- ✅ Changes reflected in list
- ✅ Synced to cloud

---

### 3. Delete Password

**Test Case ID**: TC-003  
**Priority**: High

**Steps**:
1. Open app
2. Long press on password entry
3. Tap "Delete"
4. Confirm deletion

**Expected Result**:
- ✅ Password deleted from list
- ✅ Deleted from cloud
- ✅ Cannot be recovered

---

### 4. Cloud Sync (Online)

**Test Case ID**: TC-004  
**Priority**: High  
**Preconditions**: Cloud sync enabled, internet connected

**Steps**:
1. Add 3 new passwords
2. Pull down to refresh
3. Observe sync status

**Expected Result**:
- ✅ "Syncing..." message shown
- ✅ "Last synced: just now" displayed
- ✅ All passwords synced to cloud

---

### 5. Offline Mode

**Test Case ID**: TC-005  
**Priority**: High

**Steps**:
1. Enable airplane mode
2. Add new password
3. Edit existing password
4. Delete a password
5. Disable airplane mode
6. Pull to refresh

**Expected Result**:
- ✅ All operations work offline
- ✅ Changes queued for sync
- ✅ Sync completes when online
- ✅ Deleted passwords removed from cloud

---

### 6. Device Switch

**Test Case ID**: TC-006  
**Priority**: High

**Steps**:
1. Device A: Add 5 passwords and sync
2. Device B: Install app, set up same account
3. Device B: Pull to refresh

**Expected Result**:
- ✅ All 5 passwords downloaded to Device B
- ✅ Data matches Device A exactly

---

### 7. Storage Limit

**Test Case ID**: TC-007  
**Priority**: Medium

**Steps**:
1. Add passwords until limit reached (default: 100)
2. Try to add one more password

**Expected Result**:
- ✅ Error message: "Storage limit reached"
- ✅ Password not saved
- ✅ Existing passwords unaffected

---

### 8. Search Functionality

**Test Case ID**: TC-008  
**Priority**: Medium

**Steps**:
1. Add 10 passwords with different site names
2. Tap search icon
3. Type "gmail"

**Expected Result**:
- ✅ Only "gmail.com" entries shown
- ✅ Search is case-insensitive
- ✅ Clear search shows all passwords

---

### 9. View Master Password

**Test Case ID**: TC-009  
**Priority**: High

**Steps**:
1. Go to Settings
2. Tap "View Master Password"
3. Enter PIN
4. View master password

**Expected Result**:
- ✅ PIN verification required
- ✅ Master password displayed
- ✅ Can copy to clipboard

---

### 10. Change PIN

**Test Case ID**: TC-010  
**Priority**: High

**Steps**:
1. Go to Settings
2. Tap "Change PIN"
3. Enter old PIN: "1234"
4. Enter new PIN: "5678"
5. Confirm new PIN: "5678"

**Expected Result**:
- ✅ PIN changed successfully
- ✅ Can login with new PIN
- ✅ Old PIN no longer works

---

## Negative Test Cases

### 11. Invalid PIN Entry

**Test Case ID**: TC-011  
**Priority**: High

**Steps**:
1. Open app
2. Enter wrong PIN 3 times

**Expected Result**:
- ❌ "Incorrect PIN" message shown
- ❌ Access denied
- ❌ App locked after 3 attempts

---

### 12. Empty Fields

**Test Case ID**: TC-012  
**Priority**: Medium

**Steps**:
1. Tap "Add New Password"
2. Leave all fields empty
3. Tap "Save"

**Expected Result**:
- ❌ Validation error shown
- ❌ "Site name required" message
- ❌ Password not saved

---

### 13. Duplicate Entry

**Test Case ID**: TC-013  
**Priority**: Low

**Steps**:
1. Add password for "gmail.com"
2. Add another password for "gmail.com" with same username

**Expected Result**:
- ✅ Both entries saved (allowed)
- ✅ Warning shown: "Similar entry exists"

---

### 14. Network Failure During Sync

**Test Case ID**: TC-014  
**Priority**: High

**Steps**:
1. Add 5 passwords
2. Start sync
3. Disable internet mid-sync

**Expected Result**:
- ❌ Sync fails gracefully
- ✅ Partial data saved
- ✅ Retry available
- ✅ No data loss

---

### 15. Exceed Storage Limit

**Test Case ID**: TC-015  
**Priority**: Medium

**Steps**:
1. Add 100 passwords (at limit)
2. Try to add 101st password

**Expected Result**:
- ❌ Error: "Storage limit reached (100/100)"
- ❌ Password not saved
- ✅ Suggestion to delete old passwords

---

## Edge Cases

### 16. Special Characters in Password

**Test Case ID**: TC-016  
**Priority**: Medium

**Steps**:
1. Add password with special chars: `!@#$%^&*()_+-=[]{}|;:'",.<>?/~`
2. Save and retrieve

**Expected Result**:
- ✅ All special characters preserved
- ✅ No encoding issues
- ✅ Can copy and paste correctly

---

### 17. Very Long Site Name

**Test Case ID**: TC-017  
**Priority**: Low

**Steps**:
1. Enter site name with 500 characters
2. Try to save

**Expected Result**:
- ✅ Truncated to max length
- ✅ Warning shown
- ✅ Password saved with truncated name

---

### 18. Rapid Consecutive Syncs

**Test Case ID**: TC-018  
**Priority**: Medium

**Steps**:
1. Pull to refresh
2. Immediately pull again
3. Pull again

**Expected Result**:
- ✅ All syncs complete
- ✅ No race conditions
- ✅ Data remains consistent

---

### 19. Delete While Offline, Add Same Site

**Test Case ID**: TC-019  
**Priority**: High

**Steps**:
1. Go offline
2. Delete "netflix.com" password
3. Add new "netflix.com" password (different credentials)
4. Go online and sync

**Expected Result**:
- ✅ Old password deleted from cloud
- ✅ New password uploaded to cloud
- ✅ Only new password exists

---

### 20. Concurrent Edits on Different Devices

**Test Case ID**: TC-020  
**Priority**: High

**Steps**:
1. Device A: Edit "gmail.com" password at 10:00 AM
2. Device B: Edit same "gmail.com" password at 10:01 AM
3. Both devices sync

**Expected Result**:
- ✅ Last-Write-Wins (Device B's version kept)
- ✅ Device A's changes overwritten
- ✅ No data corruption

---

# Tombstone Deletion Logic

## Overview

The app uses **tombstones** to track deleted passwords and ensure they're properly removed from cloud during sync, even when deleted offline.

## How It Works

### What is a Tombstone?

A tombstone is a marker that says "this password was deleted" instead of removing it immediately.

```
Normal Delete: Password → GONE (can't sync deletion)
Tombstone Delete: Password → MARKED AS DELETED → Sync → Remove from cloud → Remove marker
```

### Offline Delete Flow

```
1. User deletes password offline
   ↓
2. Password marked as deleted (isDeleted = 1)
   ↓
3. User comes online
   ↓
4. Sync detects tombstone
   ↓
5. Deletes from cloud
   ↓
6. Removes tombstone
   ↓
7. ✅ Deleted everywhere
```

### Your Exact Scenario

**Question**: "10 records synced → Go offline → Delete 2 → Sync → What happens?"

**Before Fix**: Deleted passwords restored from cloud ❌  
**After Fix**: Deleted passwords removed from cloud ✅

## Database Schema

```sql
CREATE TABLE passwords (
  id INTEGER PRIMARY KEY,
  siteName TEXT,
  username TEXT,
  encryptedPassword TEXT,
  lastModified TEXT,
  comments TEXT,
  isDeleted INTEGER DEFAULT 0,    -- Tombstone flag
  deletedAt TEXT                  -- When deleted
);
```

## Testing Tombstones

### Manual Test: Offline Delete → Sync

```
1. Add 5 passwords
2. Sync to cloud
3. Go offline (airplane mode)
4. Delete 2 passwords
5. Go online
6. Pull to refresh (sync)
7. Verify: Only 3 passwords remain (not 5)
```

### Manual Test: Delete → Add Same Site

```
1. Add "netflix.com" password
2. Delete "netflix.com"
3. Add "netflix.com" again (different password)
4. Sync
5. Verify: Only new netflix.com exists
```

## Cleanup

Tombstones are automatically cleaned up after **30 days** to prevent database bloat.

## Benefits

✅ Offline deletions work correctly  
✅ No data loss  
✅ No accidental restoration  
✅ Industry-standard approach  
✅ Backward compatible  

---

# Offline Testing Guide

Since Expo Go requires a network connection to the development server, you need a standalone build to test offline functionality.

## 🎯 Quick Answer

**Best Option**: Build a development build or preview APK, then install it on your device. This creates a standalone app that works completely offline.

## Option 1: Development Build (Recommended for Active Development)

A development build is like Expo Go but bundled with your app code, so it works offline and still supports hot reload.

### Prerequisites
- Android Studio installed (for Android)
- Xcode installed (for iOS - Mac only)
- USB debugging enabled on your device

### Steps

#### For Android:

1. **Build locally** (faster, no EAS account needed):
   ```bash
   cd mobile
   npx expo run:android
   ```
   - This will build and install directly to your connected device/emulator
   - Takes 5-10 minutes first time, then faster on subsequent builds
   - Works completely offline after installation

2. **Or build with EAS** (cloud build):
   ```bash
   cd mobile
   npx eas-cli build -p android --profile development
   ```
   - Downloads APK when complete
   - Install on your device

#### For iOS (Mac only):

```bash
cd mobile
npx expo run:ios
```

### Advantages:
- ✅ Works completely offline
- ✅ Hot reload still works (if connected to dev server)
- ✅ Fast iteration during development
- ✅ Can test all offline features

### How to Test Offline:

1. **Install the development build** on your device
2. **Open the app** (it will work offline)
3. **Enable Airplane Mode** or **Turn off WiFi/Mobile Data**
4. **Test offline functionality**:
   - Add new passwords
   - Update existing passwords
   - Delete passwords
   - Verify data is saved locally
5. **Turn on network** and verify sync works

## Option 2: Preview APK Build (Quick Testing)

Build a standalone APK that you can install and test offline.

### Steps:

1. **Build the APK**:
   ```bash
   cd mobile
   npm run build:android
   ```
   This uses the `preview` profile from `eas.json`

2. **Wait for build to complete** (5-15 minutes)
   - You'll get a download link in the terminal
   - Or check: https://expo.dev/accounts/[your-account]/builds

3. **Download the APK** to your phone

4. **Install the APK**:
   - Tap the downloaded file
   - Allow "Install from Unknown Sources" if prompted
   - Install and open

5. **Test offline**:
   - Turn on Airplane Mode
   - Test all offline features
   - Turn off Airplane Mode to test sync

### Advantages:
- ✅ Works completely offline
- ✅ No dev server needed
- ✅ Good for final testing before release
- ✅ Can share with testers

### Disadvantages:
- ❌ No hot reload (need to rebuild for changes)
- ❌ Slower iteration cycle

## Option 3: Use Android Emulator (Alternative)

If you have Android Studio installed, you can use an emulator and control network state.

### Steps:

1. **Start Android Emulator**:
   ```bash
   # From Android Studio, or:
   emulator -avd <your_avd_name>
   ```

2. **Run app on emulator**:
   ```bash
   cd mobile
   npm start
   # Press 'a' to open in Android emulator
   ```

3. **Control network in emulator**:
   - Open emulator settings
   - Go to Settings → Network & Internet
   - Toggle Airplane Mode on/off
   - Or use emulator controls to disable network

### Advantages:
- ✅ No need to build APK
- ✅ Can toggle network on/off easily
- ✅ Good for quick testing

### Disadvantages:
- ❌ Requires Android Studio
- ❌ Emulator can be slow
- ❌ Not testing on real device

## 🧪 Testing Checklist

Once you have a standalone build installed, test these scenarios:

### Offline Scenarios:
- [ ] **Add password offline**: Create new entry, verify it saves locally
- [ ] **Update password offline**: Edit existing entry, verify changes saved locally
- [ ] **Delete password offline**: Delete entry, verify tombstone created
- [ ] **View passwords offline**: Verify all entries are visible
- [ ] **Search offline**: Verify search works with local data

### Online Sync Scenarios:
- [ ] **Sync after offline add**: Turn on network, verify new password syncs to cloud
- [ ] **Sync after offline update**: Turn on network, verify updated password syncs
- [ ] **Sync after offline delete**: Turn on network, verify deletion syncs (tombstone processed)
- [ ] **Sync with limit reached**: Add passwords until limit, verify new ones stay local
- [ ] **Update synced password when limit reached**: Verify updates still work

### Edge Cases:
- [ ] **Add → Go offline → Update → Go online**: Verify both operations sync
- [ ] **Delete → Go offline → Add → Go online**: Verify deletion and addition both sync
- [ ] **Multiple offline operations**: Add/update/delete multiple entries offline, then sync

## 🚀 Quick Start Commands

```bash
# Development build (Android) - Recommended
cd mobile
npx expo run:android

# Preview APK build
cd mobile
npm run build:android

# Start dev server (for development builds with hot reload)
cd mobile
npm start
```

## 💡 Pro Tips

1. **For active development**: Use `expo run:android` - it's faster and supports hot reload
2. **For final testing**: Use `npm run build:android` - creates production-like build
3. **Test on real device**: Always test offline features on a real device, not just emulator
4. **Use airplane mode**: Easiest way to test offline - just toggle airplane mode on/off
5. **Check logs**: Use `adb logcat` or React Native Debugger to see sync logs

## 🔧 Troubleshooting

### "expo run:android" fails
- Make sure Android Studio is installed
- Check that `ANDROID_HOME` is set correctly
- Ensure USB debugging is enabled on your device

### APK won't install
- Check "Install from Unknown Sources" is enabled
- Try downloading APK directly to phone instead of transferring

### App crashes when offline
- Check that all network calls are wrapped in try-catch
- Verify NetInfo is checking connection before API calls
- Check console logs for errors

## 📝 Summary

| Method | Offline Support | Hot Reload | Build Time | Best For |
|--------|----------------|------------|------------|----------|
| Expo Go | ❌ No | ✅ Yes | Instant | Quick development |
| Development Build | ✅ Yes | ✅ Yes | 5-10 min | Active development |
| Preview APK | ✅ Yes | ❌ No | 5-15 min | Final testing |
| Emulator | ✅ Yes | ✅ Yes | Instant | Quick testing |

**Recommendation**: Use `expo run:android` for offline testing during development.

---

# Testing Checklist for Per-User Salt Implementation

## Pre-Testing Setup

1. ✅ **Verify all files are in place:**
   - `mobile/src/services/UserSaltService.js` - New file
   - `mobile/src/services/Encryption.js` - Updated
   - `mobile/src/services/HybridStorageService.js` - Updated
   - `mobile/src/screens/SetupMasterPasswordScreen.js` - Updated

2. ✅ **Check imports:**
   - All imports are correct
   - No circular dependencies
   - All required modules are available

3. ✅ **Build the app:**
   ```bash
   cd mobile
   npm install  # If needed
   npm start    # For development
   ```

## Test Scenarios

### Test 1: New User, Online Setup (Cloud Sync)
**Goal**: Verify salt is generated and saved to Firestore

**Steps**:
1. Create new Firebase account
2. Enable cloud sync
3. Set up master password (while online)
4. Create 2-3 password entries
5. Sync to cloud

**Expected Results**:
- ✅ Salt stored in Firestore: `users/{userId}/userSalt`
- ✅ Salt cached locally: `userSalt_{userId}`
- ✅ All entries encrypt/decrypt correctly
- ✅ Console shows: "✅ Generated and saved new user salt"

**Verify**:
- Check Firestore console: `users/{userId}` document should have `userSalt` field
- Check local SecureStore (via logs): Salt should be cached

---

### Test 2: New User, Offline Setup (Cloud Sync)
**Goal**: Verify temporary salt generation and sync

**Steps**:
1. Enable airplane mode
2. Create new Firebase account (if possible) OR use existing account
3. Set up master password (offline)
4. Create 2-3 password entries
5. Disable airplane mode
6. Sync to cloud

**Expected Results**:
- ✅ Temporary salt generated: `temp_user_salt`
- ✅ Entries encrypted with temporary salt
- ✅ When online, salt synced to Firestore
- ✅ Console shows: "⚠️ Generating temporary salt (offline, will sync later)"
- ✅ Console shows: "✅ Synced temporary salt to Firestore"

**Verify**:
- Check Firestore: Salt should be saved
- Check local SecureStore: Temporary salt should be cleared, permanent salt stored

---

### Test 3: Existing User, New Device, Online
**Goal**: Verify salt is fetched from Firestore

**Steps**:
1. On Device 1: Create 5 entries, sync to cloud
2. On Device 2: Log in with same account (online)
3. Set up master password (same as Device 1)
4. Sync to cloud

**Expected Results**:
- ✅ Salt fetched from Firestore (not generated)
- ✅ Can decrypt all 5 entries from Device 1
- ✅ Console shows: "✅ Fetched user salt from Firestore"
- ✅ All entries work correctly

**Verify**:
- Device 2 should see all 5 entries from Device 1
- All entries decrypt correctly
- Same salt used on both devices

---

### Test 4: Salt Conflict Resolution (CRITICAL)
**Goal**: Verify automatic re-encryption when salt conflicts

**Steps**:
1. **Device 1**: 
   - Create 3 entries
   - Sync to cloud
   - Note: Salt `salt1` is now in Firestore

2. **Device 2**:
   - Enable airplane mode
   - Log in with same account
   - Set up master password (offline) → Creates temporary salt `salt2`
   - Create 3 entries (encrypted with `salt2`)
   - Disable airplane mode
   - Sync to cloud

**Expected Results**:
- ✅ Salt conflict detected
- ✅ Local entries re-encrypted with cloud salt (`salt1`)
- ✅ All 6 entries (3 from Device 1 + 3 from Device 2) decrypt correctly
- ✅ Console shows: "⚠️ Salt conflict detected"
- ✅ Console shows: "🔄 Salt conflict detected, re-encrypting local entries..."
- ✅ Console shows: "✅ Re-encrypted 3 local passwords with cloud salt"

**Verify**:
- Device 2 should see all 6 entries
- All entries decrypt correctly
- Check logs: Re-encryption should complete successfully

---

### Test 5: Local-Only User (No Cloud Sync)
**Goal**: Verify local salt generation

**Steps**:
1. Don't enable cloud sync
2. Set up PIN and master password
3. Create 2-3 entries

**Expected Results**:
- ✅ Salt stored locally only: `userSalt_local`
- ✅ No salt in Firestore
- ✅ Entries encrypt/decrypt correctly
- ✅ Console shows: "✅ Generated local-only salt"

**Verify**:
- Check Firestore: No user document should exist
- Check local SecureStore: Salt should be stored locally

---

### Test 6: Master Password Setup - Online Requirement
**Goal**: Verify cloud sync users must be online for first setup

**Steps**:
1. Enable cloud sync
2. Enable airplane mode
3. Try to set up master password

**Expected Results**:
- ✅ Error message shown: "Internet connection required for first-time setup"
- ✅ Continue button disabled
- ✅ Cannot proceed without internet

**Verify**:
- UI shows error box
- Button is disabled
- Clear error message displayed

---

### Test 7: Re-Encryption Edge Cases
**Goal**: Verify re-encryption handles edge cases

**Steps**:
1. Create salt conflict scenario (Test 4)
2. Ensure some entries are already synced to cloud
3. Sync

**Expected Results**:
- ✅ Only local entries re-encrypted
- ✅ Cloud entries skipped (already correct)
- ✅ Console shows correct count

**Verify**:
- Check logs: Only unsynced entries should be re-encrypted
- Synced entries should be skipped

---

### Test 8: Multiple Devices, Sequential Setup
**Goal**: Verify salt consistency across multiple devices

**Steps**:
1. Device 1: Create entries, sync
2. Device 2: Log in, sync (should get salt from Device 1)
3. Device 3: Log in, sync (should get same salt)
4. Create entries on each device
5. Sync all devices

**Expected Results**:
- ✅ All devices use same salt
- ✅ All entries decrypt correctly on all devices
- ✅ No conflicts or re-encryption needed

**Verify**:
- All devices see all entries
- All entries decrypt correctly
- No salt conflicts

---

## Console Log Verification

### Expected Log Messages:

**Normal Flow:**
```
✅ Using cached user salt
✅ Fetched user salt from Firestore
✅ Generated and saved new user salt
```

**Offline Flow:**
```
⚠️ Generating temporary salt (offline, will sync later)
⚠️ Using temporary salt (offline mode)
✅ Synced temporary salt to Firestore
```

**Conflict Resolution:**
```
⚠️ Salt conflict detected: Cloud salt differs from local temporary salt
🔄 Will re-encrypt local entries with cloud salt
🔄 Salt conflict detected, re-encrypting local entries...
🔄 Starting password re-encryption with new salt...
✅ Re-encrypted X local passwords with cloud salt
✅ Re-encryption complete: X passwords re-encrypted, 0 failed
```

**Errors (should not appear in normal flow):**
```
❌ Failed to fetch salt from cloud
❌ Failed to re-encrypt passwords
```

---

## Firestore Verification

### Check Firestore Console:

1. **Navigate to**: `users/{userId}` document
2. **Verify fields**:
   - `userSalt`: Should exist (string, 64+ characters)
   - `createdAt`: Timestamp
   - `lastUpdated`: Timestamp

3. **For salt conflict test**:
   - Check that salt doesn't change after conflict resolution
   - Salt should remain the same (cloud salt is authoritative)

---

## SecureStore Verification

### Check Local Storage (via logs):

**Cloud Sync User:**
- `userSalt_{userId}`: Permanent salt
- `temp_user_salt`: Should NOT exist after sync
- `has_temp_salt`: Should NOT exist after sync

**Local-Only User:**
- `userSalt_local`: Permanent salt

**During Migration:**
- `old_salt_{userId}`: Temporary (should be cleared after migration)
- `new_salt_{userId}`: Temporary (should be cleared after migration)
- `SALT_MIGRATION_REQUIRED`: Should be cleared after migration

---

## Common Issues & Solutions

### Issue 1: "Failed to get user salt"
**Cause**: Network error or Firestore permission issue
**Solution**: Check internet connection, verify Firestore rules

### Issue 2: "Master password required for re-encryption"
**Cause**: Master password not found in SecureStore
**Solution**: Ensure master password was set up correctly

### Issue 3: "Migration salts not found"
**Cause**: Migration flags cleared before re-encryption
**Solution**: This shouldn't happen, but if it does, check sync flow

### Issue 4: Entries don't decrypt after sync
**Cause**: Salt conflict not resolved
**Solution**: Check logs for re-encryption errors, verify master password is correct

---

## Performance Checks

1. **Salt Fetch Time**: Should be < 1 second (cached) or < 3 seconds (from Firestore)
2. **Re-Encryption Time**: ~100-500ms per entry
3. **Sync Time**: Should not be significantly slower than before

---

## Regression Tests

Verify existing functionality still works:

1. ✅ PIN setup and login
2. ✅ Master password setup
3. ✅ Add/edit/delete passwords
4. ✅ Cloud sync (normal flow)
5. ✅ Offline mode
6. ✅ Multi-device sync

---

## Success Criteria

✅ All test scenarios pass
✅ No console errors
✅ All entries decrypt correctly
✅ Salt stored correctly in Firestore
✅ No data loss
✅ Performance acceptable
✅ User experience smooth

---

## Notes

- Test on both Android and iOS if possible
- Test with slow network connection
- Test with intermittent connectivity
- Monitor console logs during all tests
- Check Firestore console after each test

---

# Salt Creation Verification

## Issue: Salt Not Visible in Firestore

If you can't see the `userSalt` field in Firestore, here's how to verify and fix it.

## Step 1: Check Current Status

Add this temporary code to any screen (e.g., SettingsScreen) to check salt status:

```javascript
import { debugCheckSalt, forceCreateSalt } from '../services/UserSaltService';
import { getCurrentUser } from '../services/FirebaseAuthService';

// Add this function to your component
const checkAndCreateSalt = async () => {
    const user = getCurrentUser();
    if (!user?.uid) {
        Alert.alert('Error', 'User not logged in');
        return;
    }
    
    console.log('=== SALT DEBUG START ===');
    
    // Check current status
    const checkResult = await debugCheckSalt(user.uid);
    console.log('Check result:', checkResult);
    
    if (!checkResult.hasSalt) {
        Alert.alert(
            'Salt Missing',
            'Salt not found. Would you like to create it?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Create',
                    onPress: async () => {
                        const createResult = await forceCreateSalt(user.uid);
                        if (createResult.success) {
                            Alert.alert('Success', 'Salt created successfully!');
                        } else {
                            Alert.alert('Error', createResult.error);
                        }
                    }
                }
            ]
        );
    } else {
        Alert.alert('Salt Exists', 'Salt is already in Firestore');
    }
    
    console.log('=== SALT DEBUG END ===');
};
```

## Step 2: Check Console Logs

When you set up master password, look for these logs:

**Expected logs when salt is created:**
```
🔍 Checking Firestore for salt: users/{userId}
📝 User document does not exist in Firestore
🔄 Will create new document with salt
🆕 Generating new salt for user: {userId}
🔑 Generated salt (length: 64)
💾 Saving salt to Firestore: { path: 'users/{userId}', database: 'keyvault-pro-india' }
✅ Salt successfully saved to Firestore and verified
✅ Salt cached locally
✅ Generated and saved new user salt
```

**If document exists but salt is missing:**
```
🔍 Checking Firestore for salt: users/{userId}
📄 User document exists in Firestore
📋 Document fields: ['lastUpdated', ...]
⚠️ User document exists but userSalt field is missing
🔄 Will generate new salt and add to existing document
🆕 Generating new salt for user: {userId}
...
```

## Step 3: Verify Firestore Write

The code uses `setDoc` with `{ merge: true }`, which should:
- Create the document if it doesn't exist
- Add/update the `userSalt` field if document exists

**Check Firestore Console:**
1. Go to: `keyvault-pro-india` database
2. Navigate to: `users/{userId}`
3. Look for: `userSalt` field (should be a long string)

## Step 4: Common Issues & Solutions

### Issue 1: Document Exists But Salt Missing

**Cause**: User document was created before salt implementation

**Solution**: The code should automatically add salt to existing document. If not:
- Use `forceCreateSalt()` function
- Or trigger master password setup again

### Issue 2: Salt Not Saving (Error in Logs)

**Check for:**
- Firestore permissions (security rules)
- Network connectivity
- Database name mismatch

**Look for errors:**
```
❌ Error saving salt to Firestore: ...
Error code: permission-denied
```

### Issue 3: Salt Created But Not Visible

**Possible causes:**
- Looking at wrong database (check `keyvault-pro-india`)
- Cache issue (refresh Firestore console)
- Document not refreshed

**Solution**: 
- Refresh Firestore console
- Verify database name
- Check document directly

## Step 5: Force Create Salt (If Needed)

If salt is missing, you can force create it:

```javascript
import { forceCreateSalt } from '../services/UserSaltService';
import { getCurrentUser } from '../services/FirebaseAuthService';

const createSalt = async () => {
    const user = getCurrentUser();
    if (user?.uid) {
        const result = await forceCreateSalt(user.uid);
        console.log('Force create result:', result);
    }
};
```

## Verification Checklist

- [ ] User is logged in (Firebase Auth)
- [ ] Cloud sync is enabled (`CLOUD_SYNC_ENABLED = 'true'`)
- [ ] Device is online
- [ ] Master password setup completed
- [ ] Console shows: "✅ Generated and saved new user salt"
- [ ] Firestore shows `userSalt` field in `users/{userId}` document
- [ ] Salt is cached locally (`userSalt_{userId}` in SecureStore)

---

## Quick Reference

### Test Commands

```bash
# Run all tests
npm test

# Run specific test
npm test -- -t "Offline Delete"

# Run with coverage
npm run test:coverage

# Clear cache
npm test -- --clearCache
```

### Manual Testing Priority

1. **Critical** (Must Test):
   - Offline delete → sync
   - New entry
   - Edit and save
   - Cloud sync

2. **Important** (Should Test):
   - Device switch
   - Storage limits
   - PIN management

3. **Nice to Have**:
   - Special characters
   - Edge cases
   - Performance

---

## Summary

- **545+ automated tests** covering all scenarios
- **20+ manual test cases** for UI and integration
- **Tombstone logic** fixes offline deletion bug
- **Comprehensive coverage** of positive, negative, and edge cases

Run `npm test` to verify everything works correctly!

---

**Last Updated**: 2025-12-02
