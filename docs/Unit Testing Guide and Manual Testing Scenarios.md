# Unit Testing Guide and Manual Testing Scenarios

## Table of Contents

1. [Unit Testing Guide](#unit-testing-guide)
2. [Manual Testing Scenarios](#manual-testing-scenarios)
3. [Tombstone Deletion Logic](#tombstone-deletion-logic)

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
