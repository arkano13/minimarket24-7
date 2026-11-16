import { app } from "./app.js";
import { env } from "./config/env.js";
import { asegurarEsquema } from "./lib/asegurar-esquema.js";
import { iniciarColaInformes } from "./modules/caja/informe-turno-notifier.js";

try {
  await asegurarEsquema();
} catch (error) {
  console.error("No se pudo actualizar el esquema de la base de datos.", error);
}

const detenerCola = iniciarColaInformes();

const server = app.listen(env.port, env.host, () => {
  console.log(`Backend disponible en http://${env.host}:${env.port}`);
});

function closeServer(signal) {
  detenerCola();
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
