-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "cliente_especial_id" INTEGER,
ADD COLUMN     "cliente_nombre" VARCHAR(120);

-- CreateTable
CREATE TABLE "clientes_especiales" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "telefono" VARCHAR(30),
    "notas" VARCHAR(250),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_especiales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precios_especiales_cliente" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "presentacion_id" INTEGER NOT NULL,
    "precio" DECIMAL(14,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "precios_especiales_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_especiales_nombre_idx" ON "clientes_especiales"("nombre");

-- CreateIndex
CREATE INDEX "clientes_especiales_telefono_idx" ON "clientes_especiales"("telefono");

-- CreateIndex
CREATE INDEX "clientes_especiales_activo_idx" ON "clientes_especiales"("activo");

-- CreateIndex
CREATE INDEX "precios_especiales_cliente_cliente_id_idx" ON "precios_especiales_cliente"("cliente_id");

-- CreateIndex
CREATE INDEX "precios_especiales_cliente_presentacion_id_idx" ON "precios_especiales_cliente"("presentacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "precios_especiales_cliente_cliente_id_presentacion_id_key" ON "precios_especiales_cliente"("cliente_id", "presentacion_id");

-- CreateIndex
CREATE INDEX "ventas_cliente_especial_id_idx" ON "ventas"("cliente_especial_id");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_especial_id_fkey" FOREIGN KEY ("cliente_especial_id") REFERENCES "clientes_especiales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_especiales_cliente" ADD CONSTRAINT "precios_especiales_cliente_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes_especiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precios_especiales_cliente" ADD CONSTRAINT "precios_especiales_cliente_presentacion_id_fkey" FOREIGN KEY ("presentacion_id") REFERENCES "presentaciones_producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
