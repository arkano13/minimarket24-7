import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

function positiveInteger(value, field) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new AppError(
      `${field} no es válido.`,
      400,
    );
  }

  return number;
}

function requiredText(value, field, maxLength) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new AppError(
      `${field} es obligatorio.`,
      400,
    );
  }

  const text = value
    .trim()
    .replace(/\s+/g, " ");

  if (text.length > maxLength) {
    throw new AppError(
      `${field} no puede superar ${maxLength} caracteres.`,
      400,
    );
  }

  return text;
}

function optionalText(value, field, maxLength) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const text = String(value)
    .trim()
    .replace(/\s+/g, " ");

  if (text.length > maxLength) {
    throw new AppError(
      `${field} no puede superar ${maxLength} caracteres.`,
      400,
    );
  }

  return text || null;
}

function optionalEmail(value) {
  const email = optionalText(
    value,
    "El correo",
    150,
  );

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new AppError(
      "Escribe un correo válido.",
      400,
    );
  }

  return email?.toLowerCase() ?? null;
}

function supplierData(data, partial = false) {
  return {
    ...(!partial || data.nombre !== undefined
      ? {
          nombre: requiredText(
            data.nombre,
            "El nombre",
            150,
          ),
        }
      : {}),

    ...(data.contacto !== undefined || !partial
      ? {
          contacto: optionalText(
            data.contacto,
            "El contacto",
            120,
          ),
        }
      : {}),

    ...(data.telefono !== undefined || !partial
      ? {
          telefono: optionalText(
            data.telefono,
            "El teléfono",
            30,
          ),
        }
      : {}),

    ...(data.correo !== undefined || !partial
      ? {
          correo: optionalEmail(data.correo),
        }
      : {}),

    ...(data.direccion !== undefined || !partial
      ? {
          direccion: optionalText(
            data.direccion,
            "La dirección",
            250,
          ),
        }
      : {}),

    ...(data.notas !== undefined || !partial
      ? {
          notas: optionalText(
            data.notas,
            "Las notas",
            250,
          ),
        }
      : {}),

    ...(partial &&
    typeof data.activo === "boolean"
      ? {
          activo: data.activo,
        }
      : {}),
  };
}

export async function listSuppliers(
  search = "",
) {
  const term =
    typeof search === "string"
      ? search.trim()
      : "";

  return prisma.proveedor.findMany({
    where: {
      activo: true,

      ...(term
        ? {
            OR: [
              {
                nombre: {
                  contains: term,
                  mode: "insensitive",
                },
              },

              {
                contacto: {
                  contains: term,
                  mode: "insensitive",
                },
              },

              {
                telefono: {
                  contains: term,
                },
              },
            ],
          }
        : {}),
    },

    orderBy: {
      nombre: "asc",
    },

    take: 150,
  });
}

export async function createSupplier(data) {
  return prisma.proveedor.create({
    data: supplierData(data),
  });
}

export async function updateSupplier(
  supplierIdInput,
  data,
) {
  const supplierId = positiveInteger(
    supplierIdInput,
    "El proveedor",
  );

  const currentSupplier =
    await prisma.proveedor.findUnique({
      where: {
        id: supplierId,
      },

      select: {
        id: true,
      },
    });

  if (!currentSupplier) {
    throw new AppError(
      "El proveedor no existe.",
      404,
    );
  }

  return prisma.proveedor.update({
    where: {
      id: supplierId,
    },

    data: supplierData(data, true),
  });
}