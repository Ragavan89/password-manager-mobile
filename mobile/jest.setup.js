// Jest setup file
import '@testing-library/jest-native/extend-expect';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
    openDatabaseSync: jest.fn(() => ({
        execSync: jest.fn(),
        runSync: jest.fn(),
        getAllSync: jest.fn(() => []),
    })),
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
    default: {
        setItem: jest.fn(() => Promise.resolve()),
        getItem: jest.fn(() => Promise.resolve(null)),
        removeItem: jest.fn(() => Promise.resolve()),
        clear: jest.fn(() => Promise.resolve()),
    },
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
    default: {
        fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
        addEventListener: jest.fn(() => jest.fn()),
    },
}));

// Mock Firebase
jest.mock('firebase/firestore', () => ({
    getFirestore: jest.fn(),
    collection: jest.fn(),
    doc: jest.fn(),
    setDoc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    query: jest.fn(),
    orderBy: jest.fn(),
    onSnapshot: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(),
    signInAnonymously: jest.fn(),
    onAuthStateChanged: jest.fn(),
}));

// Suppress console warnings in tests
global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
};
