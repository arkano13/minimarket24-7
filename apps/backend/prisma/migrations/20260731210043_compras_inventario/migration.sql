-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('RECIBIDA', 'ANULADA');

-- AlterTable
ALTER TABLE "movimientos_inventario" ADD COLUMN     "compra_id" INTEGER;

-- CreateTable
CREATE TABLE "compras" (
    "id" SERIAL NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "proveedor_nombre" VARCHAR(150) NOT NULL,
    "numero_documento" VARCHAR(100),
    "notas" VARCHAR(250),
    "total" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'RECIBIDA',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulada_en" TIMESTAMP(3),

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras_detalle" (
    "id" SERIAL NOT NULL,
    "compra_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "presentacion_id" INTEGER NOT NULL,
    "producto_nombre" VARCHAR(150) NOT NULL,
    "presentacion_nombre" VARCHAR(80) NOT NULL,
    "cantidad" DECIMAL(16,3) NOT NULL,
    "factor_inventario" DECIMAL(14,3) NOT NULL,
    "cantidad_inventario" DECIMAL(16,3) NOT NULL,
    "costo_presentacion" DECIMAL(14,4) NOT NULL,
    "costo_unitario_inventario" DECIMAL(14,4) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "compras_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compras_proveedor_id_idx" ON "compras"("proveedor_id");

-- CreateIndex
CREATE INDEX "compras_usuario_id_idx" ON "compras"("usuario_id");

-- CreateIndex
CREATE INDEX "compras_creado_en_idx" ON "compras"("creado_en");

-- CreateIndex
CREATE INDEX "compras_estado_idx" ON "compras"("estado");

-- CreateIndex
CREATE INDEX "compras_detalle_compra_id_idx" ON "compras_detalle"("compra_id");

-- CreateIndex
CREATE INDEX "compras_detalle_producto_id_idx" ON "compras_detalle"("producto_id");

-- CreateIndex
CREATE INDEX "compras_detalle_presentacion_id_idx" ON "compras_detalle"("presentacion_id");

-- CreateIndex
CREATE INDEX "movimientos_inventario_compra_id_idx" ON "movimientos_inventario"("compra_id");

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_detalle" ADD CONSTRAINT "compras_detalle_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_detalle" ADD CONSTRAINT "compras_detalle_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras_detalle" ADD CONSTRAINT "compras_detalle_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "presentaciones_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
