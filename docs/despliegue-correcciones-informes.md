# Despliegue de las correcciones de WhatsApp e informes

Cambios locales: reconexión progresiva (2–60 segundos), diagnóstico de desconexión, validación de valores NUMERIC de ventas y cola persistente de informes. El bot ya no se ejecuta con `--watch` en producción.

## Railway

1. Subir estos cambios al repositorio que despliegan ambos servicios.
2. Antes de iniciar la nueva versión del backend, aplicar la migración con el comando de pre-deploy, desde la raíz del repositorio:

   ```sh
   npm run prisma:deploy --workspace=@minisuper/backend
   ```

   Si la raíz configurada del servicio es `apps/backend`, usar `npm run prisma:deploy`. La instalación ejecuta la generación de Prisma mediante el postinstall existente. Aplicar migraciones una sola vez por despliegue/base; no usar `db push` ni resetear la base.

3. Los dos servicios deben usar la misma base PostgreSQL: el bot consulta allí la cola y las entregas. Mantener un único proceso/réplica del bot por sesión de WhatsApp; no ejecutar simultáneamente una copia local con las mismas credenciales.
4. En el backend, establecer `WHATSAPP_BOT_URL` al dominio privado del bot con su puerto real. El registro suministrado muestra 8080:

   ```env
   WHATSAPP_BOT_URL=http://asistente-de-inventario.railway.internal:8080
   ```

   Verificar dominio en Networking y puerto en el log del nuevo despliegue; 3002 solo es el valor de reserva cuando PORT no existe.
5. Configurar el mismo `INFORME_INTERNO_SECRET` en ambos servicios. Mantener `WHATSAPP_SESSION_DIR` dentro del volumen persistente del bot. No borrar el volumen ni las credenciales como parte de esta actualización.
6. Desplegar las dos versiones de forma coordinada, preferentemente fuera de cierres: el nuevo bot requiere una entrada en la cola y el nuevo backend requiere confirmación HTTP 200 con `enviado: true`. El antiguo HTTP 202 ya no se considera envío completo.

## Comportamiento

- El cierre y el informe pendiente se guardan juntos, antes de responder al cajero. Una migración ausente impide el cierre: aplicar primero la migración.
- El trabajador revisa cada 15 segundos y comienza a enviar a partir de cinco minutos después del cierre. El cierre no espera a WhatsApp.
- Red, bot desconectado o entrega parcial: reintentos de 30 segundos hasta una hora; los trabajos sobreviven reinicios.
- Los destinatarios quedan fijados al comenzar el primer intento. Cada destinatario enviado se registra y se omite en los reintentos.
- Confirmado significa que Baileys devolvió un ID de mensaje; no certifica recepción, descifrado ni lectura en el teléfono. Existe una ventana inevitable de duplicación si el proceso cae después de enviar pero antes de guardar la confirmación. No se promete entrega exactamente una vez.
- Los bloqueos de trabajo vencen a los diez minutos para recuperar procesos interrumpidos.
- Los cierres anteriores a esta actualización no se reenvían automáticamente: no tenían un trabajo persistido. No se generó una carga histórica que pudiera duplicar informes ya enviados.
- Errores Bad MAC existentes pueden requerir una revisión de vinculación tras estabilizar la conexión; los cambios no garantizan recuperar mensajes antiguos cifrados.

## Verificación local

Pruebas específicas con red y WhatsApp simulados, y migraciones SQL en PGlite temporal:

```sh
cd apps/backend
node --experimental-test-module-mocks --test test/reconnect-controller.test.js test/ventas.numeric-range.test.js test/informes-persistentes.test.js test/caja.outbox.test.js test/migrations.integration.test.js test/pdf-render.retry.test.js
```

No se aplicó la migración a Railway ni se enviaron mensajes reales durante estas pruebas. Las pruebas antiguas de otros módulos siguen fuera del alcance de estas correcciones.
