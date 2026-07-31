import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

function cleanCategoryName(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(
      "El nombre de la categoría es obligatorio.",
      400,
    );
  }

  const name = value.trim().replace(/\s+/g, " ");

  if (name.length > 100) {
    throw new AppError(
      "El nombre de la categoría no puede superar 100 caracteres.",
      400,
    );
  }

  return name;
}

export async function listCategories() {
  return prisma.categoria.findMany({
    where: {
      activo: true,
    },
    orderBy: {
      nombre: "asc",
    },
    select: {
      id: true,
      nombre: true,
    },
  });
}

export async function createCategory({ nombre }) {
  const name = cleanCategoryName(nombre);

  return prisma.categoria.upsert({
    where: {
      nombre: name,
    },
    update: {
      activo: true,
    },
    create: {
      nombre: name,
    },
    select: {
      id: true,
      nombre: true,
    },
  });
}