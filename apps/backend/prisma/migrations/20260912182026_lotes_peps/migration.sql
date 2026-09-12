-- AlterEnum
ALTER TYPE "MetodoMovimientoCaja" ADD VALUE 'TRANSFERENCIA';

-- CreateTable
CREATE TABLE "lotes_inventario" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "compra_id" INTEGER,
    "cantidad_inicial" DECIMAL(16,3) NOT NULL,
    "cantidad_restante" DECIMAL(16,3) NOT NULL,
    "costo_unitario" DECIMAL(14,4) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lotes_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lotes_inventario_producto_id_creado_en_idx" ON "lotes_inventario"("producto_id", "creado_en");

-- CreateIndex
CREATE INDEX "lotes_inventario_compra_id_idx" ON "lotes_inventario"("compra_id");

-- AddForeignKey
ALTER TABLE "lotes_inventario" ADD CONSTRAINT "lotes_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lotes_inventario" ADD CONSTRAINT "lotes_inventario_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;
