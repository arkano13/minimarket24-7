import { createReconnectController } from '../../lib/reconnect-controller.js';
import { describeDisconnect } from '../../lib/whatsapp-disconnect.js';

export function createWhatsAppConnection({ loadAuth, makeSocket, toQr, socketOptions = {},
  onMessage, logger = console, reconnectOptions = {} }) {
  let socket = null;
  let status = 'conectando';
  let qr = null;
  let ready = false;
  let lastDisconnect = null;
  let stopped = false;
  let resetting = false;
  let detach = () => {};
  let credentials = Promise.resolve();
  let incoming = Promise.resolve();
  const reconnect = createReconnectController(connect, {
    ...reconnectOptions,
    onError: error => logger.error('No se pudo iniciar WhatsApp:', error.message),
  });

  async function connect() {
    await credentials;
    if (stopped) return;
    const { state, saveCreds } = await loadAuth();
    if (stopped) return;
    const registered = Boolean(state.creds.registered);
    let opened = false;
    let qrVersion = 0;
    const current = makeSocket({ ...socketOptions, auth: state });
    socket = current;
    status = 'conectando';
    ready = false;
    const onCreds = () => {
      if (socket !== current) return;
      credentials = credentials.then(saveCreds).catch(error => {
        logger.error('No se guardaron las credenciales de WhatsApp:', error.message);
      });
    };
    const onUpdate = update => {
      if (socket !== current) return;
      if (update.connection === 'close') {
        qrVersion++;
        const code = update.lastDisconnect?.error?.output?.statusCode ?? 500;
        lastDisconnect = describeDisconnect({ error: update.lastDisconnect?.error, code, registered, opened });
        logger.error('WhatsApp desconectado:', JSON.stringify(lastDisconnect));
        detach();
        socket = null;
        ready = false;
        qr = null;
        status = code === 401 ? 'desvinculado' : code === 440 ? 'reemplazada' : 'conectando';
        if (code === 401 || code === 440) reconnect.stop();
        else reconnect.retry();
        return;
      }
      if (update.connection === 'open') {
        qrVersion++;
        opened = true;
        status = 'conectado';
        ready = false;
        qr = null;
        lastDisconnect = null;
        reconnect.connected();
        logger.log('Bot de WhatsApp del asistente conectado.');
        return;
      }
      if (update.connection === 'connecting' || update.qr) ready = true;
      if (update.qr) {
        status = 'esperando_qr';
        const version = ++qrVersion;
        Promise.resolve().then(() => toQr(update.qr)).then(image => {
          if (socket === current && version === qrVersion) qr = image;
        }).catch(error => logger.error('No se pudo generar el QR:', error.message));
      }
    };
    const onMessages = event => {
      // Solo mensajes nuevos; no contestar nuevamente al sincronizar historial.
      if (socket !== current || event.type !== 'notify') return;
      for (const message of event.messages ?? []) {
        incoming = incoming.then(async () => {
          if (!stopped && socket === current) await onMessage(message);
        }).catch(error => logger.error('Error procesando mensaje WhatsApp:', error.message));
      }
    };
    current.ev.on('creds.update', onCreds);
    current.ev.on('connection.update', onUpdate);
    current.ev.on('messages.upsert', onMessages);
    detach = () => {
      current.ev.off('creds.update', onCreds);
      current.ev.off('connection.update', onUpdate);
      current.ev.off('messages.upsert', onMessages);
    };
  }

  return {
    getState: () => ({ socket, status, qr, ready, lastDisconnect }),
    start: () => reconnect.start(),
    // Empieza una sesión nueva SOLO si WhatsApp ya cerró la actual (401).
    // prepare() aparta los archivos de la sesión muerta antes de reconectar;
    // loadAuth() los lee de nuevo y arranca sin credenciales (listo para
    // vincular por código o QR).
    async reset(prepare) {
      if (status !== 'desvinculado') {
        const error = new Error('Solo se puede empezar una sesión nueva cuando WhatsApp cerró la sesión (401).');
        error.code = 'NO_DESVINCULADO';
        throw error;
      }
      if (resetting || stopped) return;
      resetting = true;
      try {
        await credentials;
        detach();
        detach = () => {};
        const current = socket;
        socket = null;
        current?.end?.(new Error('Sesión nueva'));
        await prepare();
        lastDisconnect = null;
        qr = null;
        ready = false;
        status = 'conectando';
        reconnect.resume();
        void reconnect.start();
      } finally {
        resetting = false;
      }
    },
    async stop() {
      stopped = true;
      reconnect.stop();
      detach();
      const current = socket;
      socket = null;
      status = 'detenido';
      ready = false;
      qr = null;
      current?.end(new Error('Servicio detenido'));
      await credentials;
    },
  };
}