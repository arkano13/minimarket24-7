-- Conserva la clave del cobro para impedir ventas duplicadas incluso si el
-- backend se reinicia o Railway atiende el reintento desde otra instancia.
ALTER TABLE "ventas" ADD COLUMN "clave_venta" VARCHAR(64);
CREATE UNIQUE INDEX "ventas_usuario_id_clave_venta_key"
  ON "ventas"("usuario_id", "clave_venta");
