// No reintentar automáticamente un envío ambiguo: podría haberse entregado.
// Los informes conservan sus reintentos duraderos en la cola de minimarket.
export function createSendQueue({ getState, store }) {
  let tail = Promise.resolve();
  let closed = false;
  return {
    enviar(jid, content) {
      if (closed) return Promise.reject(new Error('El bot se está deteniendo.'));
      const task = tail.then(async () => {
        const { socket, status } = getState();
        if (closed || !socket || status !== 'conectado') throw new Error('WhatsApp no está conectado.');
        const sent = await socket.sendMessage(jid, content);
        if (sent?.key?.id && sent.message) await store.guardar(sent.key.id, sent.message);
        return sent;
      });
      tail = task.catch(() => {});
      return task;
    },
    async stop() { closed = true; await tail; },
  };
}
