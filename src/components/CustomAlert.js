import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const CustomAlert = ({
    visible,
    title,
    message,
    type = 'info',
    onClose,
    onConfirm,
    confirmText = 'Aceptar',
    cancelText = 'Ok',
    autoClose = false,
    autoCloseDuration = 3000,
    showCancelButton = true,
    cancelable = true,
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]).start();

            if (autoClose) {
                const timer = setTimeout(() => {
                    handleClose();
                }, autoCloseDuration);
                return () => clearTimeout(timer);
            }
        } else {
            fadeAnim.setValue(0);
            slideAnim.setValue(50);
        }
    }, [visible]);

    const handleClose = () => {
        if (!cancelable && visible) return; // Prevent closing if non-cancelable

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 50,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            if (onClose) onClose();
        });
    };

    if (!visible) return null;

    const getTheme = () => {
        switch (type) {
            case 'success':
                return { color: '#10B981', icon: '✨' };
            case 'error':
                return { color: '#EF4444', icon: '❌' };
            case 'warning':
                return { color: '#F59E0B', icon: '⚠️' };
            default:
                return { color: '#1E3A8A', icon: 'ℹ️' };
        }
    };

    const theme = getTheme();

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={cancelable ? handleClose : () => { }}
        >
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.alertBox,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }]
                        }
                    ]}
                >
                    <View style={[styles.iconContainer, { backgroundColor: theme.color + '20' }]}>
                        <Text style={[styles.icon, { color: theme.color }]}>{theme.icon}</Text>
                    </View>

                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    {!autoClose && (
                        <View style={styles.buttonContainer}>
                            {showCancelButton && onConfirm && (
                                <TouchableOpacity
                                    style={[styles.button, styles.cancelButton, { borderColor: theme.color }]}
                                    onPress={handleClose}
                                >
                                    <Text style={[styles.buttonText, { color: theme.color }]}>Cancelar</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: theme.color }]}
                                onPress={onConfirm ? () => { onConfirm(); handleClose(); } : handleClose}
                            >
                                <Text style={styles.buttonText}>{onConfirm ? confirmText : cancelText}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    alertBox: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        width: Math.min(width - 30, 400),
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 15,
        elevation: 10,
    },
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    icon: {
        fontSize: 32,
    },
    title: {
        fontSize: 20,
        color: '#1F2937',
        marginBottom: 8,
        textAlign: 'center',
        fontFamily: 'Comic Sans MS-Bold'
    },
    message: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
        fontFamily: 'Comic Sans MS'
    },
    buttonContainer: {
        flexDirection: 'column',
        width: '100%',
        gap: 12,
        alignItems: 'center',
    },
    button: {
        width: 200,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontFamily: 'Comic Sans MS-Bold'
    },
});

export default CustomAlert;
