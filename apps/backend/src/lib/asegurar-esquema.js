// Railway no corre "prisma migrate deploy" al publicar. Los cambios de
// esquema pequeños y seguros de repetir se aplican aquí al arrancar, antes
// de atender solicitudes; la migración equivalente queda en prisma/migrations.
import { prisma } from "./prisma.js";

const CAMBIOS = [
  'ALTER TABLE "presentaciones_producto" ADD COLUMN IF NOT EXISTS "costo" DECIMAL(14,2)',
];

export async function asegurarEsquema({ db = prisma } = {}) {
  for (const sql of CAMBIOS) {
    await db.$executeRawUnsafe(sql);
  }
}
