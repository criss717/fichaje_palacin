import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Alert, StyleSheet, ScrollView } from 'react-native';
import BackgroundBlur from '../components/BackgroundBlur';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { formatDate, formatTime, isToday } from '../utils/helpers';
import { registerForPushNotificationsAsync, scheduleClockOutReminder, cancelAllNotifications } from '../utils/notifications';

const UserDashboard = () => {
    const { profile, signOut } = useAuth();
    const [todayEntries, setTodayEntries] = useState({ entrada: null, salida: null });
    const [loading, setLoading] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        setupNotifications();
        loadTodayEntries();

        // Suscribirse a cambios en time_entries para actualizar la UI en tiempo real
        const channel = supabase
            .channel('public:time_entries')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
                loadTodayEntries();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const setupNotifications = async () => {
        await registerForPushNotificationsAsync();
    };

    const loadTodayEntries = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('time_entries')
                .select('*')
                .eq('user_id', user.id)
                .order('timestamp', { ascending: false })
                .limit(5); // Suficiente para ver el último estado

            if (error) throw error;

            if (data.length > 0) {
                const lastEntry = data[0];
                const lastEntryDate = new Date(lastEntry.timestamp);

                // Caso: El último registro es una ENTRADA pero NO es de hoy (Sesión olvidada)
                if (lastEntry.entry_type === 'entrada' && !isToday(lastEntryDate)) {
                    const diffMs = new Date() - lastEntryDate;
                    const diffHours = diffMs / (1000 * 60 * 60);

                    if (diffHours > 10) {
                        setIsBlocked(true);
                        Alert.alert(
                            '⚠️ Jornada Excedida',
                            `Tu última entrada fue el ${formatDate(lastEntryDate)} a las ${formatTime(lastEntryDate)}.\n\nHan pasado más de 10 horas. Por favor, habla con Administración para regularizar tu fichaje.`,
                            [{ text: 'Entendido' }]
                        );
                    } else {
                        Alert.alert(
                            '📝 Fichaje Pendiente',
                            `No fichaste la salida el día ${formatDate(lastEntryDate)}.\n\nPor favor, ficha la SALIDA ahora para poder iniciar tu jornada de hoy.`,
                            [{ text: 'Fichar Salida Olvidada', onPress: () => handleFichaje('salida', lastEntry.id) }]
                        );
                    }
                }
            }

            // Buscar la entrada de HOY (la más reciente)
            const entradaHoy = data.find(e => e.entry_type === 'entrada' && isToday(new Date(e.timestamp)));

            // Buscar la salida de HOY (pero solo si ocurrió DESPUÉS de la entrada de hoy)
            const salidaHoy = data.find(e =>
                e.entry_type === 'salida' &&
                isToday(new Date(e.timestamp)) &&
                (!entradaHoy || new Date(e.timestamp) > new Date(entradaHoy.timestamp))
            );

            setTodayEntries({
                entrada: entradaHoy,
                salida: salidaHoy
            });

            // Sincronizar recordatorio: Si hay entrada hoy pero no salida (post-entrada), asegurar notificación
            if (entradaHoy && !salidaHoy) {
                scheduleClockOutReminder();
            } else {
                cancelAllNotifications();
            }

        } catch (error) {
            console.error('Error cargando fichajes:', error);
        }
    };

    const handleFichaje = async (type) => {
        if (isBlocked) {
            Alert.alert('Bloqueado', 'Debes contactar con administración.');
            return;
        }

        // Validaciones para día actual (solo si no es una corrección forzada)
        if (type === 'entrada' && todayEntries.entrada) {
            Alert.alert('Aviso', 'Ya has fichado entrada hoy');
            return;
        }

        // Si intenta fichar salida normal pero ya tiene una hoy (después de la entrada)
        if (type === 'salida' && todayEntries.salida) {
            Alert.alert('Aviso', 'Ya has fichado salida hoy');
            return;
        }

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('time_entries')
                .insert([
                    { user_id: user.id, entry_type: type }
                ]);

            if (error) throw error;

            if (type === 'entrada') {
                await scheduleClockOutReminder();
            } else {
                await cancelAllNotifications();
            }

            Alert.alert('Éxito', `Fichaje de ${type} registrado correctamente`);
            loadTodayEntries();
        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <BackgroundBlur intensity={70}>
            <View style={styles.container}>
                {/* Cabecera */}
                <View style={styles.header}>
                    <Image
                        source={require('../../assets/logoblanco.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <View style={styles.userInfo}>
                        <Text style={styles.welcomeText}>¡Hola,</Text>
                        <Text style={styles.userName}>{profile?.full_name || 'Usuario'}!</Text>
                        <Text style={styles.dateText}>{formatDate(new Date())}</Text>
                    </View>
                </View>

                {/* Estado del día */}
                <View style={styles.statusCard}>
                    <Text style={styles.cardTitle}>Tu Jornada de Hoy</Text>

                    <View style={styles.row}>
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>Entrada</Text>
                            <Text style={[styles.statusTime, todayEntries.entrada ? styles.textSuccess : styles.textGray]}>
                                {todayEntries.entrada ? formatTime(new Date(todayEntries.entrada.timestamp)) : '--:--'}
                            </Text>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>Salida</Text>
                            <Text style={[styles.statusTime, todayEntries.salida ? styles.textError : styles.textGray]}>
                                {todayEntries.salida ? formatTime(new Date(todayEntries.salida.timestamp)) : '--:--'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Botones de Acción */}
                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        onPress={() => handleFichaje('entrada')}
                        disabled={!!todayEntries.entrada || loading}
                        style={[
                            styles.actionButton,
                            styles.btnSuccess,
                            (todayEntries.entrada || loading) && styles.btnDisabled
                        ]}
                    >
                        <Text style={styles.actionButtonTitle}>FICHAR ENTRADA</Text>
                        <Text style={styles.actionButtonSub}>Registrar inicio de jornada</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleFichaje('salida')}
                        disabled={!todayEntries.entrada || !!todayEntries.salida || loading}
                        style={[
                            styles.actionButton,
                            styles.btnError,
                            (!todayEntries.entrada || todayEntries.salida || loading) && styles.btnDisabled
                        ]}
                    >
                        <Text style={styles.actionButtonTitle}>FICHAR SALIDA</Text>
                        <Text style={styles.actionButtonSub}>Registrar fin de jornada</Text>
                    </TouchableOpacity>
                </View>

                {/* Logout */}
                <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
                    <Text style={styles.logoutText}>Cerrar Sesión</Text>
                </TouchableOpacity>

            </View>
        </BackgroundBlur>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 60,
        paddingHorizontal: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: {
        width: 60,
        height: 60,
        borderRadius: 12,
        marginRight: 16,
    },
    userInfo: {
        flex: 1,
    },
    welcomeText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
    },
    userName: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
    },
    dateText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        marginTop: 4,
    },
    statusCard: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 16,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusItem: {
        flex: 1,
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: 40,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 16,
    },
    statusLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    statusTime: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    textSuccess: { color: '#10B981' }, // Verde
    textError: { color: '#EF4444' },   // Rojo
    textGray: { color: '#9CA3AF' },

    actionsContainer: {
        flex: 1,
        justifyContent: 'center', // Centrar botones verticalmente
    },
    actionButton: {
        paddingVertical: 24,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 6,
    },
    btnSuccess: { backgroundColor: '#10B981' },
    btnError: { backgroundColor: '#EF4444' },
    btnDisabled: { backgroundColor: '#9CA3AF', opacity: 0.6 },

    actionButtonTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    actionButtonSub: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
    },
    logoutButton: {
        padding: 16,
        alignItems: 'center',
        marginBottom: 32,
    },
    logoutText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        fontWeight: '500',
    },
});

export default UserDashboard;
