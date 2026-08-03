-- CreateEnum
CREATE TYPE "TipoDevolucion" AS ENUM ('CLIENTE', 'PROVEEDOR');

-- CreateTable
CREATE TABLE "devoluciones" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoDevolucion" NOT NULL,
    "venta_id" INTEGER,
    "compra_id" INTEGER,
    "usuario_id" INTEGER NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "motivo" VARCHAR(250),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devoluciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devoluciones_detalle" (
    "id" SERIAL NOT NULL,
    "devolucion_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "presentacion_id" INTEGER NOT NULL,
    "producto_nombre" VARCHAR(150) NOT NULL,
    "presentacion_nombre" VARCHAR(80) NOT NULL,
    "cantidad" DECIMAL(16,3) NOT NULL,
    "factor_inventario" DECIMAL(14,3) NOT NULL,
    "cantidad_inventario" DECIMAL(16,3) NOT NULL,
    "precio_unitario" DECIMAL(14,4) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "devoluciones_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "devoluciones_venta_id_idx" ON "devoluciones"("venta_id");

-- CreateIndex
CREATE INDEX "devoluciones_compra_id_idx" ON "devoluciones"("compra_id");

-- CreateIndex
CREATE INDEX "devoluciones_usuario_id_idx" ON "devoluciones"("usuario_id");

-- CreateIndex
CREATE INDEX "devoluciones_creado_en_idx" ON "devoluciones"("creado_en");

-- CreateIndex
CREATE INDEX "devoluciones_detalle_devolucion_id_idx" ON "devoluciones_detalle"("devolucion_id");

-- CreateIndex
CREATE INDEX "devoluciones_detalle_producto_id_idx" ON "devoluciones_detalle"("producto_id");

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compras"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones" ADD CONSTRAINT "devoluciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_detalle" ADD CONSTRAINT "devoluciones_detalle_devolucion_id_fkey" FOREIGN KEY ("devolucion_id") REFERENCES "devoluciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_detalle" ADD CONSTRAINT "devoluciones_detalle_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devoluciones_detalle" ADD CONSTRAINT "devoluciones_detalle_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "presentaciones_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
