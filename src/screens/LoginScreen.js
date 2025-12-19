import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import BackgroundBlur from '../components/BackgroundBlur';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';

const { width } = Dimensions.get('window');

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }

        setLoading(true);
        console.log('LoginScreen: Iniciando proceso de login...');

        try {
            const result = await signIn(email, password);
            console.log('LoginScreen: Resultado recibido:', result);

            setLoading(false);

            if (!result.success) {
                // Mostrar alerta con más detalles técnicos si están disponibles
                const errorMsg = result.error || 'Credenciales incorrectas';
                const errorDetails = result.fullError ? `\n\nDetalles: ${JSON.stringify(result.fullError, null, 2)}` : '';

                Alert.alert('Error de Inicio de Sesión', `${errorMsg}${errorDetails}`);
            }
        } catch (e) {
            setLoading(false);
            console.error('LoginScreen: Error inesperado en handleLogin:', e);
            Alert.alert('Error Crítico', e.message);
        }
    };

    return (
        <BackgroundBlur intensity={80}>
            <View style={styles.container}>

                {/* Contenedor del Logo */}
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/logoblanco.png')}
                        style={styles.logo}
                        resizeMode="contain"
                        color="white"
                    />
                </View>

                {/* Títulos */}
                <Text style={styles.appTitle}>App Fichaje</Text>
                <Text style={styles.appSubtitle}>Palacín</Text>

                {/* Formulario */}
                <View style={styles.formContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!loading}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Contraseña"
                        placeholderTextColor="#9CA3AF"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        editable={!loading}
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Iniciar Sesión</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </BackgroundBlur>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    logoContainer: {
        padding: 16,
        color: 'white',
    },
    logo: {
        width: 100,
        height: 100,
    },
    appTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 8,
        textAlign: 'center',
    },
    appSubtitle: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 32,
        textAlign: 'center',
    },
    formContainer: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: 24,
        borderRadius: 20,
        // Efecto borde sutil
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 16,
        marginBottom: 16,
        fontSize: 16,
        color: '#1F2937',
    },
    button: {
        backgroundColor: '#1E3A8A', // Azul corporativo
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        marginTop: 8,
    },
    buttonDisabled: {
        backgroundColor: '#60A5FA',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});


export default LoginScreen;
