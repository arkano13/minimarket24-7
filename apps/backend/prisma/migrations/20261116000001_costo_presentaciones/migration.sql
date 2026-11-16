-- Costo propio por presentación (null = costo del producto × factor).
-- IF NOT EXISTS: el servidor también la crea al arrancar (asegurar-esquema.js).
ALTER TABLE "presentaciones_producto" ADD COLUMN IF NOT EXISTS "costo" DECIMAL(14,2);
