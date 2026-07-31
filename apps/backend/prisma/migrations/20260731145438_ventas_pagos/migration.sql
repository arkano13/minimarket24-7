-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA');

-- AlterTable
ALTER TABLE "movimientos_inventario" ADD COLUMN     "venta_id" INTEGER;

-- CreateTable
CREATE TABLE "ventas" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'COMPLETADA',
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelado_en" TIMESTAMP(3),

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ventas_detalle" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "presentacion_id" INTEGER NOT NULL,
    "producto_nombre" VARCHAR(150) NOT NULL,
    "presentacion_nombre" VARCHAR(80) NOT NULL,
    "cantidad" DECIMAL(16,3) NOT NULL,
    "factor_inventario" DECIMAL(14,3) NOT NULL,
    "cantidad_inventario" DECIMAL(16,3) NOT NULL,
    "costo_unitario" DECIMAL(14,4) NOT NULL,
    "precio_unitario" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "precio_origen" VARCHAR(40) NOT NULL,

    CONSTRAINT "ventas_detalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_venta" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "monto" DECIMAL(14,2) NOT NULL,
    "recibido" DECIMAL(14,2),
    "cambio" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "referencia" VARCHAR(100),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_venta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ventas_creado_en_idx" ON "ventas"("creado_en");

-- CreateIndex
CREATE INDEX "ventas_usuario_id_idx" ON "ventas"("usuario_id");

-- CreateIndex
CREATE INDEX "ventas_estado_idx" ON "ventas"("estado");

-- CreateIndex
CREATE INDEX "ventas_detalle_venta_id_idx" ON "ventas_detalle"("venta_id");

-- CreateIndex
CREATE INDEX "ventas_detalle_producto_id_idx" ON "ventas_detalle"("producto_id");

-- CreateIndex
CREATE INDEX "ventas_detalle_presentacion_id_idx" ON "ventas_detalle"("presentacion_id");

-- CreateIndex
CREATE INDEX "pagos_venta_venta_id_idx" ON "pagos_venta"("venta_id");

-- CreateIndex
CREATE INDEX "pagos_venta_metodo_idx" ON "pagos_venta"("metodo");

-- CreateIndex
CREATE INDEX "movimientos_inventario_venta_id_idx" ON "movimientos_inventario"("venta_id");

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas_detalle" ADD CONSTRAINT "ventas_detalle_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "presentaciones_producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_venta" ADD CONSTRAINT "pagos_venta_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
