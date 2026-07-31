import { app } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.port, env.host, () => {
  console.log(`Backend disponible en http://${env.host}:${env.port}`);
});

function closeServer(signal) {
  console.log(`\n${signal}: cerrando backend...`);

  server.close((error) => {
    if (error) {
      console.error("No se pudo cerrar el backend correctamente.", error);
      process.exit(1);
    }

    process.exit(0);
  });
}

process.on("SIGINT", () => closeServer("SIGINT"));
process.on("SIGTERM", () => closeServer("SIGTERM"));
