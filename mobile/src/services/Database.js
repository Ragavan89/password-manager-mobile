/**
 * Database.js
 * 
 * Local SQLite database service for password storage.
 * Handles CRUD operations for passwords with support for:
 * - Web (localStorage fallback) and Native (SQLite) platforms
 * - Soft delete with tombstones for cloud sync
 * - Cloud sync status tracking
 * 
 * All passwords are stored encrypted - this service only handles storage,
 * not encryption/decryption (see Encryption.js for that).
 */

import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

let db = null;
if (Platform.OS !== 'web') {
  db = SQLite.openDatabaseSync('passwords.db');
}

export const initDatabase = () => {
  if (Platform.OS === 'web') return;

  // RESET DATABASE FOR SCHEMA UPDATE (Since user approved data wipe)
  // Remove this line after first run if you want to persist data across schema changes later
  // db.execSync('DROP TABLE IF EXISTS passwords'); 

  db.execSync(`
    CREATE TABLE IF NOT EXISTS passwords (
      id TEXT PRIMARY KEY,
      siteName TEXT NOT NULL,
      username TEXT NOT NULL,
      encryptedPassword TEXT NOT NULL,
      lastModified TEXT,
      comments TEXT,
      type TEXT DEFAULT 'password',
      meta TEXT,
      cloudSynced INTEGER DEFAULT 1,
      isDeleted INTEGER DEFAULT 0,
      deletedAt TEXT
    );
  `);

  // Add new columns to existing table if they don't exist (Migration)
  const columnsToAdd = [
    { name: 'lastModified', type: 'TEXT' },
    { name: 'comments', type: 'TEXT' },
    { name: 'cloudSynced', type: 'INTEGER DEFAULT 1' },
    { name: 'isDeleted', type: 'INTEGER DEFAULT 0' },
    { name: 'deletedAt', type: 'TEXT' },
    { name: 'type', type: "TEXT DEFAULT 'password'" },
    { name: 'meta', type: 'TEXT' }
  ];

  columnsToAdd.forEach(col => {
    try {
      db.execSync(`ALTER TABLE passwords ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Column likely exists
    }
  });
};

export const addPassword = (siteName, username, encryptedPassword, comments = '', cloudSynced = 1, id = null, type = 'password', meta = '') => {
  const { isPanicMode } = require('./Encryption');
  if (isPanicMode()) {
    console.warn("🚨 PANIC MODE: Write operation blocked.");
    return { id: null, error: "Cannot save in Panic Mode" };
  }

  const lastModified = new Date().toISOString();
  // Generate UUID if not provided
  const newId = id || Crypto.randomUUID();

  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const newEntry = { id: newId, siteName, username, encryptedPassword, lastModified, comments, cloudSynced, type, meta };
    localStorage.setItem('passwords', JSON.stringify([...existing, newEntry]));
    return { id: newId, lastModified };
  }

  db.runSync(
    'INSERT INTO passwords (id, siteName, username, encryptedPassword, lastModified, comments, cloudSynced, type, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    newId,
    siteName,
    username,
    encryptedPassword,
    lastModified,
    comments,
    cloudSynced,
    type,
    meta
  );
  return { id: newId, lastModified };
};

export const addPasswordsBatch = (passwords) => {
  if (!passwords || passwords.length === 0) return { success: true, count: 0 };
  const defaultLastModified = new Date().toISOString();

  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const newEntries = passwords.map(p => ({
      id: p.id || Crypto.randomUUID(),
      siteName: p.siteName,
      username: p.username,
      encryptedPassword: p.encryptedPassword,
      lastModified: p.lastModified || defaultLastModified,
      comments: p.comments || '',
      cloudSynced: p.cloudSynced !== undefined ? p.cloudSynced : 1,
      type: p.type || 'password',
      meta: p.meta || '',
      isDeleted: 0
    }));
    localStorage.setItem('passwords', JSON.stringify([...existing, ...newEntries]));
    return { success: true, count: newEntries.length };
  }

  // Use synchronous transaction for massive speedup
  try {
    db.withTransactionSync(() => {
      for (const p of passwords) {
        db.runSync(
          'INSERT OR REPLACE INTO passwords (id, siteName, username, encryptedPassword, lastModified, comments, cloudSynced, type, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          p.id || Crypto.randomUUID(),
          p.siteName,
          p.username,
          p.encryptedPassword,
          p.lastModified || defaultLastModified,
          p.comments || '',
          p.cloudSynced !== undefined ? p.cloudSynced : 1,
          p.type || 'password',
          p.meta || ''
        );
      }
    });
    return { success: true, count: passwords.length };
  } catch (error) {
    console.error('Batch insert error:', error);
    throw error;
  }
};

// Import at the top will be needed: import { isPanicMode } from './Encryption';

export const getPasswords = () => {
  // Check Panic Mode dynamically to avoid circular dependency
  const { isPanicMode } = require('./Encryption');

  if (isPanicMode && isPanicMode()) {
    console.log("🚨 PANIC MODE ACTIVE: Returning empty vault.");
    return [];
  }

  if (Platform.OS === 'web') {
    const all = JSON.parse(localStorage.getItem('passwords') || '[]');
    return all.filter(p => !p.isDeleted);
  }
  return db.getAllSync('SELECT * FROM passwords WHERE isDeleted = 0 OR isDeleted IS NULL');
};



export const updatePassword = (id, siteName, username, encryptedPassword, comments = '', type = 'password', meta = '') => {
  const lastModified = new Date().toISOString();

  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const updated = existing.map(p =>
      p.id === id ? { ...p, id, siteName, username, encryptedPassword, lastModified, comments, type, meta } : p
    );
    localStorage.setItem('passwords', JSON.stringify(updated));
    return { lastModified };
  }
  db.runSync(
    'UPDATE passwords SET siteName = ?, username = ?, encryptedPassword = ?, lastModified = ?, comments = ?, type = ?, meta = ? WHERE id = ?',
    siteName,
    username,
    encryptedPassword,
    lastModified,
    comments,
    type,
    meta,
    id
  );
  return { lastModified };
};

export const upsertPassword = (id, siteName, username, encryptedPassword, lastModified, comments = '', type = 'password', meta = '') => {
  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const index = existing.findIndex(p => p.id === id);
    if (index >= 0) {
      existing[index] = { id, siteName, username, encryptedPassword, lastModified, comments, type, meta };
    } else {
      existing.push({ id, siteName, username, encryptedPassword, lastModified, comments, type, meta });
    }
    localStorage.setItem('passwords', JSON.stringify(existing));
    return;
  }

  // For SQLite, try update first, if no rows affected, insert
  const result = db.runSync(
    'UPDATE passwords SET siteName = ?, username = ?, encryptedPassword = ?, lastModified = ?, comments = ?, type = ?, meta = ? WHERE id = ?',
    siteName,
    username,
    encryptedPassword,
    lastModified,
    comments,
    type,
    meta,
    id
  );

  if (result.changes === 0) {
    db.runSync(
      'INSERT INTO passwords (id, siteName, username, encryptedPassword, lastModified, comments, type, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      siteName,
      username,
      encryptedPassword,
      lastModified,
      comments,
      type,
      meta
    );
  }
};

export const updateCloudSyncStatus = (id, cloudSynced = 1) => {
  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const updated = existing.map(p =>
      p.id === id ? { ...p, cloudSynced } : p
    );
    localStorage.setItem('passwords', JSON.stringify(updated));
    return;
  }
  db.runSync('UPDATE passwords SET cloudSynced = ? WHERE id = ?', cloudSynced, id);
};

export const deletePassword = (id) => {
  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const filtered = existing.filter(p => p.id !== id);
    localStorage.setItem('passwords', JSON.stringify(filtered));
    return;
  }
  db.runSync('DELETE FROM passwords WHERE id = ?', id);
};

export const clearAllPasswords = () => {
  if (Platform.OS === 'web') {
    localStorage.setItem('passwords', JSON.stringify([]));
    return;
  }
  db.runSync('DELETE FROM passwords');
};

/**
 * Tombstone Functions
 */

// Mark password as deleted (create tombstone)
export const markAsDeleted = (id) => {
  const deletedAt = new Date().toISOString();

  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const updated = existing.map(p =>
      p.id === id ? { ...p, isDeleted: 1, deletedAt } : p
    );
    localStorage.setItem('passwords', JSON.stringify(updated));
    return;
  }

  db.runSync(
    'UPDATE passwords SET isDeleted = 1, deletedAt = ? WHERE id = ?',
    deletedAt,
    id
  );
};

// Get only active passwords (for user display)
export const getActivePasswords = () => {
  if (Platform.OS === 'web') {
    const all = JSON.parse(localStorage.getItem('passwords') || '[]');
    return all.filter(p => !p.isDeleted);
  }
  return db.getAllSync('SELECT * FROM passwords WHERE isDeleted = 0 OR isDeleted IS NULL');
};

// Get only deleted passwords (tombstones for sync)
export const getDeletedPasswords = () => {
  if (Platform.OS === 'web') {
    const all = JSON.parse(localStorage.getItem('passwords') || '[]');
    return all.filter(p => p.isDeleted === 1);
  }
  return db.getAllSync('SELECT * FROM passwords WHERE isDeleted = 1');
};

// Permanently delete a password (remove tombstone)
export const permanentlyDelete = (id) => {
  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const filtered = existing.filter(p => p.id !== id);
    localStorage.setItem('passwords', JSON.stringify(filtered));
    return;
  }
  db.runSync('DELETE FROM passwords WHERE id = ?', id);
};

// Delete old tombstones (cleanup)
export const deleteOldTombstones = (beforeDate) => {
  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const filtered = existing.filter(p => {
      if (p.isDeleted !== 1) return true; // Keep active
      if (!p.deletedAt) return false; // Remove tombstones without date
      return new Date(p.deletedAt) >= new Date(beforeDate); // Keep recent tombstones
    });
    localStorage.setItem('passwords', JSON.stringify(filtered));
    return;
  }

  db.runSync(
    'DELETE FROM passwords WHERE isDeleted = 1 AND deletedAt < ?',
    beforeDate
  );
};
// Update ALL passwords to be marked as "not synced"
// Used when user disconnects/deletes cloud account to show yellow status locally
export const markAllAsUnsynced = () => {
  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const updated = existing.map(p => ({ ...p, cloudSynced: 0 }));
    localStorage.setItem('passwords', JSON.stringify(updated));
    return;
  }
  // Reset all active passwords to pending sync
  db.runSync('UPDATE passwords SET cloudSynced = 0 WHERE isDeleted = 0 OR isDeleted IS NULL');
};
