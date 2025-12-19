import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import BackgroundBlur from '../components/BackgroundBlur';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { formatDate, formatTime } from '../utils/helpers';

const AdminDashboard = () => {
    const { profile, signOut, createUser } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [timeEntries, setTimeEntries] = useState([]);
    const [users, setUsers] = useState([]);

    // Estados para filtro de fecha
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        loadTimeEntries();
        loadUsers();
        // Suscribirse a cambios en tiempo real
        const channel = supabase
            .channel('admin_dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
                loadTimeEntries();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedMonth, selectedYear]); // Recargar si cambia el filtro

    const handleCreateUser = async () => {
        if (!email || !password || !fullName) {
            Alert.alert('Error', 'Completa todos los campos');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);
        const result = await createUser(email, password, fullName);
        setLoading(false);

        if (result.success) {
            Alert.alert('Éxito', 'Usuario empleado creado correctamente');
            setEmail('');
            setPassword('');
            setFullName('');
        } else {
            Alert.alert('Error', result.error);
        }
    };

    const loadUsers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('full_name', { ascending: true });

            if (error) throw error;
            setUsers(data || []);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudieron cargar los usuarios');
        } finally {
            setLoading(false);
        }
    };

    const getFilterRange = () => {
        const start = new Date(selectedYear, selectedMonth, 1);
        const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59); // Último día del mes
        return { start: start.toISOString(), end: end.toISOString() };
    };

    const handleExportCSV = async () => {
        try {
            setLoadingEntries(true);
            const { start, end } = getFilterRange();

            const { data, error } = await supabase
                .from('time_entries')
                .select(`
                    id,
                    entry_type,
                    timestamp,
                    profiles:user_id (full_name, email)
                `)
                .gte('timestamp', start)
                .lte('timestamp', end)
                .order('timestamp', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                Alert.alert('Aviso', 'No hay datos para exportar en este periodo');
                setLoadingEntries(false);
                return;
            }

            // CSV Header
            let csvContent = 'ID,Empleado,Email,Tipo,Fecha,Hora\n';

            // CSV Rows
            data.forEach(entry => {
                const date = new Date(entry.timestamp);
                const dateStr = formatDate(date);
                const timeStr = formatTime(date);

                const name = entry.profiles?.full_name?.replace(/,/g, ' ') || 'Desconocido';
                const email = entry.profiles?.email || 'Desconocido';

                csvContent += `${entry.id},${name},${email},${entry.entry_type},${dateStr},${timeStr}\n`;
            });

            const fileName = `fichajes_${selectedMonth + 1}_${selectedYear}.csv`;
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert('Error', 'Compartir no está disponible');
            }

        } catch (error) {
            console.error('Export Error:', error);
            Alert.alert('Error', 'Falló la exportación CSV');
        } finally {
            setLoadingEntries(false);
        }
    };

    const loadTimeEntries = async () => {
        try {
            setLoadingEntries(true);
            const { start, end } = getFilterRange();

            const { data, error } = await supabase
                .from('time_entries')
                .select(`
          *,
          profiles:user_id (full_name, email)
        `)
                .gte('timestamp', start)
                .lte('timestamp', end)
                .order('timestamp', { ascending: false });

            if (error) throw error;
            setTimeEntries(data || []);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudieron cargar los fichajes');
        } finally {
            setLoadingEntries(false);
        }
    };

    return (
        <BackgroundBlur intensity={70}>
            <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Header */}
                <View style={styles.header}>
                    <Image
                        source={require('../../assets/logoblanco.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                    <View>
                        <Text style={styles.title}>Panel Admin</Text>
                        <Text style={styles.subtitle}>{profile?.full_name}</Text>
                    </View>
                    <TouchableOpacity onPress={signOut} style={styles.logoutBtnSmall}>
                        <Text style={styles.logoutTextSm}>Salir</Text>
                    </TouchableOpacity>
                </View>

                {/* Sección: Crear Empleado */}
                <View style={styles.card}>
                    <Text style={styles.cardHeader}>👤 Crear Nuevo Empleado</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Nombre Completo"
                        placeholderTextColor="#9CA3AF"
                        value={fullName}
                        onChangeText={setFullName}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Email Corporativo"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Contraseña (mín 6 caracteres)"
                        placeholderTextColor="#9CA3AF"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry // Ocultar contraseña
                    />

                    <TouchableOpacity
                        onPress={handleCreateUser}
                        disabled={loading}
                        style={styles.createButton}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={styles.createButtonText}>Registrar Empleado</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Sección: Últimos Fichajes */}
                <View style={[styles.card, { marginTop: 20 }]}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.cardHeader}>⏱️ Fichajes</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity onPress={handleExportCSV} style={{ backgroundColor: '#10B981', padding: 6, borderRadius: 6, marginRight: 8 }}>
                                <Text style={{ color: 'white', fontWeight: 'bold' }}>📄 CSV</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={loadTimeEntries}>
                                <Text style={styles.refreshText}>🔄</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Filtro de Mes/Año */}
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 15, backgroundColor: '#F3F4F6', padding: 8, borderRadius: 10 }}>
                        <TouchableOpacity onPress={() => {
                            if (selectedMonth === 0) {
                                setSelectedMonth(11);
                                setSelectedYear(selectedYear - 1);
                            } else {
                                setSelectedMonth(selectedMonth - 1);
                            }
                        }} style={{ padding: 10 }}>
                            <Text style={{ fontSize: 20 }}>◀️</Text>
                        </TouchableOpacity>

                        <Text style={{ fontSize: 16, fontWeight: 'bold', marginHorizontal: 20, minWidth: 150, textAlign: 'center' }}>
                            {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][selectedMonth]} {selectedYear}
                        </Text>

                        <TouchableOpacity onPress={() => {
                            if (selectedMonth === 11) {
                                setSelectedMonth(0);
                                setSelectedYear(selectedYear + 1);
                            } else {
                                setSelectedMonth(selectedMonth + 1);
                            }
                        }} style={{ padding: 10 }}>
                            <Text style={{ fontSize: 20 }}>▶️</Text>
                        </TouchableOpacity>
                    </View>

                    {loadingEntries ? (
                        <ActivityIndicator style={{ marginTop: 20 }} color="#1E3A8A" />
                    ) : (
                        <View>
                            {/* Cabecera Tabla - Fija */}
                            <View style={styles.tableHeader}>
                                <Text style={[styles.th, { flex: 2 }]}>Empleado</Text>
                                <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Tipo</Text>
                                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Hora</Text>
                            </View>

                            {/* Contenido con Scroll */}
                            <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled={true}>
                                {/* Filas */}
                                {timeEntries.map((entry) => (
                                    <View key={entry.id} style={styles.tr}>
                                        <View style={{ flex: 2 }}>
                                            <Text style={styles.tdName}>{entry.profiles?.full_name || 'Desconocido'}</Text>
                                            <Text style={styles.tdDate}>{formatDate(new Date(entry.timestamp))}</Text>
                                        </View>

                                        <View style={{ flex: 1, alignItems: 'center' }}>
                                            <View style={[
                                                styles.badge,
                                                entry.entry_type === 'entrada' ? styles.badgeSuccess : styles.badgeError
                                            ]}>
                                                <Text style={styles.badgeText}>
                                                    {entry.entry_type === 'entrada' ? 'ENT' : 'SAL'}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text style={[styles.tdTime, { flex: 1, textAlign: 'right' }]}>
                                            {formatTime(new Date(entry.timestamp))}
                                        </Text>
                                    </View>
                                ))}

                                {timeEntries.length === 0 && (
                                    <Text style={styles.emptyText}>No hay registros recientes</Text>
                                )}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/*Seccion lista de empleados*/}
                <View style={[styles.card, { marginTop: 20 }]}>
                    <Text style={styles.cardHeader}>👥 Lista de Empleados</Text>
                    {users ? (
                        <View>
                            {/* Cabecera - Fija */}
                            <View style={styles.tableHeader}>
                                <Text style={[styles.th, { flex: 2 }]}>Nombre</Text>
                                <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Email</Text>
                                <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Rol</Text>
                            </View>

                            {/* Contenido con Scroll */}
                            <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled={true}>
                                {users.map((user) => (
                                    <View key={user.id} style={styles.tr}>
                                        <View style={{ flex: 2 }}>
                                            <Text style={styles.tdName}>{user.full_name}</Text>
                                            <Text style={styles.tdEmail}>{user.email}</Text>
                                        </View>
                                        <View style={{ flex: 1, alignItems: 'center' }}>
                                            <Text style={styles.tdRole}>{user.role}</Text>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>No hay usuarios</Text>
                    )}
                </View>
            </ScrollView>
        </BackgroundBlur>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 50,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        justifyContent: 'space-between',
    },
    logo: {
        width: 50,
        height: 50,
        borderRadius: 10,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
    },
    logoutBtnSmall: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
    },
    logoutTextSm: {
        color: 'white',
        fontWeight: '600',
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 16,
    },
    input: {
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        color: '#1F2937',
    },
    createButton: {
        backgroundColor: '#1E3A8A',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    createButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },

    // Tabla
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    refreshText: {
        color: '#3B82F6',
        fontWeight: '600',
    },
    table: {
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 8,
        marginBottom: 8,
    },
    th: {
        fontWeight: 'bold',
        color: '#6B7280',
        fontSize: 12,
        textTransform: 'uppercase',
    },
    tr: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    tdName: {
        fontWeight: '600',
        color: '#111827',
        fontSize: 14,
    },
    tdDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    tdTime: {
        fontWeight: 'bold',
        color: '#374151',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        minWidth: 50,
        alignItems: 'center',
    },
    badgeSuccess: { backgroundColor: '#D1FAE5' }, // Verde claro
    badgeError: { backgroundColor: '#FEE2E2' },   // Rojo claro
    badgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: 'black',
    },
    emptyText: {
        textAlign: 'center',
        color: '#9CA3AF',
        paddingVertical: 20,
    },
});

export default AdminDashboard;
