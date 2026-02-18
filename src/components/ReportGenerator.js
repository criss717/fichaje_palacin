import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../config/supabase';
import { formatDate, formatTime } from '../utils/helpers';
import CustomAlert from './CustomAlert';

const ReportGenerator = ({ users = [] }) => {
    const [loading, setLoading] = useState(false);
    const [selectedUser, setSelectedUser] = useState({ id: 'all', full_name: 'Todos' });
    const [selectedMonth, setSelectedMonth] = useState({ id: 'all', name: 'Todos' });
    const [selectedYear, setSelectedYear] = useState({ id: new Date().getFullYear().toString(), name: new Date().getFullYear().toString() });
    const [modalVisible, setModalVisible] = useState(null);

    // Estado para Alerta Personalizada
    const [alertConfig, setAlertConfig] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showAlert = (title, message, type = 'info') => {
        setAlertConfig({ visible: true, title, message, type });
    };

    const months = [
        { id: 'all', name: 'Todos' },
        { id: '0', name: 'Enero' }, { id: '1', name: 'Febrero' }, { id: '2', name: 'Marzo' },
        { id: '3', name: 'Abril' }, { id: '4', name: 'Mayo' }, { id: '5', name: 'Junio' },
        { id: '6', name: 'Julio' }, { id: '7', name: 'Agosto' }, { id: '8', name: 'Septiembre' },
        { id: '9', name: 'Octubre' }, { id: '10', name: 'Noviembre' }, { id: '11', name: 'Diciembre' }
    ];

    const currentYear = new Date().getFullYear();
    const years = [
        { id: 'all', name: 'Todos' },
        { id: currentYear.toString(), name: currentYear.toString() },
        { id: (currentYear - 1).toString(), name: (currentYear - 1).toString() },
    ];

    const handleExport = async () => {
        try {
            setLoading(true);
            let query = supabase.from('time_entries').select(`id, entry_type, timestamp, latitude, longitude, accuracy, device_type, profiles:user_id (full_name, email)`);

            if (selectedUser.id !== 'all') query = query.eq('user_id', selectedUser.id);

            if (selectedYear.id !== 'all') {
                if (selectedMonth.id !== 'all') {
                    const start = new Date(parseInt(selectedYear.id), parseInt(selectedMonth.id), 1);
                    const end = new Date(parseInt(selectedYear.id), parseInt(selectedMonth.id) + 1, 0, 23, 59, 59);
                    query = query.gte('timestamp', start.toISOString()).lte('timestamp', end.toISOString());
                } else {
                    const start = new Date(parseInt(selectedYear.id), 0, 1);
                    const end = new Date(parseInt(selectedYear.id), 11, 31, 23, 59, 59);
                    query = query.gte('timestamp', start.toISOString()).lte('timestamp', end.toISOString());
                }
            } else if (selectedMonth.id !== 'all') {
                showAlert('Aviso', 'Por favor selecciona un año específico para filtrar por mes.', 'warning');
                setLoading(false);
                return;
            }

            const { data, error } = await query.order('timestamp', { ascending: false });
            if (error) throw error;

            if (!data || data.length === 0) {
                showAlert('📂 Sin Datos', 'No encontramos registros con los filtros seleccionados.', 'info');
                setLoading(false);
                return;
            }

            const BOM = '\uFEFF';
            let csvContent = BOM + '"Empleado";"Tipo";"Fecha";"Hora";"Latitud";"Longitud";"Precisión (m)";"Dispositivo";"Ver en Mapa"\n';
            data.forEach(entry => {
                const date = new Date(entry.timestamp);
                const type = entry.entry_type === 'entrada' ? 'ENTRADA' : 'SALIDA';
                const lat = entry.latitude != null ? entry.latitude.toFixed(6) : '';
                const lng = entry.longitude != null ? entry.longitude.toFixed(6) : '';
                const accuracy = entry.accuracy != null ? Math.round(entry.accuracy) : '';
                const device = entry.device_type || '';
                const mapUrl = entry.latitude && entry.longitude
                    ? `https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`
                    : '';
                csvContent += `"${entry.profiles?.full_name || 'Desconocido'}";"${type}";"${formatDate(date)}";"${formatTime(date)}";"${lat}";"${lng}";"${accuracy}";"${device}";"${mapUrl}"\n`;
            });

            const fileName = `Informe_${selectedUser.full_name.replace(/\s/g, '_')}_${selectedYear.name}.csv`;

            if (Platform.OS === 'web') {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                showAlert('✅ Éxito', 'Informe descargado correctamente.', 'success');
            } else {
                const fileUri = FileSystem.documentDirectory + fileName;
                await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri);
                } else {
                    showAlert('⚠️ Error', 'Compartir no está disponible en este dispositivo.', 'error');
                }
            }
        } catch (error) {
            console.error('Export Error:', error);
            showAlert('❌ Error', 'Falló la generación del informe.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const renderSelector = (label, value, type) => (
        <View style={styles.selectorContainer}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setModalVisible(type)}>
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
                <View style={{ flex: 1, marginRight: 8 }}>{renderSelector('Mes:', selectedMonth.name, 'month')}</View>
                <View style={{ flex: 1, marginLeft: 8 }}>{renderSelector('Año:', selectedYear.name, 'year')}</View>
            </View>
            <View style={styles.buttonContainer}>
                <TouchableOpacity style={[styles.exportButton, loading && styles.disabled]} onPress={handleExport} disabled={loading}>
                    {loading ? <ActivityIndicator color="white" /> : <Text style={styles.exportButtonText}>📥 Descargar Excel (CSV) 📃</Text>}
                </TouchableOpacity>
            </View>

            <Modal transparent={true} visible={modalVisible !== null} animationType="fade" onRequestClose={() => setModalVisible(null)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(null)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Seleccionar...</Text>
                        <FlatList
                            data={modalVisible === 'user' ? [{ id: 'all', full_name: 'Todos' }, ...users] : modalVisible === 'month' ? months : years}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.optionItem} onPress={() => {
                                    if (modalVisible === 'user') setSelectedUser(item);
                                    if (modalVisible === 'month') setSelectedMonth(item);
                                    if (modalVisible === 'year') setSelectedYear(item);
                                    setModalVisible(null);
                                }}>
                                    <Text style={styles.optionText}>{item.full_name || item.name}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>

            <CustomAlert
                {...alertConfig}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
        width: '100%',
        maxWidth: 1400,
        alignSelf: 'center',
        fontFamily: 'Comic Sans MS',
    },
    title: { fontSize: 18, color: '#374151', marginBottom: 20, textAlign: 'center', fontFamily: 'Comic Sans MS-Bold' },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    selectorContainer: { marginBottom: 16 },
    label: { fontSize: 14, color: '#6B7280', marginBottom: 8, fontFamily: 'Comic Sans MS-Bold' },
    pickerButton: {
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    pickerButtonText: { fontSize: 15, color: '#1F2937', fontFamily: 'Comic Sans MS' },
    chevron: { color: '#9CA3AF', fontSize: 12 },
    exportButton: {
        backgroundColor: '#1E3A8A',
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
        width: 260
    },
    buttonContainer: { alignItems: 'center', marginTop: 10, width: '100%', fontFamily: 'Comic Sans MS' },
    exportButtonText: { color: 'white', fontSize: 15, fontFamily: 'Comic Sans MS-Bold', width: '100%' },
    disabled: { backgroundColor: '#9CA3AF', opacity: 0.7 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 40 },
    modalContent: { backgroundColor: 'white', borderRadius: 20, maxHeight: '70%', padding: 20 },
    modalTitle: { fontSize: 18, marginBottom: 15, color: '#1F2937', fontFamily: 'Comic Sans MS-Bold' },
    optionItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    optionText: { fontSize: 16, color: '#374151', fontFamily: 'Comic Sans MS' }
});

export default ReportGenerator;
