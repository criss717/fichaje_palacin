# Despliegue Manual - Sistema de Emails (Sin CLI)

## Resumen
Configuración de recordatorios por email que se ejecutan **todos los días a las 18:15 hora de España**.

## ¿Qué hace?
- Revisa quién fichó entrada hoy pero no ha fichado salida
- Envía un email recordatorio a esos usuarios
- **Solo para usuarios web** (iOS/Safari) - Android ya tiene notificaciones push

---

## Paso 1: Crear la Edge Function

1. **Ve al Dashboard de Supabase:**
   - https://supabase.com/dashboard
   - Selecciona tu proyecto

2. **Crea la función:**
   - Menú lateral → **Edge Functions**
   - Click en **"Create a new function"**
   - Nombre: `check-missing-clockouts`
   - Click **"Create function"**

3. **Pega el código:**
   - Abre el archivo: `supabase/functions/check-missing-clockouts/index.ts`
   - Copia TODO el contenido
   - Pégalo en el editor del dashboard
   - Click **"Deploy"**

---

## Paso 2: Configurar Secrets

1. **En el Dashboard:**
   - Settings → **Edge Functions**
   - Sección **"Secrets"**

2. **Agregar RESEND_API_KEY:**
   - Click **"Add secret"**
   - Name: `RESEND_API_KEY`
   - Value: Tu API key de Resend (la que tienes en `.env`)
   - Click **"Save"**

---

## Paso 3: Habilitar pg_cron

1. **En el Dashboard:**
   - Database → **Extensions**

2. **Buscar y habilitar:**
   - Busca: `pg_cron`
   - Click en el toggle para habilitarlo
   - Espera a que se active (tarda ~10 segundos)

   y hacer en sql editor CREATE EXTENSION IF NOT EXISTS pg_net; #importante

---

## Paso 4: Configurar el Cron Job

1. **Obtener datos necesarios:**
   - **PROJECT_REF**: Settings → General → Reference ID (Ej: `ihyskl...`) (project id) 
   - **ANON_KEY**: Settings → API → Project API keys → `anon` `public`->legacy anon services
     > [!IMPORTANT]
     > La `ANON_KEY` es un texto MUY LARGO que empieza por `eyJ...`. No uses otras claves cortas.


2. **Ir al SQL Editor:**
   - SQL Editor → **New query**

3. **Pegar y modificar este código:**

```sql
SELECT cron.schedule(
  'check-missing-clockouts-daily',
  '15 17 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://TU_PROJECT_REF.supabase.co/functions/v1/check-missing-clockouts',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer TU_ANON_KEY"}'::jsonb
    ) as request_id;
  $$
);
```

4. **Reemplazar:**
   - `TU_PROJECT_REF` → Tu Reference ID
   - `TU_ANON_KEY` → Tu Anon Key

5. **Ejecutar:**
   - Click **"Run"** o presiona `Ctrl+Enter`
   - Deberías ver: "Success. No rows returned"

---

## Paso 5: Verificar

### Ver cron jobs activos:
```sql
SELECT * FROM cron.job;
```

Deberías ver tu job `check-missing-clockouts-daily` con el schedule `15 17 * * *`

### Probar manualmente:
1. Edge Functions → `check-missing-clockouts`
2. Click **"Invoke"**
3. Revisa los logs para ver si funcionó

---

## Horario

- **`15 17 * * *`** = Todos los días a las 17:15 UTC
- **17:15 UTC** = **18:15 CET** (hora de España en invierno)
- **17:15 UTC** = **19:15 CEST** (hora de España en verano)

Si quieres que siempre sea 18:15 en España:
- **Invierno (CET):** `15 17 * * *` ✅ (ya configurado)
- **Verano (CEST):** Cambiar a `15 16 * * *`

---

## Troubleshooting

### El cron no se ejecuta:
```sql
-- Ver logs de cron
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### Eliminar y recrear el cron:
```sql
-- Eliminar
SELECT cron.unschedule('check-missing-clockouts-daily');

-- Recrear (volver al Paso 4)
```

### Ver logs de la función:
- Edge Functions → `check-missing-clockouts` → **Logs**

---

## ¡Listo!

Tu sistema de emails está configurado. Se ejecutará automáticamente todos los días a las 18:15 (hora de España en invierno).
