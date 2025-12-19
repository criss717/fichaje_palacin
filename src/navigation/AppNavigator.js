import { Text } from 'react-native';

// Importando Text de react-native para evitar error de no definido si no se importó antes
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import UserDashboard from '../screens/UserDashboard';
import AdminDashboard from '../screens/AdminDashboard';
import BackgroundBlur from '../components/BackgroundBlur';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const { user, profile, loading } = useAuth();

    console.log('AppNavigator: Estado loading=', loading, 'User=', user ? user.email : 'null');

    if (loading) {
        return (
            <BackgroundBlur intensity={80}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    {/* Logo con tamaño personalizable */}
                    <Image
                        source={require('../../assets/logoblanco.png')}
                        style={{
                            width: 100,
                            height: 100,
                            borderRadius: 20,
                            marginBottom: 30
                        }}
                        resizeMode="contain"
                    />
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={{ color: 'white', marginTop: 20, fontSize: 16 }}>Cargando app...</Text>
                </View>
            </BackgroundBlur>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!user ? (
                    <Stack.Screen name="Login" component={LoginScreen} />
                ) : profile?.role === 'admin' ? (
                    <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
                ) : (
                    <Stack.Screen name="UserDashboard" component={UserDashboard} />
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
