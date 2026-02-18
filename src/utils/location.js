import * as Location from 'expo-location';
import { Platform } from 'react-native';

/**
 * Solicita permiso de ubicación y obtiene las coordenadas actuales.
 * Bloquea si el usuario deniega el permiso.
 *
 * @returns {{ latitude, longitude, accuracy, device_type } | null}
 *   Retorna las coordenadas o null si hubo un error irrecuperable.
 * @throws {Error} Si el permiso fue denegado (para que el llamador pueda mostrar un mensaje).
 */
export const getCurrentLocation = async () => {
    // 1. Solicitar permiso
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
        // Lanzamos un error especial para que la UI pueda mostrar el mensaje correcto
        const error = new Error('PERMISSION_DENIED');
        throw error;
    }

    // 2. Obtener posición actual
    const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
    });

    const device_type = Platform.OS === 'web' ? 'web' : 'mobile';

    return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        device_type,
    };
};

/**
 * Genera el mensaje de error adecuado según la plataforma
 * para guiar al usuario a activar la ubicación.
 */
export const getLocationDeniedMessage = () => {
    if (Platform.OS === 'ios') {
        return 'Para fichar necesitas activar la ubicación.\n\nVe a: Ajustes > Privacidad y seguridad > Localización > Safari (o tu navegador) y selecciona "Al usar la app".';
    }
    if (Platform.OS === 'android') {
        return 'Para fichar necesitas activar la ubicación.\n\nVe a: Ajustes > Aplicaciones > [esta app] > Permisos > Ubicación y actívala.';
    }
    // Web
    return 'Para fichar necesitas permitir el acceso a la ubicación en tu navegador.\n\nHaz clic en el icono del candado (🔒) en la barra de direcciones y activa "Ubicación".';
};
