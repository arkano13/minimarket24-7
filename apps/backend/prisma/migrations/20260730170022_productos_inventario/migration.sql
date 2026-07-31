-- CreateEnum
CREATE TYPE "UnidadInventario" AS ENUM ('UNIDAD', 'GRAMO', 'MILILITRO');

-- CreateEnum
CREATE TYPE "TipoPresentacion" AS ENUM ('UNIDAD', 'PAQUETE', 'CAJA', 'PESO', 'VOLUMEN');

-- CreateEnum
CREATE TYPE "ModoPrecio" AS ENUM ('UNICO', 'POR_HORARIO');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('INVENTARIO_INICIAL', 'COMPRA', 'VENTA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_PROVEEDOR', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'CANCELACION_VENTA');

-- CreateTable
CREATE TABLE "categorias" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(40),
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" VARCHAR(300),
    "categoria_id" INTEGER,
    "unidad_inventario" "UnidadInventario" NOT NULL,
    "modo_precio" "ModoPrecio" NOT NULL DEFAULT 'UNICO',
    "stock_actual" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(16,3) NOT NULL DEFAULT 0,
    "costo_promedio" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "controla_inventario" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presentaciones_producto" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "tipo" "TipoPresentacion" NOT NULL,
    "factor_inventario" DECIMAL(14,3) NOT NULL,
    "precio_base" DECIMAL(14,2) NOT NULL,
    "es_principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentaciones_producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_barra_producto" (
    "id" SERIAL NOT NULL,
    "presentacion_id" INTEGER NOT NULL,
    "codigo" VARCHAR(80) NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "codigos_barra_producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franjas_horarias_precio" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "minuto_inicio" INTEGER NOT NULL,
    "minuto_fin" INTEGER NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "franjas_horarias_precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_presentacion_horario" (
    "presentacion_id" INTEGER NOT NULL,
    "franja_id" INTEGER NOT NULL,
    "precio" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "precios_presentacion_horario_pkey" PRIMARY KEY ("presentacion_id","franja_id")
);

-- CreateTable
CREATE TABLE "movimientos_inventario" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "usuario_id" INTEGER,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" DECIMAL(16,3) NOT NULL,
    "saldo_posterior" DECIMAL(16,3) NOT NULL,
    "costo_unitario" DECIMAL(14,4),
    "motivo" VARCHAR(250),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimientos_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "productos_sku_key" ON "productos"("sku");

-- CreateIndex
CREATE INDEX "productos_nombre_idx" ON "productos"("nombre");

-- CreateIndex
CREATE INDEX "productos_categoria_id_idx" ON "productos"("categoria_id");

-- CreateIndex
CREATE INDEX "presentaciones_producto_producto_id_idx" ON "presentaciones_producto"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "presentaciones_producto_producto_id_nombre_key" ON "presentaciones_producto"("producto_id", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "codigos_barra_producto_codigo_key" ON "codigos_barra_producto"("codigo");

-- CreateIndex
CREATE INDEX "codigos_barra_producto_presentacion_id_idx" ON "codigos_barra_producto"("presentacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "franjas_horarias_precio_nombre_key" ON "franjas_horarias_precio"("nombre");

-- CreateIndex
CREATE INDEX "movimientos_inventario_producto_id_creado_en_idx" ON "movimientos_inventario"("producto_id", "creado_en");

-- CreateIndex
CREATE INDEX "movimientos_inventario_usuario_id_idx" ON "movimientos_inventario"("usuario_id");

-- AddForeignKey
ALTER TABLE "productos" ADD CONSTRAINT "productos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presentaciones_producto" ADD CONSTRAINT "presentaciones_producto_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_barra_producto" ADD CONSTRAINT "codigos_barra_producto_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "presentaciones_producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_presentacion_horario" ADD CONSTRAINT "precios_presentacion_horario_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "presentaciones_producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_presentacion_horario" ADD CONSTRAINT "precios_presentacion_horario_franja_id_fkey" FOREIGN KEY ("franja_id") REFERENCES "franjas_horarias_precio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_inventario" ADD CONSTRAINT "movimientos_inventario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
