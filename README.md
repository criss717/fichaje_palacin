# 📱 App Fichaje Palacín

Aplicación móvil para registro de fichajes de entrada y salida del personal de Palacín.

## ✨ Características

- 🔐 **Autenticación segura** con Supabase
- 👤 **Dos roles**: Administrador y Empleado
- ⏱️ **Fichaje rápido** de entrada y salida
- 📊 **Panel de administración** con tabla de fichajes
- 🎨 **Diseño corporativo** con colores de Palacín
- 📱 **Multiplataforma**: Android e iOS
- 💾 **Sesión persistente** (no necesitas volver a iniciar sesión)

---

## 🚀 Instalación y Configuración

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Supabase

Sigue la guía completa en [`supabase_setup.md`](file:///C:/Users/Usuario/.gemini/antigravity/brain/95e3b881-221f-4db1-b542-b77342822da5/supabase_setup.md) para:
- Crear proyecto en Supabase
- Crear tablas y políticas de seguridad
- Crear usuario administrador
- Obtener credenciales

### 3. Configurar Variables de Entorno

Edita el archivo `.env` con tus credenciales de Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

---

## 🏃 Ejecutar la App

### En Desarrollo (con Expo Go)

1. Inicia el servidor de desarrollo:
```bash
npm start
```

2. Opciones:
   - **Android**: Presiona `a` o escanea el QR con Expo Go
   - **iOS**: Presiona `i` o escanea el QR con Expo Go
   - **Web**: Presiona `w` (solo para pruebas, no recomendado)

### Probar en tu Móvil

1. Instala **Expo Go** desde:
   - [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) (Android)
   - [App Store](https://apps.apple.com/app/expo-go/id982107779) (iOS)

2. Ejecuta `npm start`

3. Escanea el QR code:
   - **Android**: Usa la app Expo Go
   - **iOS**: Usa la cámara del iPhone

---

## 📦 Generar APK/IPA (Producción)

### Requisitos Previos

1. Crea una cuenta en [Expo](https://expo.dev)
2. Instala EAS CLI:
```bash
npm install -g eas-cli
```

3. Inicia sesión:
```bash
eas login
```

### Generar APK para Android

```bash
# Configurar EAS Build (solo la primera vez)
eas build:configure

# Generar APK
eas build -p android --profile preview
```

El proceso tomará 10-15 minutos. Al finalizar, recibirás un enlace para descargar el APK.

### Generar IPA para iOS

```bash
eas build -p ios --profile preview
```

> [!NOTE]
> Para iOS necesitas una cuenta de Apple Developer ($99/año) para instalar en dispositivos reales.

---

## 👥 Uso de la App

### Como Administrador

1. **Iniciar sesión** con credenciales de admin
2. **Crear usuarios empleados**:
   - Nombre completo
   - Email
   - Contraseña (mínimo 6 caracteres)
3. **Ver fichajes** de todos los empleados en tiempo real
4. **Cerrar sesión** cuando termines

### Como Empleado

1. **Iniciar sesión** con tus credenciales
2. **Fichar Entrada** al llegar al trabajo
3. **Fichar Salida** al terminar la jornada
4. Ver tus fichajes del día actual
5. **Cerrar sesión** (opcional, la sesión se mantiene)

### Validaciones Automáticas

- ✅ No puedes fichar entrada dos veces el mismo día
- ✅ No puedes fichar salida sin haber fichado entrada
- ✅ No puedes fichar salida dos veces el mismo día
- ✅ Se muestra la hora de tu última entrada/salida

---

## 🗂️ Estructura del Proyecto

```
appFichajePalacin/
├── assets/                  # Logo y fondo corporativo
├── src/
│   ├── config/
│   │   └── supabase.js     # Cliente Supabase
│   ├── context/
│   │   └── AuthContext.js  # Gestión de autenticación
│   ├── navigation/
│   │   └── AppNavigator.js # Navegación de la app
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── UserDashboard.js
│   │   └── AdminDashboard.js
│   ├── components/
│   │   └── BackgroundBlur.js
│   └── utils/
│       └── helpers.js
├── App.js                   # Punto de entrada
├── package.json
├── tailwind.config.js       # Colores corporativos
└── .env                     # Variables de entorno
```

---

## 🎨 Paleta de Colores

- **Primario**: `#1E3A8A` (Azul oscuro)
- **Secundario**: `#3B82F6` (Azul medio)
- **Acento**: `#60A5FA` (Azul claro)
- **Éxito (Entrada)**: `#10B981` (Verde)
- **Error (Salida)**: `#EF4444` (Rojo)

---

## 🛠️ Tecnologías Utilizadas

- **Expo** - Framework React Native
- **React Native** - UI nativa
- **Supabase** - Backend (Auth + PostgreSQL)
- **NativeWind** - Tailwind CSS para React Native
- **React Navigation** - Navegación
- **AsyncStorage** - Persistencia local

---

## 📝 Base de Datos

### Tabla: `profiles`
- `id` (UUID) - ID del usuario
- `email` (TEXT) - Email único
- `full_name` (TEXT) - Nombre completo
- `role` (TEXT) - 'admin' o 'employee'
- `created_at` (TIMESTAMP)

### Tabla: `time_entries`
- `id` (UUID) - ID del fichaje
- `user_id` (UUID) - Referencia a profiles
- `entry_type` (TEXT) - 'entrada' o 'salida'
- `timestamp` (TIMESTAMP) - Fecha y hora del fichaje
- `created_at` (TIMESTAMP)

---

## 🐛 Solución de Problemas

### La app no inicia
```bash
# Limpia caché y reinstala
rm -rf node_modules
npm install
npm start -- --clear
```

### Error de conexión a Supabase
- Verifica que el archivo `.env` existe
- Verifica que las credenciales son correctas
- Reinicia el servidor: `npm start`

### No puedo iniciar sesión
- Verifica que el usuario existe en Supabase (Table Editor → profiles)
- Verifica que el rol sea 'admin' o 'employee'
- Verifica la contraseña

---

## 📧 Soporte

Para problemas o dudas, contacta al equipo de desarrollo.

---

## 📄 Licencia

© 2025 Palacín - Todos los derechos reservados
