import * as Location from 'expo-location';
import { Platform } from 'react-native';

/**
 * Solicita permiso de ubicación y obtiene las coordenadas actuales.
 * Bloquea si el usuario deniega el permiso O si el GPS del sistema está desactivado.
 *
 * @throws {Error} Con mensaje 'PERMISSION_DENIED' si no hay permiso de app.
 * @throws {Error} Con mensaje 'GPS_DISABLED' si el GPS del sistema está apagado.
 * @throws {Error} Con mensaje 'LOCATION_UNAVAILABLE' para cualquier otro fallo.
 */
export const getCurrentLocation = async () => {
    // 1. Comprobar si los servicios de ubicación del sistema están activados
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
        throw new Error('GPS_DISABLED');
    }

    // 2. Solicitar permiso de la app
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        throw new Error('PERMISSION_DENIED');
    }

    // 3. Obtener posición actual con timeout de 15 segundos
    try {
        const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            mayShowUserSettingsDialog: false,
        });

        const device_type = Platform.OS === 'web' ? 'web' : 'mobile';

        return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            device_type,
        };
    } catch (err) {
        // Si falla la obtención (timeout, señal, etc.) lo marcamos como no disponible
        throw new Error('LOCATION_UNAVAILABLE');
    }
};

/**
 * Genera el mensaje de error adecuado según el tipo de error y la plataforma.
 */
export const getLocationErrorMessage = (errorCode) => {
    if (errorCode === 'GPS_DISABLED') {
        if (Platform.OS === 'android') {
            return 'El GPS de tu dispositivo está desactivado.\n\nVe a Ajustes > Ubicación y actívalo para poder fichar.';
        }
        if (Platform.OS === 'ios') {
            return 'Los servicios de localización están desactivados.\n\nVe a Ajustes > Privacidad y seguridad > Localización y actívalos.';
        }
        return 'La ubicación del dispositivo está desactivada. Actívala para poder fichar.';
    }

    if (errorCode === 'PERMISSION_DENIED') {
        if (Platform.OS === 'ios') {
            return 'La app no tiene permiso para acceder a tu ubicación.\n\nVe a: Ajustes > Privacidad y seguridad > Localización > [esta app] y selecciona "Al usar la app".';
        }
        if (Platform.OS === 'android') {
            return 'La app no tiene permiso para acceder a tu ubicación.\n\nVe a: Ajustes > Aplicaciones > [esta app] > Permisos > Ubicación y actívala.';
        }
        return 'Permiso de ubicación denegado. Haz clic en el candado (🔒) de la barra de direcciones y activa "Ubicación".';
    }

    // LOCATION_UNAVAILABLE u otros
    return 'No se pudo obtener tu ubicación. Asegúrate de tener el GPS activado y señal, e inténtalo de nuevo.';
};

// Alias para compatibilidad con código anterior
export const getLocationDeniedMessage = () => getLocationErrorMessage('PERMISSION_DENIED');
