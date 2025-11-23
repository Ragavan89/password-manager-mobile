import 'react-native-get-random-values'; // MUST be first import for crypto to work
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './src/screens/HomeScreen';
import AddPasswordScreen from './src/screens/AddPasswordScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SetupGuideScreen from './src/screens/SetupGuideScreen';
import LoginScreen from './src/screens/LoginScreen';
import { initDatabase } from './src/services/Database';

const Stack = createStackNavigator();

export default function App() {
  // Initialize database on app start
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
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
          name="SetupGuide"
          component={SetupGuideScreen}
          options={{ title: 'Setup Guide' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
