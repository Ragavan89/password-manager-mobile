import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORE_KEY = 'SHEETS_API_URL';

const getApiUrl = async () => {
    if (Platform.OS === 'web') {
        return localStorage.getItem(STORE_KEY);
    }
    return await SecureStore.getItemAsync(STORE_KEY);
};

export const fetchFromSheet = async () => {
    const url = await getApiUrl();
    if (!url) return [];

    try {
        // Append timestamp to prevent caching
        const cacheBuster = url.includes('?') ? `&t=${new Date().getTime()}` : `?t=${new Date().getTime()}`;
        const response = await axios.get(`${url}${cacheBuster}`, { timeout: 10000 });
        return response.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED' || error.message.includes('Network Error')) {
            console.log('Network unavailable, using local data');
        } else {
            console.error('Error fetching from sheet:', error);
        }
        return [];
    }
};

export const addToSheet = async (siteName, username, encryptedPassword, comments = '') => {
    const url = await getApiUrl();
    if (!url) throw new Error('API URL not configured');

    try {
        // Google Apps Script doesn't support CORS for POST requests in a standard way
        // We must use fetch with 'no-cors' mode for web, but this means we can't read the response
        // However, the data WILL be saved.

        if (Platform.OS === 'web') {
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'add',
                    siteName,
                    username,
                    encryptedPassword,
                    comments
                })
            });
            return 'success'; // We assume success since we can't read the response
        } else {
            const response = await axios.post(url, {
                action: 'add',
                siteName,
                username,
                encryptedPassword,
                comments
            });
            return response.data.id;
        }
    } catch (error) {
        console.error('Error adding to sheet:', error);
        return null;
    }
};

export const updateInSheet = async (id, siteName, username, encryptedPassword, comments = '') => {
    const url = await getApiUrl();
    if (!url) throw new Error('API URL not configured');

    try {
        if (Platform.OS === 'web') {
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'edit',
                    id,
                    siteName,
                    username,
                    encryptedPassword,
                    comments
                })
            });
            return 'success';
        } else {
            const response = await axios.post(url, {
                action: 'edit',
                id,
                siteName,
                username,
                encryptedPassword,
                comments
            });
            return response.data.result;
        }
    } catch (error) {
        console.error('Error updating sheet:', error);
        return null;
    }
};

export const deleteFromSheet = async (id) => {
    const url = await getApiUrl();
    if (!url) return;

    try {
        if (Platform.OS === 'web') {
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'delete',
                    id
                })
            });
        } else {
            await axios.post(url, {
                action: 'delete',
                id
            });
        }
    } catch (error) {
        console.error('Error deleting from sheet:', error);
    }
};
