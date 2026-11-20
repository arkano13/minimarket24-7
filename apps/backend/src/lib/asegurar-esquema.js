// Railway no corre "prisma migrate deploy" al publicar. Los cambios de
// esquema pequeños y seguros de repetir se aplican aquí al arrancar, antes
// de atender solicitudes; la migración equivalente queda en prisma/migrations.
import { prisma } from "./prisma.js";

const CAMBIOS = [
  'ALTER TABLE "presentaciones_producto" ADD COLUMN IF NOT EXISTS "costo" DECIMAL(14,2)',
  'ALTER TABLE "compras_detalle" ADD COLUMN IF NOT EXISTS "isv_porcentaje" SMALLINT NOT NULL DEFAULT 0',
  'ALTER TABLE "compras_detalle" ADD COLUMN IF NOT EXISTS "isv_monto" DECIMAL(14,2) NOT NULL DEFAULT 0',
  'ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "isv_compra" SMALLINT NOT NULL DEFAULT 0',
];

export async function asegurarEsquema({ db = prisma } = {}) {
  for (const sql of CAMBIOS) {
    await db.$executeRawUnsafe(sql);
  }
}
