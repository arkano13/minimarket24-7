CREATE TABLE "informes_pendientes" (
  "turno_caja_id" INTEGER PRIMARY KEY REFERENCES "turnos_caja"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "turno" VARCHAR(1) NOT NULL,
  "fecha" VARCHAR(10) NOT NULL,
  "proximo_intento" TIMESTAMP(3) NOT NULL,
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "bloqueo_token" TEXT,
  "bloqueo_hasta" TIMESTAMP(3),
  "enviado_en" TIMESTAMP(3),
  "ultimo_error" TEXT,
  "destinatarios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
);
CREATE INDEX "informes_pendientes_enviado_en_proximo_intento_idx"
  ON "informes_pendientes"("enviado_en", "proximo_intento");
CREATE TABLE "informes_entregas" (
  "turno_caja_id" INTEGER NOT NULL REFERENCES "informes_pendientes"("turno_caja_id") ON DELETE CASCADE ON UPDATE CASCADE,
  "destinatario" TEXT NOT NULL,
  "bloqueo_token" TEXT,
  "bloqueo_hasta" TIMESTAMP(3),
  "enviado_en" TIMESTAMP(3),
  "mensaje_id" TEXT,
  PRIMARY KEY ("turno_caja_id", "destinatario")
);
