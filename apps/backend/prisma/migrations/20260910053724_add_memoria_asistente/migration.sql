-- CreateEnum
CREATE TYPE "CanalAsistente" AS ENUM ('TELEGRAM', 'WHATSAPP');

-- CreateTable
CREATE TABLE "conversaciones_asistente" (
    "id" SERIAL NOT NULL,
    "canal" "CanalAsistente" NOT NULL,
    "identificador" VARCHAR(100) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversaciones_asistente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensajes_asistente" (
    "id" SERIAL NOT NULL,
    "conversacion_id" INTEGER NOT NULL,
    "rol" VARCHAR(20) NOT NULL,
    "contenido" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensajes_asistente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversaciones_asistente_canal_identificador_key" ON "conversaciones_asistente"("canal", "identificador");

-- CreateIndex
CREATE INDEX "mensajes_asistente_conversacion_id_creado_en_idx" ON "mensajes_asistente"("conversacion_id", "creado_en");

-- AddForeignKey
ALTER TABLE "mensajes_asistente" ADD CONSTRAINT "mensajes_asistente_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversaciones_asistente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
