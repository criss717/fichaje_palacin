import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseUrl, supabaseAnonKey } from '../config/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const userRef = useRef(null); // Referencia para evitar cierres obsoletos en el listener

    useEffect(() => {
        // Sincronizar ref con estado
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        console.log('AuthProvider: Iniciando verificación de sesión...');

        // Verificar sesión existente
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('AuthProvider: Sesión obtenida', session ? 'Usuario activo' : 'Sin sesión');
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            userRef.current = currentUser; // Actualizar ref inmediatamente

            if (currentUser) {
                loadProfile(currentUser.id);
            } else {
                setLoading(false);
            }
        }).catch(err => {
            console.error('AuthProvider Error:', err);
            setLoading(false);
        });

        // Escuchar cambios de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {

            const nextUser = session?.user ?? null;
            const prevUser = userRef.current;

            // Si cambia el ID del usuario (login, logout, o cambio de cuenta)
            // Evitamos parpadeos si es solo un refresco de token (mismo ID)
            if (nextUser?.id !== prevUser?.id) {
                console.log('AuthProvider: Cambio de usuario detectado, limpiando estado anterior...');
                setLoading(true);
                setProfile(null);
            }

            setUser(nextUser);

            if (nextUser) {
                // Si es el mismo usuario, no recargamos necesariamente, pero por seguridad verificamos
                // Si loading estaba true (por el if de arriba), recargamos
                // O si profile es null
                if (nextUser.id !== prevUser?.id || !profile) {
                    loadProfile(nextUser.id);
                } else {
                    // Mismo usuario y perfil cargado, quitamos loading por si acaso
                    setLoading(false);
                }
            } else {
                setProfile(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []); // Dependencia vacía intencional

    const loadProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setProfile(data);
        } catch (error) {
            console.error('Error cargando perfil:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const signOut = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                // Si el error es "Auth session missing", lo ignoramos porque el objetivo es salir
                if (error.message.includes('Auth session missing')) {
                    console.warn('Sesión ya cerrada o perdida, limpiando estado local...');
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('Error cerrando sesión:', error.message);
        } finally {
            // Siempre limpiar el estado local para asegurar que la UI responda
            setUser(null);
            setProfile(null);
        }
    };

    const createUser = async (email, password, fullName) => {
        try {
            // Creamos un cliente TEMPORAL para no afectar la sesión actual (Admin)
            // Usamos las keys importadas explícitamente para evitar problemas de scope
            const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                    detectSessionInUrl: false
                }
            });

            // Crear usuario con el cliente temporal
            console.log('Creando usuario con cliente temporal...');
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email,
                password,
            });

            if (authError) throw authError;

            // Si el usuario se crea, insertamos perfil usando el cliente ADMIN principal (supabase)
            if (authData?.user) {
                console.log('Usuario creado. Creando perfil con Admin client...');

                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert([
                        {
                            id: authData.user.id,
                            email,
                            full_name: fullName,
                            role: 'employee',
                        },
                    ]);

                if (profileError) {
                    console.error('Error creando perfil:', profileError);
                    throw profileError;
                }
            }

            return { success: true };
        } catch (error) {
            console.error('Error creando usuario:', error);
            return { success: false, error: error.message };
        }
    };

    const value = {
        user,
        profile,
        loading,
        signIn,
        signOut,
        createUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de AuthProvider');
    }
    return context;
};
