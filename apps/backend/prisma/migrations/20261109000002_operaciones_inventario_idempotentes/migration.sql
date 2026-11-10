-- Una misma solicitud de compra o ajuste solo puede afectar el inventario
-- una vez, aunque se reenvíe o llegue a dos instancias de Railway.
CREATE TABLE "operaciones_idempotentes" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "clave" VARCHAR(64) NOT NULL,
    "respuesta" JSONB NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operaciones_idempotentes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operaciones_idempotentes_usuario_id_tipo_clave_key"
ON "operaciones_idempotentes"("usuario_id", "tipo", "clave");

CREATE INDEX "operaciones_idempotentes_creado_en_idx"
ON "operaciones_idempotentes"("creado_en");
