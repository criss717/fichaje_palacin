-- =============================================================================
-- MIGRACIÓN: Prevención de fichajes duplicados concurrentes (Entrada / Salida)
-- Ejecutar en el SQL Editor del Dashboard de Supabase
-- =============================================================================

CREATE OR REPLACE FUNCTION public.check_consecutive_time_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    last_record RECORD;
    effective_ts TIMESTAMPTZ;
BEGIN
    -- 1. Bloqueo transaccional exclusivo por usuario (serializa peticiones en el mismo milisegundo)
    PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

    effective_ts := COALESCE(NEW.timestamp, now());
    NEW.timestamp := effective_ts;

    -- 2. Obtener el último fichaje registrado para este usuario
    SELECT id, entry_type, timestamp
    INTO last_record
    FROM public.time_entries
    WHERE user_id = NEW.user_id
    ORDER BY timestamp DESC
    LIMIT 1;

    IF FOUND THEN
        -- Regla A: Impedir dos SALIDAS seguidas (tanto normales como de cierre correctivo)
        IF NEW.entry_type = 'salida' AND last_record.entry_type = 'salida' THEN
            RAISE EXCEPTION 'DUPLICATE_TIME_ENTRY: Ya se ha registrado la salida para este turno.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Regla B: Impedir dos ENTRADAS seguidas en el mismo día (sin haber fichado salida entre medias)
        IF NEW.entry_type = 'entrada'
           AND last_record.entry_type = 'entrada'
           AND (last_record.timestamp AT TIME ZONE 'Europe/Madrid')::date = (effective_ts AT TIME ZONE 'Europe/Madrid')::date
        THEN
            RAISE EXCEPTION 'DUPLICATE_TIME_ENTRY: Ya existe una entrada activa abierta hoy.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Regla C: Cortafuegos temporal de seguridad (impide dos registros idénticos en menos de 10 segundos)
        IF last_record.entry_type = NEW.entry_type
           AND ABS(EXTRACT(EPOCH FROM (effective_ts - last_record.timestamp))) < 10
        THEN
            RAISE EXCEPTION 'DUPLICATE_TIME_ENTRY: Registro duplicado detectado en intervalo menor a 10 segundos.'
                USING ERRCODE = 'P0001';
        END IF;
    ELSE
        -- Si el usuario no tiene ningún fichaje previo, no puede empezar fichando una salida
        IF NEW.entry_type = 'salida' THEN
            RAISE EXCEPTION 'DUPLICATE_TIME_ENTRY: No existe ninguna entrada abierta para registrar salida.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Eliminar el trigger si ya existía para permitir re-ejecución idempotente
DROP TRIGGER IF EXISTS trg_prevent_duplicate_time_entries ON public.time_entries;

-- Crear el trigger BEFORE INSERT en la tabla time_entries
CREATE TRIGGER trg_prevent_duplicate_time_entries
BEFORE INSERT ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.check_consecutive_time_entry();
