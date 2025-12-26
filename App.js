import 'react-native-url-polyfill/auto';
import './global.css';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { ComicNeue_400Regular, ComicNeue_700Bold } from '@expo-google-fonts/comic-neue';
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
    const [fontsLoaded] = useFonts({
        'Comic Sans MS': ComicNeue_400Regular,
        'Comic Sans MS-Bold': ComicNeue_700Bold, // Explicit bold
        'Comic Sans': ComicNeue_400Regular,
    });

    if (!fontsLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1E3A8A' }}>
                <ActivityIndicator size="large" color="#ffffff" />
            </View>
        );
    }

    return (
        <AuthProvider>
            <AppNavigator />
            <StatusBar style="light" />
        </AuthProvider>
    );
}
