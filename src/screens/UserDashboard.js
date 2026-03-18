import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, AppState } from 'react-native';
import BackgroundBlur from '../components/BackgroundBlur';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { formatDate, formatTime, isToday } from '../utils/helpers';
import { registerForPushNotificationsAsync, scheduleClockOutReminder, cancelAllNotifications } from '../utils/notifications';
import { getCurrentLocation, getLocationErrorMessage } from '../utils/location';
import CustomAlert from '../components/CustomAlert';

const UserDashboard = () => {
    const { profile, signOut } = useAuth();
    const [todayTurns, setTodayTurns] = useState([]);
    const [lastEntry, setLastEntry] = useState(null);
    const [loading, setLoading] = useState(false);
    const isClocking = useRef(false); // Bloqueo síncrono para evitar doble clic ultra rápido

    // Estado para Alerta Personalizada
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        confirmText: 'Confirmar'
    });

    const showAlert = (title, message, type = 'info', onConfirm = null, confirmText = 'Confirmar', options = {}) => {
        setAlertConfig({
            visible: true,
            title,
            message,
            type,
            onConfirm,
            confirmText,
            ...options
        });
    };

    useEffect(() => {
        setupNotifications();
        loadTodayEntries();

        // Escuchar cambios de estado de la app (Primer plano / Segundo plano)
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                // Silenciosamente refrescamos los datos al volver a la app
                loadTodayEntries();
            }
        });

        const channel = supabase
            .channel('public:time_entries')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
                loadTodayEntries();
            })
            .subscribe();

        return () => {
            subscription.remove();
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

            // Obtenemos fichajes de hoy para el dashboard
            const { data, error } = await supabase
                .from('time_entries')
                .select('*')
                .eq('user_id', user.id)
                .order('timestamp', { ascending: true }); // Ascendente para agrupar por turnos

            if (error) throw error;

            // Procesar turnos del día
            const turns = [];
            let currentTurn = null;
            let lastFoundEntry = null;

            data.forEach(entry => {
                const entryDate = new Date(entry.timestamp);

                if (isToday(entryDate)) {
                    if (entry.entry_type === 'entrada') {
                        if (currentTurn) turns.push(currentTurn); // Si ya había uno abierto (error?), lo cerramos como incompleto
                        currentTurn = { entrada: entry, salida: null };
                    } else if (entry.entry_type === 'salida') {
                        if (currentTurn) {
                            currentTurn.salida = entry;
                            turns.push(currentTurn);
                            currentTurn = null;
                        }
                    }
                }
                lastFoundEntry = entry;
            });

            if (currentTurn) turns.push(currentTurn);

            setTodayTurns(turns);
            setLastEntry(lastFoundEntry);

            // Verificación de fichaje olvidado del día anterior (Lógica existente)
            if (lastFoundEntry && lastFoundEntry.entry_type === 'entrada' && !isToday(new Date(lastFoundEntry.timestamp))) {
                const lastEntryDate = new Date(lastFoundEntry.timestamp);
                const correctiveExitDate = new Date(lastEntryDate);
                correctiveExitDate.setHours(23, 59, 59, 999);

                showAlert(
                    '📍 Fichaje Olvidado',
                    `No fichaste la salida el día ${formatDate(lastEntryDate)}.\n\nSe cerrará esa sesión automáticamente para que puedas iniciar hoy.`,
                    'warning',
                    () => handleFichaje('salida', correctiveExitDate),
                    'Entiendo',
                    { showCancelButton: false, cancelable: false }
                );
            }

            // Notificaciones de recordatorio si hay un turno abierto hoy
            if (currentTurn && !currentTurn.salida) {
                scheduleClockOutReminder();
            } else {
                cancelAllNotifications();
            }

        } catch (error) {
            console.error('Error cargando fichajes:', error);
        }
    };

    const handleFichaje = async (type, customTimestamp = null) => {
        // --- 1. GUARDIA ANTI-DOBLE CLIC SÍNCRONA ---
        // Usamos un Ref porque el estado 'loading' es asíncrono y no bloquea clics en el mismo milisegundo.
        if (isClocking.current || loading) return;

        // Marcamos el bloqueo inmediatamente
        isClocking.current = true;
        setLoading(true);

        // Validaciones para turnos partidos
        const currentlyIn = todayTurns.length > 0 && !todayTurns[todayTurns.length - 1].salida;

        if (type === 'entrada' && currentlyIn) {
            showAlert('💡 Aviso', 'Ya estás dentro de un turno. Debes fichar salida primero.', 'info');
            return;
        }

        if (type === 'salida' && !currentlyIn && !customTimestamp) {
            showAlert('💡 Aviso', 'No tienes ninguna entrada activa para cerrar.', 'info');
            return;
        }

        try {
            setLoading(true);

            // --- GEOLOCALIZACIÓN ---
            // Solo pedimos ubicación si no es un fichaje correctivo automático
            let locationData = {};
            if (!customTimestamp) {
                try {
                    const loc = await getCurrentLocation();
                    locationData = {
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                        accuracy: loc.accuracy,
                        device_type: loc.device_type,
                    };
                } catch (locError) {
                    // Bloqueamos el fichaje en CUALQUIER fallo de ubicación:
                    // GPS_DISABLED, PERMISSION_DENIED, LOCATION_UNAVAILABLE
                    showAlert(
                        '📍 Ubicación Requerida',
                        getLocationErrorMessage(locError.message),
                        'warning',
                        null,
                        'Entendido',
                        { showCancelButton: false }
                    );
                    setLoading(false);
                    return; // Bloqueamos el fichaje siempre
                }
            }
            // --- FIN GEOLOCALIZACIÓN ---

            const { data: { user } } = await supabase.auth.getUser();

            // --- 3. ÚLTIMA VALIDACIÓN ANTES DE INSERTAR ---
            // Volvemos a comprobar el estado por si otro proceso terminó justo ahora
            if (type === 'entrada' && (todayTurns.length > 0 && !todayTurns[todayTurns.length - 1].salida)) {
                console.warn('Bloqueo de seguridad: Ya hay una entrada activa detectada justo antes de insertar.');
                setLoading(false);
                isClocking.current = false;
                return;
            }

            const entryData = { user_id: user.id, entry_type: type, ...locationData };

            if (customTimestamp) {
                entryData.timestamp = customTimestamp.toISOString();
            }

            const { error } = await supabase.from('time_entries').insert([entryData]);
            if (error) throw error;

            if (type === 'salida') await cancelAllNotifications();

            showAlert('✨ ¡Excelente!', `Tu ${type} ha sido registrada con éxito.`, 'success');
            await loadTodayEntries(); // Esperamos a que cargue antes de liberar el bloqueo
        } catch (error) {
            showAlert('❌ Ups...', `Hubo un inconveniente: ${error.message}`, 'error');
        } finally {
            setLoading(false);
            isClocking.current = false; // Liberamos el bloqueo síncrono
        }
    };

    return (
        <BackgroundBlur>
            <View style={styles.headerWrapper}>
                <View style={styles.headerContainer}>
                    <View style={styles.headerContent}>
                        <Image
                            source={require('../../assets/logoblanco.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                        <View style={styles.userInfo}>
                            <Text style={styles.welcomeText}>¡Hola!,</Text>
                            <Text style={styles.userName}>{profile?.full_name || 'Usuario'}!</Text>
                            <Text style={styles.dateText}>{formatDate(new Date())}</Text>
                        </View>
                        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
                            <Text style={styles.logoutText}>Salir</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.container}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    <View style={styles.statusCard}>
                        <Text style={styles.cardTitle}>Tus Turnos de Hoy</Text>

                        {todayTurns.length === 0 ? (
                            <Text style={[styles.statusLabel, { textAlign: 'center', marginTop: 10 }]}>
                                No hay registros para hoy
                            </Text>
                        ) : (
                            todayTurns.map((turn, index) => (
                                <View key={index} style={[styles.turnRow, index > 0 && styles.turnBorder]}>
                                    <View style={styles.statusItem}>
                                        <Text style={styles.statusLabel}>Entrada {todayTurns.length > 1 ? `#${index + 1}` : ''}</Text>
                                        <Text style={[styles.statusTime, styles.textSuccess]}>
                                            {formatTime(new Date(turn.entrada.timestamp))}
                                        </Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.statusItem}>
                                        <Text style={styles.statusLabel}>Salida {todayTurns.length > 1 ? `#${index + 1}` : ''}</Text>
                                        <Text style={[styles.statusTime, turn.salida ? styles.textError : styles.textGray]}>
                                            {turn.salida ? formatTime(new Date(turn.salida.timestamp)) : '--:--'}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>

                    <View style={styles.actionsContainer}>
                        <TouchableOpacity
                            onPress={() => handleFichaje('entrada')}
                            disabled={(todayTurns.length > 0 && !todayTurns[todayTurns.length - 1].salida) || loading}
                            style={[
                                styles.actionButton,
                                styles.btnSuccess,
                                ((todayTurns.length > 0 && !todayTurns[todayTurns.length - 1].salida) || loading) && styles.btnDisabled
                            ]}
                        >
                            <Text style={styles.actionButtonTitle}>FICHAR ENTRADA</Text>
                            <Text style={styles.actionButtonSub}>Iniciar nuevo turno</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleFichaje('salida')}
                            disabled={todayTurns.length === 0 || !!todayTurns[todayTurns.length - 1].salida || loading}
                            style={[
                                styles.actionButton,
                                styles.btnError,
                                (todayTurns.length === 0 || !!todayTurns[todayTurns.length - 1].salida || loading) && styles.btnDisabled
                            ]}
                        >
                            <Text style={styles.actionButtonTitle}>FICHAR SALIDA</Text>
                            <Text style={styles.actionButtonSub}>Finalizar turno actual</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
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
        paddingTop: 170,
        paddingHorizontal: 24
    },
    headerWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        alignItems: 'center', // Centra el headerContainer en Web
    },
    headerContainer: {
        width: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingTop: 60,
        paddingBottom: 10,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        width: '100%',
        maxWidth: 500,
        alignSelf: 'center',
    },
    logo: {
        width: 60,
        height: 60,
        borderRadius: 12,
        marginRight: 16
    },
    userInfo: {
        flex: 1
    },
    welcomeText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        fontFamily: 'Comic Sans MS'
    },
    userName: {
        color: 'white',
        fontSize: 22,
        fontFamily: 'Comic Sans MS-Bold'
    },
    dateText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        marginTop: 4,
        fontFamily: 'Comic Sans MS'
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
        maxWidth: 450,
        width: '100%',
        alignSelf: 'center',
    },
    cardTitle: {
        fontSize: 18,
        color: '#374151',
        marginBottom: 16,
        textAlign: 'center',
        fontFamily: 'Comic Sans MS-Bold'
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    turnRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    turnBorder: {
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        marginTop: 8,
    },
    statusItem: {
        flex: 1,
        alignItems: 'center'
    },
    divider: {
        width: 1,
        height: 40,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 16
    },
    statusLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
        fontFamily: 'Comic Sans MS'
    },
    statusTime: {
        fontSize: 24,
        fontFamily: 'Comic Sans MS-Bold'
    },
    textSuccess: {
        color: '#10B981'
    },
    textError: {
        color: '#EF4444'
    },
    textGray: {
        color: '#9CA3AF'
    },
    actionsContainer: {
        paddingTop: 20,
        paddingBottom: 40,
        alignItems: 'center'
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
        width: '100%',
        maxWidth: 450,
        alignSelf: 'center',
    },
    btnSuccess: {
        backgroundColor: '#10B981'
    },
    btnError: {
        backgroundColor: '#EF4444'
    },
    btnDisabled: {
        backgroundColor: '#9CA3AF',
        opacity: 0.6
    },
    actionButtonTitle: {
        color: 'white',
        fontSize: 20,
        marginBottom: 4,
        fontFamily: 'Comic Sans MS-Bold'
    },
    actionButtonSub: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        fontFamily: 'Comic Sans MS'
    },
    logoutButton: {
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 16,
        paddingVertical: 6,
        paddingHorizontal: 12,
        marginBottom: 32,
    },
    logoutText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        fontFamily: 'Comic Sans MS'
    },
});

export default UserDashboard;
