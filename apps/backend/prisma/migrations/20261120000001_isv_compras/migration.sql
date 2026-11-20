-- ISV por línea de compra y último ISV usado por producto.
-- IF NOT EXISTS: el servidor también lo aplica al arrancar (asegurar-esquema.js).
ALTER TABLE "compras_detalle" ADD COLUMN IF NOT EXISTS "isv_porcentaje" SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE "compras_detalle" ADD COLUMN IF NOT EXISTS "isv_monto" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "productos" ADD COLUMN IF NOT EXISTS "isv_compra" SMALLINT NOT NULL DEFAULT 0;
