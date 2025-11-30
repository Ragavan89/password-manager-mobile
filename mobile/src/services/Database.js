import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let db = null;
if (Platform.OS !== 'web') {
  db = SQLite.openDatabaseSync('passwords.db');
}

export const initDatabase = () => {
  if (Platform.OS === 'web') return;
  db.execSync(`
    CREATE TABLE IF NOT EXISTS passwords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siteName TEXT NOT NULL,
      username TEXT NOT NULL,
      encryptedPassword TEXT NOT NULL,
      lastModified TEXT,
      comments TEXT,
      isDeleted INTEGER DEFAULT 0,
      deletedAt TEXT
    );
  `);

  // Add new columns to existing table if they don't exist
  try {
    db.execSync('ALTER TABLE passwords ADD COLUMN lastModified TEXT');
  } catch (e) {
    // Column already exists
  }
  try {
    db.execSync('ALTER TABLE passwords ADD COLUMN comments TEXT');
  } catch (e) {
    // Column already exists
  }
  try {
    db.execSync('ALTER TABLE passwords ADD COLUMN cloudSynced INTEGER DEFAULT 1');
  } catch (e) {
    // Column already exists
  }
  try {
    db.execSync('ALTER TABLE passwords ADD COLUMN isDeleted INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists
  }
  try {
    db.execSync('ALTER TABLE passwords ADD COLUMN deletedAt TEXT');
  } catch (e) {
    // Column already exists
  }
};

export const addPassword = (siteName, username, encryptedPassword, comments = '', cloudSynced = 1) => {
  const lastModified = new Date().toISOString();

  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const newId = Date.now();
    const newEntry = { id: newId, siteName, username, encryptedPassword, lastModified, comments, cloudSynced };
    localStorage.setItem('passwords', JSON.stringify([...existing, newEntry]));
    return { id: newId, lastModified };
  }
  const result = db.runSync(
    'INSERT INTO passwords (siteName, username, encryptedPassword, lastModified, comments, cloudSynced) VALUES (?, ?, ?, ?, ?, ?)',
    siteName,
    username,
    encryptedPassword,
    lastModified,
    comments,
    cloudSynced
  );
  return { id: result.lastInsertRowId, lastModified };
};

export const getPasswords = () => {
  if (Platform.OS === 'web') {
    const all = JSON.parse(localStorage.getItem('passwords') || '[]');
    return all.filter(p => !p.isDeleted);
  }
  return db.getAllSync('SELECT * FROM passwords WHERE isDeleted = 0 OR isDeleted IS NULL');
};

export const updatePassword = (id, siteName, username, encryptedPassword, comments = '') => {
  const lastModified = new Date().toISOString();

  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const updated = existing.map(p =>
      p.id === id ? { ...p, id, siteName, username, encryptedPassword, lastModified, comments } : p
    );
    localStorage.setItem('passwords', JSON.stringify(updated));
    return { lastModified };
  }
  db.runSync(
    'UPDATE passwords SET siteName = ?, username = ?, encryptedPassword = ?, lastModified = ?, comments = ? WHERE id = ?',
    siteName,
    username,
    encryptedPassword,
    lastModified,
    comments,
    id
  );
  return { lastModified };
};

export const upsertPassword = (id, siteName, username, encryptedPassword, lastModified, comments = '') => {
  if (Platform.OS === 'web') {
    const existing = JSON.parse(localStorage.getItem('passwords') || '[]');
    const index = existing.findIndex(p => p.id === id);
    if (index >= 0) {
      existing[index] = { id, siteName, username, encryptedPassword, lastModified, comments };
    } else {
      existing.push({ id, siteName, username, encryptedPassword, lastModified, comments });
    }
    localStorage.setItem('passwords', JSON.stringify(existing));
    return;
  }

  // For SQLite, try update first, if no rows affected, insert
  const result = db.runSync(
    'UPDATE passwords SET siteName = ?, username = ?, encryptedPassword = ?, lastModified = ?, comments = ? WHERE id = ?',
    siteName,
    username,
    encryptedPassword,
    lastModified,
    comments,
    id
  );

  if (result.changes === 0) {
    db.runSync(
      'INSERT INTO passwords (id, siteName, username, encryptedPassword, lastModified, comments) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      siteName,
      username,
      encryptedPassword,
      lastModified,
      comments
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
