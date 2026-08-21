-- AlterTable
ALTER TABLE "productos" ADD COLUMN     "es_compuesto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "componentes_producto" (
    "id" SERIAL NOT NULL,
    "producto_padre_id" INTEGER NOT NULL,
    "producto_componente_id" INTEGER NOT NULL,
    "cantidad" DECIMAL(16,3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "componentes_producto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "componentes_producto_producto_padre_id_producto_componente__key" ON "componentes_producto"("producto_padre_id", "producto_componente_id");

-- AddForeignKey
ALTER TABLE "componentes_producto" ADD CONSTRAINT "componentes_producto_producto_padre_id_fkey" FOREIGN KEY ("producto_padre_id") REFERENCES "productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "componentes_producto" ADD CONSTRAINT "componentes_producto_producto_componente_id_fkey" FOREIGN KEY ("producto_componente_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
