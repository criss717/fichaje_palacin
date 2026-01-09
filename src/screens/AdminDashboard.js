import React, { useState, useEffect } from 'react';
import { View, Text, Modal, FlatList, TouchableOpacity, Image, TextInput, ScrollView, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native';
import BackgroundBlur from '../components/BackgroundBlur';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { formatDate, formatTime } from '../utils/helpers';
import ReportGenerator from '../components/ReportGenerator';
import CustomAlert from '../components/CustomAlert';

const AdminDashboard = () => {
    const { profile, signOut, createUser } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [timeEntries, setTimeEntries] = useState([]);
    const [users, setUsers] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState({ id: 'all', full_name: 'Todos los empleados' });

    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Estado para Alerta Personalizada
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        confirmText: 'Confirmar'
    });

    const showAlert = (title, message, type = 'info', onConfirm = null, confirmText = 'Confirmar') => {
        setAlertConfig({ visible: true, title, message, type, onConfirm, confirmText });
    };

    useEffect(() => {
        loadTimeEntries();
        loadUsers();
        const channel = supabase
            .channel('admin_dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries' }, () => {
                loadTimeEntries();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedMonth, selectedYear, selectedUser]);

    const handleCreateUser = async () => {
        if (!email || !password || !fullName) {
            showAlert('❌ Datos Incompletos', 'Por favor, rellena todos los campos para continuar.', 'warning');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            showAlert('📧 Email Inválido', 'Asegúrate de que el correo tenga un formato correcto.', 'error');
            return;
        }

        if (password.length < 6) {
            showAlert('🔑 Seguridad', 'La contraseña es muy corta. Usa al menos 6 caracteres.', 'warning');
            return;
        }

        setLoading(true);
        const result = await createUser(email.trim(), password, fullName);
        setLoading(false);

        if (result.success) {
            showAlert('✨ ¡Usuario Creado!', 'El nuevo miembro del equipo ha sido registrado con éxito.', 'success');
            setEmail('');
            setPassword('');
            setFullName('');
            loadUsers();
        } else {
            showAlert('❌ Error de Registro', `No pudimos crear el usuario: ${result.error}`, 'error');
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
            showAlert('🔎 Error de Red', 'No logramos obtener la lista de empleados.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const getFilterRange = () => {
        const start = new Date(selectedYear, selectedMonth, 1);
        const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
        return { start: start.toISOString(), end: end.toISOString() };
    };

    const loadTimeEntries = async () => {
        try {
            setLoadingEntries(true);
            const { start, end } = getFilterRange();

            let query = supabase
                .from('time_entries')
                .select(`
                    id,
                    entry_type,
                    timestamp,
                    profiles:user_id (full_name, email)
                `)
                .gte('timestamp', start)
                .lte('timestamp', end)
                .order('timestamp', { ascending: false })
                .limit(100);

            if (selectedUser.id !== 'all') {
                query = query.eq('user_id', selectedUser.id);
            }

            const { data, error } = await query;

            if (error) throw error;
            setTimeEntries(data || []);
        } catch (error) {
            console.error(error);
            showAlert('🕒 Error al Cargar', 'No pudimos actualizar la lista de fichajes.', 'error');
        } finally {
            setLoadingEntries(false);
        }
    };

    const { width } = useWindowDimensions();
    const isWide = width > 670;
    const cardStyle = [styles.card, isWide && { width: '48.5%', maxWidth: 'none', alignSelf: 'auto' }];

    return (
        <BackgroundBlur>
            <View style={styles.headerWrapper}>
                <View style={styles.headerContainer}>
                    <View style={styles.headerContent}>
                        <Image source={require('../../assets/logoblanco.png')} style={styles.logo} resizeMode="contain" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.title}>Panel Admin</Text>
                            <Text style={styles.subtitle}>{profile?.full_name}</Text>
                        </View>
                        <TouchableOpacity onPress={signOut} style={styles.logoutBtnSmall}>
                            <Text style={styles.logoutTextSm}>Salir</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={[styles.mainWrapper, { flexDirection: isWide ? 'row' : 'column' }]}>

                    {/* Tarjeta 1: Crear Empleado */}
                    <View style={cardStyle}>
                        <Text style={styles.cardHeader}>👤 Crear Nuevo Empleado</Text>
                        <TextInput style={styles.input} placeholder="Nombre Completo" placeholderTextColor="#9CA3AF" value={fullName} onChangeText={setFullName} />
                        <TextInput style={styles.input} placeholder="Email Corporativo" placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail} autoCapitalize="none" />
                        <TextInput style={styles.input} placeholder="Contraseña (mín 6 caracteres)" placeholderTextColor="#9CA3AF" value={password} onChangeText={setPassword} secureTextEntry />

                        <TouchableOpacity onPress={handleCreateUser} disabled={loading} style={styles.createButton}>
                            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.createButtonText}>Registrar Empleado</Text>}
                        </TouchableOpacity>
                    </View>

                    {/* Tarjeta 2: ReportGenerator (Ancho completo si es posible o 48% si se ajusta) 
                        NOTA: ReportGenerator tiene su propio estilo container. En grid layout, queremos que ocupe una celda.
                        Si queremos 2 columnas: 1 y 2 arriba, 3 y 4 abajo.
                    */}
                    <View style={[cardStyle, { padding: 0, margin: 0 }]} >
                        <ReportGenerator users={users} />
                    </View>

                    {/* Tarjeta 3: Últimos Fichajes */}
                    <View style={cardStyle}>
                        <View style={styles.rowBetween}>
                            <Text style={[styles.cardHeader, { marginBottom: 0 }]}>⏱️ Fichajes</Text>
                            <TouchableOpacity onPress={loadTimeEntries}>
                                <Text style={styles.refreshText}>🔄 Actualizar Lista</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.filterContainer}>
                            <TouchableOpacity onPress={() => {
                                if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
                                else { setSelectedMonth(selectedMonth - 1); }
                            }} style={{ padding: 10 }}><Text style={{ fontSize: 20 }}>◀️</Text></TouchableOpacity>

                            <Text style={styles.filterText}>
                                {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][selectedMonth]} {selectedYear}
                            </Text>

                            <TouchableOpacity onPress={() => {
                                if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
                                else { setSelectedMonth(selectedMonth + 1); }
                            }} style={{
                                padding: 10,
                            }}><Text style={{ fontSize: 20 }}>▶️</Text></TouchableOpacity>
                        </View>

                        {/* lista de empleados para filtrar select */}
                        <View style={styles.filterContainer}>
                            <TouchableOpacity style={styles.pickerButton} onPress={() => setModalVisible(true)}>
                                <Text style={styles.filterText}>{selectedUser?.full_name || 'Seleccionar Empleados'}</Text>
                                <Text style={styles.chevron}>▼</Text>
                            </TouchableOpacity>
                        </View>
                        <Modal transparent={true} visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
                            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
                                <View style={styles.modalContent}>
                                    <View style={styles.modalHeader}>
                                        <Text style={styles.modalTitle}>Filtrar por Empleado</Text>
                                        <TouchableOpacity onPress={() => setModalVisible(false)}>
                                            <Text style={styles.modalClose}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <FlatList
                                        data={[{ id: 'all', full_name: 'Todos los empleados' }, ...users]}
                                        keyExtractor={(item) => item.id.toString()}
                                        style={{ maxHeight: 400 }}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={[
                                                    styles.optionItem,
                                                    selectedUser.id === item.id && styles.optionItemSelected
                                                ]}
                                                onPress={() => {
                                                    setSelectedUser(item);
                                                    setModalVisible(false);
                                                }}
                                            >
                                                <Text style={[
                                                    styles.optionText,
                                                    selectedUser.id === item.id && styles.optionTextSelected
                                                ]}>
                                                    {item.full_name}
                                                </Text>
                                                {selectedUser.id === item.id && <Text style={styles.checkIcon}>✓</Text>}
                                            </TouchableOpacity>
                                        )}
                                    />
                                </View>
                            </TouchableOpacity>
                        </Modal>

                        {loadingEntries ? (
                            <ActivityIndicator style={{ marginTop: 20 }} color="#1E3A8A" />
                        ) : (
                            <View>
                                <View style={styles.tableHeader}>
                                    <Text style={[styles.th, { flex: 2 }]}>Empleado</Text>
                                    <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Tipo</Text>
                                    <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>Hora</Text>
                                </View>
                                <ScrollView style={{ maxHeight: isWide ? 750 : 400 }} nestedScrollEnabled={true}>
                                    {timeEntries.map((entry) => (
                                        <View key={entry.id} style={styles.tr}>
                                            <View style={{ flex: 2 }}>
                                                <Text style={styles.tdName}>{entry.profiles?.full_name || 'Desconocido'}</Text>
                                                <Text style={styles.tdDate}>{formatDate(new Date(entry.timestamp))}</Text>
                                            </View>
                                            <View style={{ flex: 1, alignItems: 'center' }}>
                                                <View style={[styles.badge, entry.entry_type === 'entrada' ? styles.badgeSuccess : styles.badgeError]}>
                                                    <Text style={styles.badgeText}>{entry.entry_type === 'entrada' ? 'ENT' : 'SAL'}</Text>
                                                </View>
                                            </View>
                                            <Text style={[styles.tdTime, { flex: 1, textAlign: 'right' }]}>{formatTime(new Date(entry.timestamp))}</Text>
                                        </View>
                                    ))}
                                    {timeEntries.length === 0 && <Text style={styles.emptyText}>No hay registros recientes</Text>}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* Tarjeta 4: Lista de Empleados */}
                    <View style={[cardStyle, !isWide && { marginBottom: 20 }]}>
                        <Text style={styles.cardHeader}>👥 Lista de Empleados</Text>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { flex: 2 }]}>Nombre</Text>
                            <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Email</Text>
                            <Text style={[styles.th, { flex: 1, textAlign: 'center' }]}>Rol</Text>
                        </View>
                        <ScrollView style={{ maxHeight: isWide ? 750 : 450 }} nestedScrollEnabled={true}>
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

                </View>
            </ScrollView>

            <CustomAlert
                {...alertConfig}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </BackgroundBlur>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        paddingTop: 130,
        paddingBottom: 40,
    },
    mainWrapper: {
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        gap: 20,
        maxWidth: 1300,
        alignSelf: 'center',
        width: '100%'
    },
    container: {
        flex: 1,
    },
    headerWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        alignItems: 'center', // Centra el headerContainer en Web/Tablet
    },
    headerContainer: {
        width: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingTop: 50,
        paddingBottom: 15,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        width: '100%',
        maxWidth: 1300,
        alignSelf: 'center',
    },
    logo: {
        width: 50,
        height: 50,
        borderRadius: 10
    },
    title: {
        fontSize: 20,
        color: 'white',
        fontFamily: 'Comic Sans MS-Bold'
    },
    subtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        fontFamily: 'Comic Sans MS'
    },
    logoutBtnSmall: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16
    },
    logoutTextSm: {
        color: 'white',
        fontFamily: 'Comic Sans MS-Bold'
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        padding: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        width: '100%',
        maxWidth: 1300,
        alignSelf: 'center'
    },
    cardHeader: {
        fontSize: 18,
        color: '#1F2937',
        marginBottom: 16,
        alignSelf: 'center',
        fontFamily: 'Comic Sans MS-Bold'
    },
    input: {
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        color: '#1F2937',
        width: '100%',
        fontFamily: 'Comic Sans MS'
    },
    createButton: {
        backgroundColor: '#1E3A8A',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
        width: 250,
        alignSelf: 'center'
    },
    createButtonText: {
        color: 'white',
        fontSize: 16,
        fontFamily: 'Comic Sans MS-Bold'
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    refreshText: {
        color: '#3B82F6',
        fontFamily: 'Comic Sans MS-Bold'
    },
    filterContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
        backgroundColor: '#F3F4F6',
        padding: 8,
        borderRadius: 10,
    },
    filterText: {
        fontSize: 16,
        marginHorizontal: 20,
        minWidth: 150,
        textAlign: 'center',
        fontFamily: 'Comic Sans MS-Bold',
    },
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 8,
        marginBottom: 8
    },
    th: {
        color: '#6B7280',
        fontSize: 12,
        textTransform: 'uppercase',
        fontFamily: 'Comic Sans MS-Bold'
    },
    tr: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6'
    },
    tdName: {
        color: '#111827',
        fontSize: 14,
        fontFamily: 'Comic Sans MS-Bold'
    },
    tdDate: {
        fontSize: 12,
        color: '#9CA3AF',
        fontFamily: 'Comic Sans MS'
    },
    tdTime: {
        color: '#374151',
        fontFamily: 'Comic Sans MS-Bold'
    },
    tdEmail: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'Comic Sans MS'
    },
    tdRole: {
        fontSize: 12,
        color: '#374151',
        // fontWeight: '500', // Removed to avoid font conflict
        fontFamily: 'Comic Sans MS'
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        minWidth: 50,
        alignItems: 'center'
    },
    badgeSuccess: {
        backgroundColor: '#D1FAE5'
    },
    badgeError: {
        backgroundColor: '#FEE2E2'
    },
    badgeText: {
        fontSize: 10,
        color: 'black',
        fontFamily: 'Comic Sans MS-Bold'
    },
    emptyText: {
        textAlign: 'center',
        color: '#9CA3AF',
        paddingVertical: 20,
        fontFamily: 'Comic Sans MS'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        width: '100%',
        maxWidth: 400,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingBottom: 10
    },
    modalTitle: {
        fontSize: 18,
        fontFamily: 'Comic Sans MS-Bold',
        color: '#1F2937'
    },
    modalClose: {
        fontSize: 20,
        color: '#9CA3AF',
        padding: 5
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 10,
        borderRadius: 10,
        marginBottom: 5
    },
    optionItemSelected: {
        backgroundColor: '#EFF6FF'
    },
    optionText: {
        fontSize: 16,
        fontFamily: 'Comic Sans MS',
        color: '#374151'
    },
    optionTextSelected: {
        color: '#1E3A8A',
        fontFamily: 'Comic Sans MS-Bold'
    },
    checkIcon: {
        color: '#1E3A8A',
        fontSize: 18
    },
    chevron: {
        color: '#9CA3AF',
        fontSize: 12
    },
    pickerButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB'
    },
});


export default AdminDashboard;
