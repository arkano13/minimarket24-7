-- DropIndex
DROP INDEX "codigos_barra_producto_codigo_key";

-- CreateIndex
CREATE INDEX "codigos_barra_producto_codigo_idx" ON "codigos_barra_producto"("codigo");
