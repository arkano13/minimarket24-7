import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Falta DATABASE_URL en apps/backend/.env");
}

// pg cierra por defecto las conexiones que llevan 10 s sin uso, así que la
// primera búsqueda después de una pausa del cajero tenía que volver a
// conectarse a Postgres (más lento en Railway). Se mantienen abiertas
// 10 minutos y con keepAlive para que no las corte la red.
const adapter = new PrismaPg({
  connectionString,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 10 * 60_000),
  keepAlive: true,
});

export const prisma = new PrismaClient({
  adapter,
});