import 'react-native-get-random-values'; // MUST be first import for crypto to work
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import AddPasswordScreen from './src/screens/AddPasswordScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SetupMasterPasswordScreen from './src/screens/SetupMasterPasswordScreen';
import SetupPINScreen from './src/screens/SetupPINScreen';
import LoginScreen from './src/screens/LoginScreen';
import AuthScreen from './src/screens/AuthScreen';
import FAQScreen from './src/screens/FAQScreen';
import { initDatabase } from './src/services/Database';

const Stack = createStackNavigator();

export default function App() {
  // Initialize database on app start
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="auto" />
        <NavigationContainer>
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'My Credentials', headerLeft: null }}
            />
            <Stack.Screen
              name="AddPassword"
              component={AddPasswordScreen}
              options={{ title: 'Add New Password' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Configuration' }}
            />
            <Stack.Screen
              name="SetupPIN"
              component={SetupPINScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SetupMasterPassword"
              component={SetupMasterPasswordScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Auth"
              component={AuthScreen}
              options={{ title: 'Enable Cloud Sync' }}
            />
            <Stack.Screen
              name="FAQ"
              component={FAQScreen}
              options={{ title: 'Help & FAQ' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
