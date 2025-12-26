import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import BackgroundBlur from '../components/BackgroundBlur';
import { useAuth } from '../context/AuthContext';
import CustomAlert from '../components/CustomAlert';

const { width } = Dimensions.get('window');

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();

    // Estado para Alerta Personalizada
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title, message, type = 'info') => {
        setAlertConfig({ visible: true, title, message, type });
    };

    const handleLogin = async () => {
        if (!email || !password) {
            showAlert('❌ Campos Vacíos', 'Por favor, introduce tu email y contraseña.', 'warning');
            return;
        }

        setLoading(true);
        console.log('LoginScreen: Iniciando proceso de login...');

        try {
            const result = await signIn(email, password);
            console.log('LoginScreen: Resultado recibido:', result);

            setLoading(false);

            if (!result.success) {
                showAlert('🔐 Acceso Denegado', `Las credenciales no coinciden. Por favor, verifica tus datos e inténtalo de nuevo.`, 'error');
            }
        } catch (e) {
            setLoading(false);
            console.error('LoginScreen: Error inesperado en handleLogin:', e);
            showAlert('⚠️ Problema de Conexión', `No pudimos conectar con el servidor: ${e.message}`, 'error');
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

            <CustomAlert
                {...alertConfig}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
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
    },
    logo: {
        width: 100,
        height: 100,
    },
    appTitle: {
        fontSize: 32,
        color: 'white',
        marginBottom: 8,
        textAlign: 'center',
        fontFamily: 'Comic Sans MS-Bold'
    },
    appSubtitle: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.8)',
        marginBottom: 32,
        textAlign: 'center',
        fontFamily: 'Comic Sans MS'
    },
    formContainer: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        padding: 24,
        borderRadius: 20,
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
        fontFamily: 'Comic Sans MS'
    },
    button: {
        backgroundColor: '#1E3A8A',
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
        fontFamily: 'Comic Sans MS-Bold'
    },
});

export default LoginScreen;
