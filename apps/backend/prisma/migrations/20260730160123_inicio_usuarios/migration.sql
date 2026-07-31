-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMINISTRADOR', 'SUPERVISOR', 'CAJERO', 'BODEGA');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "usuario" VARCHAR(50) NOT NULL,
    "contrasena_hash" VARCHAR(255) NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulos" (
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "modulos_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "usuario_modulo" (
    "usuario_id" INTEGER NOT NULL,
    "modulo_codigo" VARCHAR(30) NOT NULL,
    "permitido" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "usuario_modulo_pkey" PRIMARY KEY ("usuario_id","modulo_codigo")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

-- AddForeignKey
ALTER TABLE "usuario_modulo" ADD CONSTRAINT "usuario_modulo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_modulo" ADD CONSTRAINT "usuario_modulo_modulo_codigo_fkey" FOREIGN KEY ("modulo_codigo") REFERENCES "modulos"("codigo") ON DELETE CASCADE ON UPDATE CASCADE;
