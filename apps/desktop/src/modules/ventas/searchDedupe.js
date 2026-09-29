// Evita repetir la misma búsqueda de productos: al escanear un código, el
// Enter del lector y el temporizador de escritura pedían lo mismo dos veces.
// Reutiliza la petición en curso, o la respuesta de hace menos de `ttlMs`,
// si la clave (texto + cliente) es la misma.
export function createSearchDedupe(ttlMs = 1500, now = () => Date.now()) {
  let last = null;

  return function dedupe(key, fetcher) {
    if (last && last.key === key && (last.pending || now() - last.at < ttlMs)) {
      return last.promise;
    }

    const entry = { key, pending: true, at: 0, promise: null };

    entry.promise = Promise.resolve()
      .then(fetcher)
      .then(
        (result) => {
          entry.pending = false;
          entry.at = now();
          return result;
        },
        (error) => {
          // Un error no se reutiliza: el siguiente intento vuelve a pedir.
          if (last === entry) last = null;
          throw error;
        },
      );

    last = entry;
    return entry.promise;
  };
}
