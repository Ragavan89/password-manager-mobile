import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration
// These values are extracted from google-services.json
const firebaseConfig = {
    apiKey: "AIzaSyAywjQaS3L1CafHJli1fxGkYZFWglC5r-k",
    authDomain: "keyvault-pro-9458e.firebaseapp.com",
    projectId: "keyvault-pro-9458e",
    storageBucket: "keyvault-pro-9458e.firebasestorage.app",
    messagingSenderId: "909731735542",
    appId: "1:909731735542:android:a4cc8cab6969ea8b0289d7"
};

let app;
let auth;
let firestore;

if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);

    // Initialize Auth with AsyncStorage persistence
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });

    // Initialize Firestore with forced long-polling to avoid WebSocket issues
    firestore = initializeFirestore(app, {
        experimentalForceLongPolling: true,
        databaseId: 'keyvault-pro-india'
    });
} else {
    app = getApp();
    auth = getAuth(app);
    // Even if app is initialized, we must ensure we get the correct database instance
    // getFirestore(app) returns the default database, which is wrong here.
    // We try to initialize it again with the correct ID, or get the existing named instance if possible.
    try {
        firestore = initializeFirestore(app, {
            experimentalForceLongPolling: true,
            databaseId: 'keyvault-pro-india'
        });
    } catch (e) {
        // If already initialized with different settings, try to get it
        firestore = getFirestore(app, 'keyvault-pro-india');
    }
}

export { app, auth, firestore };
