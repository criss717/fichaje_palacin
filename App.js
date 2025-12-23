import 'react-native-url-polyfill/auto';
import './global.css';
import React from 'react';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export default function App() {
    return (
        <AuthProvider>
            <AppNavigator />
            <StatusBar style="light" />
        </AuthProvider>
    );
}
