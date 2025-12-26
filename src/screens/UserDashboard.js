import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BackgroundBlur from '../components/BackgroundBlur';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { formatDate, formatTime, isToday } from '../utils/helpers';
import { registerForPushNotificationsAsync, scheduleClockOutReminder, cancelAllNotifications } from '../utils/notifications';
import CustomAlert from '../components/CustomAlert';

const UserDashboard = () => {
    const { profile, signOut } = useAuth();
    const [todayEntries, setTodayEntries] = useState({ entrada: null, salida: null });
    const [loading, setLoading] = useState(false);

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
                .limit(5);

            if (error) throw error;

            if (data.length > 0) {
                const lastEntry = data[0];
                const lastEntryDate = new Date(lastEntry.timestamp);

                if (lastEntry.entry_type === 'entrada' && !isToday(lastEntryDate)) {
                    const correctiveExitDate = new Date(lastEntryDate);
                    correctiveExitDate.setHours(23, 59, 59, 999);

                    const diffMs = new Date() - lastEntryDate;
                    const diffHours = diffMs / (1000 * 60 * 60);

                    if (diffHours > 10) {
                        showAlert(
                            '🚀 Jornada Prolongada',
                            `Tu última entrada fue el ${formatDate(lastEntryDate)} a las ${formatTime(lastEntryDate)}.\n\nHan pasado más de 10 horas. Se cerrará esta sesión a las 23:59 de ese día para que puedas fichar hoy, pero deberías hablar con administración para validar las horas correctas. `,
                            'warning',
                            () => handleFichaje('salida', correctiveExitDate),
                            'Entiendo',
                            { showCancelButton: false, cancelable: false }
                        );
                    } else {
                        showAlert(
                            '📍 Fichaje Olvidado',
                            `No fichaste la salida el día ${formatDate(lastEntryDate)}.\n\nSe cerrará esa sesión a las 23:59 de ese día para que puedas iniciar tu jornada de hoy.`,
                            'warning',
                            () => handleFichaje('salida', correctiveExitDate),
                            'Entiendo',
                            { showCancelButton: false, cancelable: false }
                        );
                    }
                }
            }

            const entradaHoy = data.find(e => e.entry_type === 'entrada' && isToday(new Date(e.timestamp)));
            const salidaHoy = data.find(e =>
                e.entry_type === 'salida' &&
                isToday(new Date(e.timestamp)) &&
                (!entradaHoy || new Date(e.timestamp) > new Date(entradaHoy.timestamp))
            );

            setTodayEntries({
                entrada: entradaHoy,
                salida: salidaHoy
            });

            if (entradaHoy && !salidaHoy) {
                scheduleClockOutReminder();
            } else {
                cancelAllNotifications();
            }

        } catch (error) {
            console.error('Error cargando fichajes:', error);
        }
    };

    const handleFichaje = async (type, customTimestamp = null) => {
        if (type === 'entrada' && todayEntries.entrada) {
            showAlert('💡 Aviso', 'Ya registraste tu entrada por hoy.', 'info');
            return;
        }

        if (type === 'salida' && todayEntries.salida && !customTimestamp) {
            showAlert('💡 Aviso', 'Ya registraste tu salida por hoy.', 'info');
            return;
        }

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            const entryData = { user_id: user.id, entry_type: type };

            if (customTimestamp) {
                entryData.timestamp = customTimestamp.toISOString();
            }

            const { error } = await supabase.from('time_entries').insert([entryData]);
            if (error) throw error;

            if (type === 'salida') await cancelAllNotifications();

            showAlert('✨ ¡Excelente!', `Tu ${type} ha sido registrada con éxito. ¡Que tengas un gran día!`, 'success');
            loadTodayEntries();
        } catch (error) {
            showAlert('❌ Ups...', `Hubo un inconveniente: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <BackgroundBlur intensity={70}>
            <View style={styles.headerWrapper}>
                <View style={styles.headerContainer}>
                    <View style={styles.headerContent}>
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
                        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
                            <Text style={styles.logoutText}>Salir</Text>
                        </TouchableOpacity>
                    </View>
                    <LinearGradient
                        colors={['rgba(0, 0, 0, 0.5)', 'transparent']}
                        style={{ position: 'absolute', left: 0, right: 0, bottom: -10, height: 10 }}
                    />
                </View>
            </View>

            <View style={styles.container}>
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

                <View style={styles.actionsContainer}>
                    <TouchableOpacity
                        onPress={() => handleFichaje('entrada')}
                        disabled={!!todayEntries.entrada || loading}
                        style={[styles.actionButton, styles.btnSuccess, (todayEntries.entrada || loading) && styles.btnDisabled]}
                    >
                        <Text style={styles.actionButtonTitle}>FICHAR ENTRADA</Text>
                        <Text style={styles.actionButtonSub}>Registrar inicio de jornada</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleFichaje('salida')}
                        disabled={!todayEntries.entrada || !!todayEntries.salida || loading}
                        style={[styles.actionButton, styles.btnError, (!todayEntries.entrada || todayEntries.salida || loading) && styles.btnDisabled]}
                    >
                        <Text style={styles.actionButtonTitle}>FICHAR SALIDA</Text>
                        <Text style={styles.actionButtonSub}>Registrar fin de jornada</Text>
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
        flex: 1,
        justifyContent: 'center',
        marginTop: -70,
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
