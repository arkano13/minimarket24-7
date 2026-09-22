// Un solo temporizador y un solo arranque en curso; no crea sockets paralelos.
export function createReconnectController(connect, {
  schedule = setTimeout, cancel = clearTimeout, onError = console.error,
} = {}) {
  let timer = null;
  let attempts = 0;
  let running = false;
  let stopped = false;
  let pending = false;

  function retry() {
    if (stopped || timer !== null) return;
    if (running) { pending = true; return; }
    const delay = Math.min(60_000, 2_000 * 2 ** Math.min(attempts++, 5));
    timer = schedule(() => { timer = null; void start(); }, delay);
    return delay;
  }
  async function start() {
    if (stopped || running) return;
    running = true;
    try { await connect(); }
    catch (error) { onError(error); pending = true; }
    finally {
      running = false;
      if (pending) { pending = false; retry(); }
    }
  }
  return {
    start, retry,
    connected() {
      attempts = 0;
      pending = false;
      if (timer !== null) cancel(timer);
      timer = null;
    },
    stop() {
      stopped = true;
      pending = false;
      if (timer !== null) cancel(timer);
      timer = null;
    },
  };
}
