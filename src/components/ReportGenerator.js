import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../config/supabase';
import { formatDate, formatTime } from '../utils/helpers';

const ReportGenerator = ({ users = [] }) => {
    const [loading, setLoading] = useState(false);

    // Estados de Filtros
    const [selectedUser, setSelectedUser] = useState({ id: 'all', full_name: 'Todos los empleados' });
    const [selectedMonth, setSelectedMonth] = useState({ id: 'all', name: 'Todos los meses' });
    const [selectedYear, setSelectedYear] = useState({ id: new Date().getFullYear().toString(), name: new Date().getFullYear().toString() });

    // Estados para Modales de Selección
    const [modalVisible, setModalVisible] = useState(null); // 'user', 'month', 'year'

    const months = [
        { id: 'all', name: 'Todos los meses' },
        { id: '0', name: 'Enero' }, { id: '1', name: 'Febrero' }, { id: '2', name: 'Marzo' },
        { id: '3', name: 'Abril' }, { id: '4', name: 'Mayo' }, { id: '5', name: 'Junio' },
        { id: '6', name: 'Julio' }, { id: '7', name: 'Agosto' }, { id: '8', name: 'Septiembre' },
        { id: '9', name: 'Octubre' }, { id: '10', name: 'Noviembre' }, { id: '11', name: 'Diciembre' }
    ];

    const currentYear = new Date().getFullYear();
    const years = [
        { id: 'all', name: 'Todos los años' },
        { id: currentYear.toString(), name: currentYear.toString() },
        { id: (currentYear - 1).toString(), name: (currentYear - 1).toString() },
    ];

    const handleExport = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('time_entries')
                .select(`
                    id,
                    entry_type,
                    timestamp,
                    profiles:user_id (full_name, email)
                `);

            // Aplicar Filtro Empleado
            if (selectedUser.id !== 'all') {
                query = query.eq('user_id', selectedUser.id);
            }

            // Aplicar Filtro Año/Mes
            if (selectedYear.id !== 'all') {
                if (selectedMonth.id !== 'all') {
                    // Mes específico de un año específico
                    const start = new Date(parseInt(selectedYear.id), parseInt(selectedMonth.id), 1);
                    const end = new Date(parseInt(selectedYear.id), parseInt(selectedMonth.id) + 1, 0, 23, 59, 59);
                    query = query.gte('timestamp', start.toISOString()).lte('timestamp', end.toISOString());
                } else {
                    // Todo el año seleccionado
                    const start = new Date(parseInt(selectedYear.id), 0, 1);
                    const end = new Date(parseInt(selectedYear.id), 11, 31, 23, 59, 59);
                    query = query.gte('timestamp', start.toISOString()).lte('timestamp', end.toISOString());
                }
            } else if (selectedMonth.id !== 'all') {
                // Mes específico de CUALQUIER año (un poco raro pero lo permitimos)
                // Nota: Supabase no tiene un filtro directo de 'month' sin año, 
                // pero por ahora simplificamos a que si elige mes, el año 'all' se comporte como año actual o pida año.
                Alert.alert('Aviso', 'Por favor selecciona un año específico para filtrar por mes.');
                setLoading(false);
                return;
            }

            const { data, error } = await query.order('timestamp', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                Alert.alert('📂 Sin Datos', 'No encontramos registros con los filtros seleccionados.');
                setLoading(false);
                return;
            }

            // Generar CSV mejorado con BOM y separador ;
            const BOM = '\uFEFF';
            let csvContent = BOM + '"Empleado";"Tipo";"Fecha";"Hora"\n';

            data.forEach(entry => {
                const date = new Date(entry.timestamp);
                const dateStr = formatDate(date);
                const timeStr = formatTime(date);
                const name = entry.profiles?.full_name || 'Desconocido';
                const type = entry.entry_type === 'entrada' ? 'ENTRADA' : 'SALIDA';

                csvContent += `"${name}";"${type}";"${dateStr}";"${timeStr}"\n`;
            });

            const fileName = `Informe_${selectedUser.full_name.replace(/\s/g, '_')}_${selectedMonth.name}_${selectedYear.name}.csv`;
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(fileUri);
            } else {
                Alert.alert('⚠️ Error', 'Compartir no está disponible');
            }

        } catch (error) {
            console.error('Export Error:', error);
            Alert.alert('❌ Error', 'Falló la generación del informe.');
        } finally {
            setLoading(false);
        }
    };

    const renderSelector = (label, value, type) => (
        <View style={styles.selectorContainer}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setModalVisible(type)}
            >
                <Text style={styles.pickerButtonText}>{value}</Text>
                <Text style={styles.chevron}>▼</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>📊 Generador de Informes</Text>

            {renderSelector('Empleado:', selectedUser.full_name, 'user')}
            <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                    {renderSelector('Mes:', selectedMonth.name, 'month')}
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                    {renderSelector('Año:', selectedYear.name, 'year')}
                </View>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.exportButton, loading && styles.disabled]}
                    onPress={handleExport}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.exportButtonText}>📥 Descargar Excel (CSV) 📃</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* Modal de Selección */}
            <Modal
                transparent={true}
                visible={modalVisible !== null}
                animationType="fade"
                onRequestClose={() => setModalVisible(null)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setModalVisible(null)}
                >
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Seleccionar...</Text>
                        <FlatList
                            data={
                                modalVisible === 'user' ? [{ id: 'all', full_name: 'Todos los empleados' }, ...users] :
                                    modalVisible === 'month' ? months :
                                        years
                            }
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.optionItem}
                                    onPress={() => {
                                        if (modalVisible === 'user') setSelectedUser(item);
                                        if (modalVisible === 'month') setSelectedMonth(item);
                                        if (modalVisible === 'year') setSelectedYear(item);
                                        setModalVisible(null);
                                    }}
                                >
                                    <Text style={styles.optionText}>{item.full_name || item.name}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 20,
        padding: 20,
        marginTop: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1E3A8A',
        marginBottom: 20,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    selectorContainer: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
        fontWeight: '600',
    },
    pickerButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    pickerButtonText: {
        fontSize: 15,
        color: '#1F2937',
    },
    chevron: {
        color: '#9CA3AF',
        fontSize: 12,
    },
    exportButton: {
        backgroundColor: '#1E3A8A', // Azul corporativo
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        shadowColor: '#1E3A8A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
    },
    buttonContainer: {
        alignItems: 'center',
        marginTop: 10,
    },
    exportButtonText: {
        color: 'white',
        fontSize: 15,
        fontWeight: 'bold',
    },
    disabled: {
        backgroundColor: '#9CA3AF',
        opacity: 0.7,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 40,
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        maxHeight: '70%',
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#1F2937',
    },
    optionItem: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    optionText: {
        fontSize: 16,
        color: '#374151',
    }
});

export default ReportGenerator;
