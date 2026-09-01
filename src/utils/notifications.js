import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') return; // En web no registramos notificaciones nativas por ahora

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

let isSchedulingInProgress = false;

async function scheduleNotification(notificationId, triggerDate) {
    return await Notifications.scheduleNotificationAsync({
        identifier: notificationId,
        content: {
            title: "⏰ Recordatorio de Salida",
            body: "Aún no has fichado tu salida hoy. No olvides registrarla antes de irte.",
            data: { screen: 'UserDashboard' },
            android: {
                channelId: 'default',
            }
        },
        trigger: {
            type: 'date',
            date: triggerDate,
        },
    });
}

export async function scheduleClockOutReminder() {
    if (Platform.OS === 'web') return; // En web no programamos recordatorios por ahora
    const NOTIFICATION_ID = 'clock-out-reminder';

    // 1. Bloqueo de concurrencia: Evita que llamadas rápidas dupliquen la notificación
    if (isSchedulingInProgress) return;
    isSchedulingInProgress = true;

    try {
        // 2. Comprobar si ya existe para no molestar al sistema operativo innecesariamente
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        if (scheduled.some(n => n.identifier === NOTIFICATION_ID)) {
            console.log('Notificación ya existente. No se requiere nueva programación.');
            isSchedulingInProgress = false;
            return;
        }

        // 3. Definir la hora objetivo: 14:05 y  18:05 si es invierno o en horario intensivo solo a las 14:03 
        const now = new Date();
        const triggerDate14 = new Date();
        triggerDate14.setHours(14, 5, 0, 0);

        const triggerDate18 = new Date();
        triggerDate18.setHours(18, 5, 0, 0);

        if (now < triggerDate14) {
            await scheduleNotification(NOTIFICATION_ID, triggerDate14);
        } else if (now < triggerDate18) {
            await scheduleNotification(NOTIFICATION_ID, triggerDate18);
        }
    } catch (error) {
        console.error('Error al programar recordatorio:', error);
    } finally {
        isSchedulingInProgress = false;
    }
}

export async function cancelAllNotifications() {
    if (Platform.OS === 'web') return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Todas las notificaciones programadas han sido canceladas.');
}
