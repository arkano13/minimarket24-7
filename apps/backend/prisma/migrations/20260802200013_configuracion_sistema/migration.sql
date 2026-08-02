-- CreateTable
CREATE TABLE "configuracion_sistema" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombre_negocio" VARCHAR(120) NOT NULL DEFAULT 'Minisúper',
    "direccion" VARCHAR(250),
    "telefono" VARCHAR(30),
    "simbolo_moneda" VARCHAR(10) NOT NULL DEFAULT 'L',
    "fondo_inicial" DECIMAL(14,2) NOT NULL DEFAULT 500,
    "mensaje_reportes" VARCHAR(300),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("id")
);
