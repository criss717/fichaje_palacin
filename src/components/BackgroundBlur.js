import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
// import { BlurView } from 'expo-blur'; // Desactivado temporalmente para probar

const { width, height } = Dimensions.get('window');

const BackgroundBlur = ({ children, intensity = 50 }) => {
    return (
        <View style={styles.container}>
            {/* Imagen de fondo sin blur */}
            <Image
                source={require('../../assets/fondo2.jpg')}
                style={styles.fixedBackground}
                resizeMode="contain"
            />

            {/* Contenido directo sobre la imagen */}
            <View style={styles.content}>
                {/* Capa oscura semitransparente para simular blur/contraste */}
                <View style={styles.overlay} />
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    fixedBackground: {
        position: 'absolute',
        top: -500,
        left: -255,
        width: width + 510,
        height: height + 550,
    },
    content: {
        flex: 1,
        width: '100%',
        position: 'relative',
        zIndex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', // Capa más clara para ver mejor la imagen
    }
});

export default BackgroundBlur;
