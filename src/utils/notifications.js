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
    // Primero cancelamos cualquier recordatorio previo para no duplicar
    await cancelAllNotifications();

    const trigger = new Date();
    trigger.setHours(18);
    trigger.setMinutes(15);
    trigger.setSeconds(0);

    // Si ya pasaron las 20:00 hoy, programamos para mañana
    if (new Date() > trigger) {
        trigger.setDate(trigger.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
        content: {
            title: "⏰ Recordatorio de Salida",
            body: "Aún no has fichado tu salida hoy. Por favor, hazlo ahora.",
            data: { screen: 'UserDashboard' },
        },
        trigger: {
            date: trigger,
        },
    });

    console.log('Notificación programada para:', trigger.toLocaleString());
}

export async function cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Todas las notificaciones programadas han sido canceladas.');
}
