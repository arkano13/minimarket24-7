import "dotenv/config";

function parsePort(value) {
  const port = Number(value ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT/BACKEND_PORT debe ser un puerto válido.");
  }

  return port;
}

export const env = Object.freeze({
  // Railway inyecta PORT automáticamente y espera que el servidor
  // escuche en 0.0.0.0 para poder enrutar tráfico externo.
  host: process.env.HOST ?? process.env.BACKEND_HOST ?? "0.0.0.0",
  port: parsePort(process.env.PORT ?? process.env.BACKEND_PORT),
});