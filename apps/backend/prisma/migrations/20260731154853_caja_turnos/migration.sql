-- CreateEnum
CREATE TYPE "EstadoTurnoCaja" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'RETIRO');

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "turno_caja_id" INTEGER;

-- CreateTable
CREATE TABLE "turnos_caja" (
    "id" SERIAL NOT NULL,
    "usuario_apertura_id" INTEGER NOT NULL,
    "usuario_cierre_id" INTEGER,
    "fondo_inicial" DECIMAL(14,2) NOT NULL,
    "efectivo_esperado_cierre" DECIMAL(14,2),
    "efectivo_contado" DECIMAL(14,2),
    "diferencia" DECIMAL(14,2),
    "estado" "EstadoTurnoCaja" NOT NULL DEFAULT 'ABIERTO',
    "abierto_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrado_en" TIMESTAMP(3),

    CONSTRAINT "turnos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_caja" (
    "id" SERIAL NOT NULL,
    "turno_caja_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "motivo" VARCHAR(200) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_caja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "turnos_caja_estado_idx" ON "turnos_caja"("estado");

-- CreateIndex
CREATE INDEX "turnos_caja_abierto_en_idx" ON "turnos_caja"("abierto_en");

-- CreateIndex
CREATE INDEX "turnos_caja_usuario_apertura_id_idx" ON "turnos_caja"("usuario_apertura_id");

-- CreateIndex
CREATE INDEX "turnos_caja_usuario_cierre_id_idx" ON "turnos_caja"("usuario_cierre_id");

-- CreateIndex
CREATE INDEX "movimientos_caja_turno_caja_id_creado_en_idx" ON "movimientos_caja"("turno_caja_id", "creado_en");

-- CreateIndex
CREATE INDEX "movimientos_caja_usuario_id_idx" ON "movimientos_caja"("usuario_id");

-- CreateIndex
CREATE INDEX "ventas_turno_caja_id_idx" ON "ventas"("turno_caja_id");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_turno_caja_id_fkey" FOREIGN KEY ("turno_caja_id") REFERENCES "turnos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_usuario_apertura_id_fkey" FOREIGN KEY ("usuario_apertura_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos_caja" ADD CONSTRAINT "turnos_caja_usuario_cierre_id_fkey" FOREIGN KEY ("usuario_cierre_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_turno_caja_id_fkey" FOREIGN KEY ("turno_caja_id") REFERENCES "turnos_caja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_caja" ADD CONSTRAINT "movimientos_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
