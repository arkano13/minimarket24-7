-- CreateEnum
CREATE TYPE "MetodoMovimientoCaja" AS ENUM ('EFECTIVO', 'TARJETA');

-- AlterEnum
ALTER TYPE "MetodoPago" ADD VALUE 'CREDITO';

-- AlterTable
ALTER TABLE "movimientos_caja" ADD COLUMN     "metodo" "MetodoMovimientoCaja" NOT NULL DEFAULT 'EFECTIVO';
