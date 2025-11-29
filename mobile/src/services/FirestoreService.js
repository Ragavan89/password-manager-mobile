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
 */
export const savePassword = async (userId, passwordData) => {
    try {
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

        // Then create the password in the subcollection
        const passwordsCollectionRef = collection(userRef, 'passwords');
        const newPasswordRef = doc(passwordsCollectionRef);

        try {
            await setDoc(newPasswordRef, {
                ...passwordData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } catch (passwordDocError) {
            console.error('❌ Failed to create password document:', passwordDocError);
            throw passwordDocError;
        }

        return { success: true, id: newPasswordRef.id };
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
        console.error('Error updating password:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Link a local ID to a cloud password without updating timestamp
 * This prevents sync loops when downloading existing passwords
 */
export const linkLocalId = async (userId, passwordId, localId) => {
    try {
        const passwordRef = doc(firestore, 'users', userId, 'passwords', passwordId);
        await updateDoc(passwordRef, { localId });
        return { success: true };
    } catch (error) {
        console.error('Error linking local ID:', error);
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
