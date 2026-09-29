CREATE TYPE "EstadoMovimientoCaja" AS ENUM ('ACTIVO', 'ANULADO');

ALTER TABLE "movimientos_caja"
  ADD COLUMN "estado" "EstadoMovimientoCaja" NOT NULL DEFAULT 'ACTIVO',
  ADD COLUMN "anulado_en" TIMESTAMP(3),
  ADD COLUMN "usuario_anulacion_id" INTEGER,
  ADD COLUMN "motivo_anulacion" VARCHAR(200);

CREATE INDEX "movimientos_caja_usuario_anulacion_id_idx"
  ON "movimientos_caja"("usuario_anulacion_id");

CREATE INDEX "movimientos_caja_estado_idx"
  ON "movimientos_caja"("estado");

ALTER TABLE "movimientos_caja"
  ADD CONSTRAINT "movimientos_caja_usuario_anulacion_id_fkey"
  FOREIGN KEY ("usuario_anulacion_id") REFERENCES "usuarios"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
