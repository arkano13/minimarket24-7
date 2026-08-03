import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.js";

const modulos = [
  {
    codigo: "VENTAS",
    nombre: "Punto de venta",
    tipo: "OPERATIVO",
  },
  {
    codigo: "CAJA",
    nombre: "Caja y turnos",
    tipo: "OPERATIVO",
  },
  {
    codigo: "PRODUCTOS",
    nombre: "Productos",
    tipo: "ADMINISTRATIVO",
  },
  {
    codigo: "INVENTARIO",
    nombre: "Inventario",
    tipo: "OPERATIVO",
  },
  {
    codigo: "CLIENTES",
    nombre: "Clientes especiales",
    tipo: "ADMINISTRATIVO",
  },
  {
    codigo: "PROVEEDORES",
    nombre: "Proveedores",
    tipo: "ADMINISTRATIVO",
  },
  {
    codigo: "COMPRAS",
    nombre: "Compras",
    tipo: "OPERATIVO",
  },
  {
    codigo: "REPORTES",
    nombre: "Reportes",
    tipo: "REPORTES",
  },
  {
    codigo: "USUARIOS",
    nombre: "Usuarios",
    tipo: "ADMINISTRATIVO",
  },
  {
    codigo: "CONFIGURACION",
    nombre: "Configuración",
    tipo: "ADMINISTRATIVO",
  },
  {
    codigo: "BITACORA",
    nombre: "Bitácora",
    tipo: "ADMINISTRATIVO",
  },
  {
    codigo: "DEVOLUCIONES",
    nombre: "Cancelar ventas",
    tipo: "OPERATIVO",
  },
];

const franjasPrecio = [
  {
    nombre: "Turno 1",
    minutoInicio: 8 * 60,
    minutoFin: 22 * 60,
    orden: 1,
  },
  {
    nombre: "Turno 2",
    minutoInicio: 22 * 60,
    minutoFin: 2 * 60,
    orden: 2,
  },
  {
    nombre: "Turno 3",
    minutoInicio: 2 * 60,
    minutoFin: 8 * 60,
    orden: 3,
  },
];

const adminPassword =
  process.env.SEED_ADMIN_PASSWORD;

if (
  !adminPassword ||
  adminPassword.length < 8
) {
  throw new Error(
    "Define SEED_ADMIN_PASSWORD con al menos 8 caracteres en apps/backend/.env",
  );
}

async function main() {
  for (const modulo of modulos) {
    await prisma.modulo.upsert({
      where: {
        codigo: modulo.codigo,
      },
      update: modulo,
      create: modulo,
    });
  }

  const contrasenaHash =
    await bcrypt.hash(adminPassword, 12);

  const administrador =
    await prisma.usuario.upsert({
      where: {
        usuario: "admin",
      },
      update: {
        nombre: "Administrador",
        rol: "ADMINISTRADOR",
        activo: true,
      },
      create: {
        nombre: "Administrador",
        usuario: "admin",
        contrasenaHash,
        rol: "ADMINISTRADOR",
      },
    });

  await prisma.usuarioModulo.createMany({
    data: modulos.map((modulo) => ({
      usuarioId: administrador.id,
      moduloCodigo: modulo.codigo,
      permitido: true,
    })),
    skipDuplicates: true,
  });

  for (const franja of franjasPrecio) {
    await prisma.franjaHorariaPrecio.upsert({
      where: {
        nombre: franja.nombre,
      },
      update: {
        minutoInicio: franja.minutoInicio,
        minutoFin: franja.minutoFin,
        orden: franja.orden,
        activo: true,
      },
      create: franja,
    });
  }

  console.log(
    "Datos iniciales creados correctamente.",
  );

  console.log(
    "Usuario de prueba: admin",
  );

  console.log(
    "Turnos de precio creados: 8am-10pm, 10pm-2am y 2am-8am",
  );
}

main()
  .catch((error) => {
    console.error(
      "No se pudieron crear los datos iniciales:",
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });