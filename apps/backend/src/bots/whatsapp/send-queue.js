// No reintentar automáticamente un envío ambiguo: podría haberse entregado.
// Los informes conservan sus reintentos duraderos en la cola de minimarket.
function conTiempoMaximo(promesa, ms) {
  let timer;
  const limite = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`WhatsApp no confirmó el envío en ${ms / 1000} s.`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}

export function createSendQueue({ getState, store, sendTimeoutMs = 60_000 }) {
  let tail = Promise.resolve();
  let closed = false;
  return {
    enviar(jid, content) {
      if (closed) return Promise.reject(new Error('El bot se está deteniendo.'));
      const task = tail.then(async () => {
        const { socket, status } = getState();
        if (closed || !socket || status !== 'conectado') throw new Error('WhatsApp no está conectado.');
        // Un envío colgado bloquearía todos los siguientes (respuestas e informes).
        const sent = await conTiempoMaximo(socket.sendMessage(jid, content), sendTimeoutMs);
        if (sent?.key?.id && sent.message) await store.guardar(sent.key.id, sent.message);
        return sent;
      });
      tail = task.catch(() => {});
      return task;
    },
    async stop() { closed = true; await tail; },
  };
}
