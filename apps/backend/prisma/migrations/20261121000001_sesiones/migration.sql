-- Sesiones persistentes: antes vivían solo en memoria y se perdían en cada
-- reinicio del servidor. IF NOT EXISTS: el servidor también la crea al arrancar.
CREATE TABLE IF NOT EXISTS "sesiones" (
    "token" VARCHAR(64) NOT NULL PRIMARY KEY,
    "usuario_id" INTEGER NOT NULL REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "sesiones_usuario_id_idx" ON "sesiones"("usuario_id");
