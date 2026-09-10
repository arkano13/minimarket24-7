// apps/backend/src/bots/test-console.js
import "dotenv/config";
import readline from "node:readline";
import { handleMessage } from "../modules/asistente/asistente.service.js";
import { cargarHistorial, guardarMensaje } from "../modules/asistente/asistente.memory.js";

const CANAL = "TELEGRAM"; // canal ficticio solo para la prueba de consola
const IDENTIFICADOR = "consola-local";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "tú> " });

console.log("Asistente del súper — modo consola. Escribe 'salir' para terminar.\n");
rl.prompt();

rl.on("line", async (linea) => {
  const texto = linea.trim();
  if (texto.toLowerCase() === "salir") { rl.close(); return; }
  if (!texto) { rl.prompt(); return; }

  try {
    const historial = await cargarHistorial(CANAL, IDENTIFICADOR);
    historial.push({ role: "user", content: texto });
    await guardarMensaje(CANAL, IDENTIFICADOR, "user", texto);

    const respuesta = await handleMessage(historial);
    await guardarMensaje(CANAL, IDENTIFICADOR, "assistant", respuesta);

    console.log(`\nasistente> ${respuesta}\n`);
  } catch (err) {
    console.error("Error:", err.message);
  }

  rl.prompt();
});

rl.on("close", () => { console.log("\nSesión terminada."); process.exit(0); });