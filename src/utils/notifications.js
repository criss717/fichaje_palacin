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

let isSchedulingInProgress = false;

export async function scheduleClockOutReminder() {
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

        // 3. Definir la hora objetivo: 18:15 de HOY
        const now = new Date();
        const triggerDate = new Date();
        triggerDate.setHours(18, 15, 0, 0);

        // 4. Solo programamos si la hora aún no ha pasado
        if (now < triggerDate) {
            await Notifications.scheduleNotificationAsync({
                identifier: NOTIFICATION_ID,
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
            console.log('🚀 Recordatorio programado correctamente para las 18:15');
        } else {
            console.log('La hora de salida (18:15) ya pasó. No se programa para hoy.');
        }
    } catch (error) {
        console.error('Error al programar recordatorio:', error);
    } finally {
        isSchedulingInProgress = false;
    }
}

export async function cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Todas las notificaciones programadas han sido canceladas.');
}
