import "dotenv/config";

function parsePort(value) {
  const port = Number(value ?? 3001);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("BACKEND_PORT debe ser un puerto válido.");
  }

  return port;
}

export const env = Object.freeze({
  host: process.env.BACKEND_HOST ?? "127.0.0.1",
  port: parsePort(process.env.BACKEND_PORT),
});
