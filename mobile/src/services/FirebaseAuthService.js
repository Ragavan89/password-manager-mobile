import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../../firebase.config';

/**
 * Sign up with email and password
 */
export const signUpWithEmail = async (email, password) => {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.log('Sign up error:', error);
        let errorMessage = 'Failed to create account';

        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already registered';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters';
        } else {
            // Fallback for unhandled errors
            errorMessage = 'An unexpected error occurred. Please try again.';
        }

        return { success: false, error: errorMessage };
    }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.log('Sign in error:', error);
        let errorMessage = 'Failed to sign in';

        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else if (error.code === 'auth/invalid-credential') {
            errorMessage = 'Invalid email or password';
        } else {
            // Fallback for unhandled errors
            errorMessage = 'Authentication failed. Please check your credentials.';
        }

        return { success: false, error: errorMessage };
    }
};

/**
 * Sign out current user
 */
export const signOut = async () => {
    try {
        await firebaseSignOut(auth);
        return { success: true };
    } catch (error) {
        console.log('Sign out error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = () => {
    return auth.currentUser;
};

/**
 * Send password reset email
 */
export const sendResetEmail = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: true };
    } catch (error) {
        console.log('Reset email error:', error);
        let errorMessage = 'Failed to send reset email';

        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        } else {
            // Fallback for unhandled errors
            errorMessage = 'Failed to send reset email. Please try again.';
        }

        return { success: false, error: errorMessage };
    }
};

/**
 * Listen for authentication state changes
 */
export const onAuthChange = (callback) => {
    return onAuthStateChanged(auth, callback);
};
