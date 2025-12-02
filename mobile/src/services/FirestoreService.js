import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    getFirestore
} from 'firebase/firestore';
import { app } from '../../firebase.config';

// EXPLICITLY get the named database instance to ensure we aren't using default
const firestore = getFirestore(app, 'keyvault-pro-india');

/**
 * Save a password to Firestore
 * CRITICAL: Uses localId as document ID to enforce uniqueness
 */
export const savePassword = async (userId, passwordData) => {
    try {
        // Validate that id exists (UUID)
        if (!passwordData.id) {
            console.error('❌ savePassword called without id:', passwordData);
            return { success: false, error: 'id is required' };
        }

        // First, ensure the user document exists
        const userRef = doc(firestore, 'users', userId);

        try {
            await setDoc(userRef, {
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        } catch (userDocError) {
            console.error('❌ Failed to create user document:', userDocError);
            throw userDocError;
        }

        // Use UUID as document ID
        const documentId = passwordData.id;
        const passwordRef = doc(firestore, 'users', userId, 'passwords', documentId);

        // Remove id and localId from data - ID is stored as document ID only
        const { id, localId, ...dataToSave } = passwordData;

        try {
            await setDoc(passwordRef, {
                ...dataToSave,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            console.log(`✅ Saved password with ID ${documentId} to Firestore`);
            return { success: true, id: documentId };
        } catch (passwordDocError) {
            console.error('❌ Failed to create password document:', passwordDocError);
            throw passwordDocError;
        }
    } catch (error) {
        console.error('❌ Error saving password:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all passwords for a user
 */
export const getPasswords = async (userId) => {
    try {
        const passwordsRef = collection(firestore, 'users', userId, 'passwords');
        console.log(`🔍 Fetching passwords from: users/${userId}/passwords`);

        const q = query(passwordsRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        console.log(`📄 Found ${querySnapshot.size} documents in cloud`);

        const passwords = [];
        querySnapshot.forEach((doc) => {
            passwords.push({ id: doc.id, ...doc.data() });
        });

        return { success: true, passwords };
    } catch (error) {
        console.error('❌ Error getting passwords - Full details:');
        console.error('Error name:', error.name);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Full error object:', JSON.stringify(error, null, 2));
        return { success: false, error: error.message, passwords: [] };
    }
};

/**
 * Update an existing password
 */
export const updatePassword = async (userId, passwordId, passwordData) => {
    try {
        if (!userId || !passwordId) {
            console.error('❌ updatePassword called with missing IDs:', { userId, passwordId });
            return { success: false, error: 'Missing user ID or password ID' };
        }

        const passwordRef = doc(firestore, 'users', userId, 'passwords', passwordId);
        await updateDoc(passwordRef, {
            ...passwordData,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    } catch (error) {
        // Don't log as error if document doesn't exist - this is expected for offline passwords
        if (error.message?.includes('No document to update')) {
            console.log('⚠️ Document does not exist in cloud (offline password)');
        } else {
            console.error('Error updating password:', error);
        }
        return { success: false, error: error.message };
    }
};



/**
 * Delete a password
 */
export const deletePassword = async (userId, passwordId) => {
    try {
        const passwordRef = doc(firestore, 'users', userId, 'passwords', passwordId);
        await deleteDoc(passwordRef);
        return { success: true };
    } catch (error) {
        console.error('Error deleting password:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Save encrypted master password hash
 */
export const saveMasterPasswordHash = async (userId, encryptedHash) => {
    try {
        const userRef = doc(firestore, 'users', userId);
        await setDoc(userRef, {
            encryptedMasterPassword: encryptedHash,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error('Error saving master password:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get encrypted master password hash
 */
export const getMasterPasswordHash = async (userId) => {
    try {
        const userRef = doc(firestore, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            return { success: true, encryptedHash: userDoc.data().encryptedMasterPassword };
        }

        return { success: true, encryptedHash: null };
    } catch (error) {
        console.error('Error getting master password:', error);
        return { success: false, error: error.message, encryptedHash: null };
    }
};

/**
 * Listen for real-time password updates
 */
export const subscribeToPasswords = (userId, callback) => {
    const passwordsRef = collection(firestore, 'users', userId, 'passwords');
    const q = query(passwordsRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (querySnapshot) => {
        const passwords = [];
        querySnapshot.forEach((doc) => {
            passwords.push({ id: doc.id, ...doc.data() });
        });
        callback(passwords);
    }, (error) => {
        console.error('Error in password subscription:', error);
        callback([]);
    });
};
