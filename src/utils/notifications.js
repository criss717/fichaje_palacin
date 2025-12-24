import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
    let token;
    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Fallo al obtener el token para notificaciones!');
            return;
        }
    } else {
        console.log('Debe usar un dispositivo físico para notificaciones push');
    }

    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    return token;
}

export async function scheduleClockOutReminder() {
    // Usamos un identificador fijo para que si se llama varias veces, 
    // la nueva versión simplemente sobrescriba a la anterior en lugar de duplicarse.
    const NOTIFICATION_ID = 'clock-out-reminder';

    await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID,
        content: {
            title: "⏰ Recordatorio de Salida",
            body: "Aún no has fichado tu salida hoy. No olvides registrarla antes de irte.",
            data: { screen: 'UserDashboard' },
        },
        trigger: {
            hour: 20,
            minute: 0,
            repeats: false,
        },
    });

    console.log('Notificación programada con éxito para las 20:00 (DNI: ' + NOTIFICATION_ID + ')');
}

export async function cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Todas las notificaciones programadas han sido canceladas.');
}
