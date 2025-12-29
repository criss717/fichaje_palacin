import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const GMAIL_USER = Deno.env.get('GMAIL_USER') // tu-email@gmail.com
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD') // Contraseña de aplicación
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
    try {
        if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
            throw new Error('Gmail credentials no configuradas')
        }
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Variables de Supabase no configuradas')
        }

        const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { data: todayEntries, error: entriesError } = await supabaseClient
            .from('time_entries')
            .select(`
        id,
        timestamp,
        entry_type,
        user_id,
        profiles:user_id (
          full_name,
          email
        )
      `)
            .gte('timestamp', today.toISOString())
            .order('timestamp', { ascending: true })

        if (entriesError) {
            throw new Error(`Error al obtener entradas: ${entriesError.message}`)
        }

        const userEntries = new Map()

        for (const entry of todayEntries || []) {
            if (!userEntries.has(entry.user_id)) {
                userEntries.set(entry.user_id, {
                    user: entry.profiles,
                    entrada: null,
                    salida: null
                })
            }

            const userData = userEntries.get(entry.user_id)
            if (entry.entry_type === 'entrada' && !userData.entrada) {
                userData.entrada = entry
            } else if (entry.entry_type === 'salida') {
                userData.salida = entry
            }
        }

        const usersToNotify = []
        for (const [userId, data] of userEntries) {
            if (data.entrada && !data.salida && data.user?.email) {
                usersToNotify.push({
                    email: data.user.email,
                    name: data.user.full_name || 'Usuario',
                    entryTime: new Date(data.entrada.timestamp).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                })
            }
        }

        if (usersToNotify.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'No hay usuarios pendientes de fichar salida',
                    usersNotified: 0
                }),
                {
                    headers: { 'Content-Type': 'application/json' },
                    status: 200
                }
            )
        }

        // Configurar cliente SMTP de Gmail
        const client = new SMTPClient({
            connection: {
                hostname: "smtp.gmail.com",
                port: 465,
                tls: true,
                auth: {
                    username: GMAIL_USER,
                    password: GMAIL_APP_PASSWORD,
                },
            },
        });

        const emailResults = []
        for (const user of usersToNotify) {
            try {
                await client.send({
                    from: GMAIL_USER,
                    to: user.email,
                    subject: "⏰ Recordatorio: No has fichado tu salida",
                    content: "auto",
                    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1E3A8A;">Hola ${user.name},</h2>
              <p>Te recordamos que <strong>fichaste tu entrada a las ${user.entryTime}</strong> pero aún no has registrado tu salida.</p>
              <p>Por favor, accede a la aplicación y ficha tu salida para completar tu jornada de hoy.</p>
              <a href="https://fichaje-palacin.vercel.app" 
                 style="display: inline-block; background-color: #1E3A8A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0;">
                Fichar Ahora
              </a>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Este es un recordatorio automático del sistema de fichaje.
              </p>
            </div>
          `,
                });

                emailResults.push({
                    email: user.email,
                    success: true
                })
            } catch (emailError) {
                emailResults.push({
                    email: user.email,
                    success: false,
                    error: emailError.message
                })
            }
        }

        await client.close();

        return new Response(
            JSON.stringify({
                success: true,
                usersNotified: usersToNotify.length,
                emailsSent: emailResults.filter(r => r.success).length,
                results: emailResults
            }),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            }
        )

    } catch (error) {
        console.error('Error en check-missing-clockouts:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 500
            }
        )
    }
})
