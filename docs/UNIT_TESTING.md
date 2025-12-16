# Quality Assurance & Testing Guide

This document outlines the testing strategy for the Password Manager application, covering automated unit tests, manual acceptance testing scenarios, and offline functionality verification.

## 📋 Table of Contents

1. [Automated Unit Testing](#automated-unit-testing)
2. [Manual Testing Scenarios](#manual-testing-scenarios)
3. [Offline & Sync Testing](#offline--sync-testing)
4. [Tombstone & Deletion Logic](#tombstone--deletion-logic)
5. [Troubleshooting Tests](#troubleshooting-tests)

---

## 🧪 Automated Unit Testing

We use **Jest** and **React Native Testing Library** for ensuring code reliability. The suite covers critical business logic including encryption, database operations, and synchronization.

### Running Tests

Execute the following commands in the `mobile` directory:

```bash
# Run the full test suite
npm test

# Run with code coverage report
npm run test:coverage

# Watch mode (for development)
npm run test:watch
```

### Test Scope & Coverage

| Module | Test File | Coverage Areas |
| :--- | :--- | :--- |
| **Database** | `Database.test.js` | CRUD operations, SQLite integration, schema migration. |
| **Security** | `Encryption.test.js` | AES-256 encryption, decryption, SHA-256 hashing, Salt generation. |
| **Storage** | `HybridStorageService.test.js` | Local vs. cloud storage logic, data merging. |
| **Sync** | `SyncService.test.js` | Offline queue management, network error handling. |
| **Cloud** | `FirestoreService.test.js` | Firebase/Apps Script interaction mocking. |

---

## 📱 Manual Testing Scenarios

Use these scenarios for User Acceptance Testing (UAT) and regression testing before release.

### Core Functionality (Positive Tests)

#### TC-01: Create New Password
*   **Steps**: Open App -> Authenticate -> Tap "+" -> Fill all fields -> Save.
*   **Expected**: Entry appears in list immediately. "Synced" status indicator updates if online.
*   **Verification**: Check Google Sheet backend for new row.

#### TC-02: Edit Password
*   **Steps**: Tap Entry -> Edit -> Change Username -> Save.
*   **Expected**: Local list updates. Timestamp updates.
*   **Verification**: Verify change is reflected in Google Sheet after sync.

#### TC-03: Delete Password
*   **Steps**: Long press Entry -> Delete -> Confirm.
*   **Expected**: Entry removed from UI.
*   **Verification**: Row removed from Google Sheet (or marked deleted if soft-delete enabled).

#### TC-04: Master Password View
*   **Steps**: Settings -> View Master Password -> Enter PIN.
*   **Expected**: Master password revealed.
*   **Security Check**: Taking a screenshot should be allowed (or warned depending on OS policy), but screen recording should ideally be blocked (if implemented).

### Edge Cases & Negative Tests

#### TC-05: Storage Limit Exceeded
*   **Pre-condition**: App has reached max record limit (e.g., 100 free tier).
*   **Steps**: Try to add 101st password.
*   **Expected**: Error message "Storage limit reached". Data not saved.

#### TC-06: Network Failure During Sync
*   **Steps**: Start Sync -> Immediately toggle Airplane Mode ON.
*   **Expected**: App handles error gracefully. No crash. Error banner "Sync failed - Network unavailable".

#### TC-07: Duplicate Entry Warning
*   **Steps**: Add password for "google.com". Add another for "google.com".
*   **Expected**: UI might warn "Similar entry exists" (if implemented) or allow it as distinct entry.

---

## 🔌 Offline & Sync Testing

Since the application is **Offline-First**, verifying behavior without connectivity is critical.

### Setup for Offline Testing
1.  **Recommended**: Use a real device with a **Development Build** (`npx expo run:android`).
2.  **Alternative**: Production APK (`npm run build:android`).
3.  **Emulator**: Toggle "Airplane Mode" in emulator settings.

**Note**: *Expo Go* often requires a connection to the bundler, making it unreliable for strict offline testing.

### Offline Scenarios

#### Scenario A: Offline Creation -> Online Sync
1.  **State**: Device Offline.
2.  **Action**: Create Password A.
3.  **Check**: Entry visible locally with "Unsynced" icon (yellow/cloud-off).
4.  **Action**: Go Online -> Pull to Refresh.
5.  **Result**: Icon changes to "Synced" (green). Data appears in Google Sheet.

#### Scenario B: Offline Deletion -> Online Propagation
1.  **State**: Device Offline.
2.  **Action**: Delete Password B.
3.  **Check**: Password B disappears from UI.
4.  **Action**: Go Online -> Sync.
5.  **Result**: Tombstone record is processed; Password B is removed from cloud.

#### Scenario C: Conflict Resolution (Last Write Wins)
1.  **Device 1 (Offline)**: Edit "Netflix" -> set password "Pass1".
2.  **Device 2 (Online)**: Edit "Netflix" -> set password "Pass2" -> Sync.
3.  **Device 1**: Go Online -> Sync.
4.  **Result**: "Pass1" (newer timestamp) should overwrite "Pass2" (older timestamp) OR vice-versa depending on exact time.
    *   *Note*: Verify timestamp logic matches business requirements.

---

## 💀 Tombstone & Deletion Logic

To ensure deletions propagate correctly across offline devices, we use a **Tombstone** mechanism.

### flow
1.  **Delete (Local)**: Item is NOT immediately removed from SQLite. It is marked `isDeleted=1` with `deletedAt` timestamp.
2.  **Sync**: Sync service sends `ID` + `isDeleted` flag to cloud.
3.  **Cloud Confirmation**: Cloud deletes the row.
4.  **Cleanup (Local)**: After successful sync confirmation, the local tombstone is permanently removed.
5.  **Pruning**: Tombstones older than 30 days are auto-pruned to prevent bloat.

### Verification
*   **Database Inspection**: Use `console.log(await db.getRows('passwords'))` to see items with `isDeleted=1` before sync.

---

## 🔍 Troubleshooting Tests

### Tests Fail: "Cannot find module"
*   **Fix**: Run `npm install` to ensure dependencies are fresh.

### Tests Timeout
*   **Fix**: Increase Jest timeout in `package.json`:
    ```json
    "jest": { "testTimeout": 15000 }
    ```

### Android Emulator Network Issues
*   **Fix**: Toggle WiFi on emulator off/on. Ensure host machine has internet. Restart ADB: `adb kill-server && adb start-server`.
