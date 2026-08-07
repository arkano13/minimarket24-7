import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

const MOVEMENT_TYPES = {
  ENTRADA: {
    databaseType: "COMPRA",
    direction: 1,
    defaultReason: "Entrada de inventario.",
  },

  SALIDA: {
    databaseType: "AJUSTE_NEGATIVO",
    direction: -1,
    defaultReason: null,
  },
};

function positiveInteger(value, field) {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number <= 0
  ) {
    throw new AppError(
      `${field} no es válido.`,
      400,
    );
  }

  return number;
}

function decimalValue(
  value,
  field,
  { required = true } = {},
) {
  if (
    !required &&
    (
      value === undefined ||
      value === null ||
      value === ""
    )
  ) {
    return null;
  }

  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number <= 0
  ) {
    throw new AppError(
      `${field} debe ser mayor que cero.`,
      400,
    );
  }

  return new Prisma.Decimal(
    String(number),
  );
}

function optionalText(value, maxLength) {
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
      `El motivo no puede superar ${maxLength} caracteres.`,
      400,
    );
  }

  return text || null;
}

function getPrincipalPresentation(product) {
  return (
    product.presentaciones.find(
      (presentation) =>
        presentation.esPrincipal,
    ) ??
    product.presentaciones[0] ??
    null
  );
}

function serializeMovement(movement) {
  const presentation =
    getPrincipalPresentation(
      movement.producto,
    );

  const factor = presentation
    ? Number(
        presentation.factorInventario,
      )
    : 1;

  return {
    id: movement.id,
    tipo: movement.tipo,

    cantidad:
      Number(movement.cantidad) /
      factor,

    saldoPosterior:
      Number(movement.saldoPosterior) /
      factor,

    costo: movement.costoUnitario
      ? Number(movement.costoUnitario) *
        factor
      : null,

    motivo: movement.motivo,
    creadoEn: movement.creadoEn,

    producto: {
      id: movement.producto.id,
      nombre: movement.producto.nombre,

      presentacion:
        presentation?.nombre ??
        "Unidad",

      tipoVenta:
        presentation?.tipo ??
        "UNIDAD",
    },

    usuario: movement.usuario
      ? {
          id: movement.usuario.id,
          nombre:
            movement.usuario.nombre,
        }
      : null,
  };
}

const MOVEMENT_INCLUDE = {
  producto: {
    include: {
      presentaciones: {
        where: {
          activo: true,
        },

        orderBy: {
          id: "asc",
        },
      },
    },
  },

  usuario: {
    select: {
      id: true,
      nombre: true,
    },
  },
};

export async function listInventoryMovements(
  productIdInput,
  pageInput,
  perPageInput,
) {
  const productId =
    productIdInput === undefined ||
    productIdInput === null ||
    productIdInput === ""
      ? null
      : positiveInteger(
          productIdInput,
          "El producto",
        );

  const page = Math.max(1, Number(pageInput) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, Number(perPageInput) || 25),
  );

  const where = productId
    ? { productoId: productId }
    : undefined;

  const [movements, total] = await Promise.all([
    prisma.movimientoInventario.findMany({
      where,
      include: MOVEMENT_INCLUDE,
      orderBy: { creadoEn: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),

    prisma.movimientoInventario.count({ where }),
  ]);

  return {
    total,
    page,
    perPage,
    movimientos: movements.map(serializeMovement),
  };
}

export async function createInventoryMovement(
  data,
  userId,
) {
  const productId = positiveInteger(
    data.productoId,
    "El producto",
  );

  const movementType =
    MOVEMENT_TYPES[
      data.tipoMovimiento
    ];

  if (!movementType) {
    throw new AppError(
      "Selecciona un tipo de movimiento válido.",
      400,
    );
  }

  const visibleQuantity = decimalValue(
    data.cantidad,
    "La cantidad",
  );

  const visibleCost =
    data.tipoMovimiento === "ENTRADA"
      ? decimalValue(
          data.costo,
          "El costo",
          {
            required: false,
          },
        )
      : null;

  const reason = optionalText(
    data.motivo,
    250,
  );

  if (
    data.tipoMovimiento === "SALIDA" &&
    !reason
  ) {
    throw new AppError(
      "Escribe el motivo de la salida.",
      400,
    );
  }

  return prisma.$transaction(
    async (transaction) => {
      const product =
        await transaction.producto.findFirst({
          where: {
            id: productId,
            activo: true,
            controlaInventario: true,
          },

          include: {
            presentaciones: {
              where: {
                activo: true,
              },

              orderBy: {
                id: "asc",
              },
            },
          },
        });

      if (!product) {
        throw new AppError(
          "El producto seleccionado no existe.",
          404,
        );
      }

      const presentation =
        getPrincipalPresentation(product);

      if (!presentation) {
        throw new AppError(
          "El producto no tiene una presentación principal.",
          400,
        );
      }

      const factor =
        new Prisma.Decimal(
          presentation.factorInventario,
        );

      const internalQuantity =
        visibleQuantity.mul(factor);

      const currentStock =
        new Prisma.Decimal(
          product.stockActual,
        );

      if (
        movementType.direction < 0 &&
        internalQuantity.greaterThan(
          currentStock,
        )
      ) {
        throw new AppError(
          "La salida supera la existencia disponible.",
          400,
        );
      }

      const newStock =
        movementType.direction > 0
          ? currentStock.add(
              internalQuantity,
            )
          : currentStock.sub(
              internalQuantity,
            );

      let movementCost =
        new Prisma.Decimal(
          product.costoPromedio,
        );

      let newAverageCost = movementCost;

      if (visibleCost) {
        movementCost =
          visibleCost.div(factor);

        const previousValue =
          currentStock.mul(
            product.costoPromedio,
          );

        const entryValue =
          internalQuantity.mul(
            movementCost,
          );

        newAverageCost =
          newStock.greaterThan(0)
            ? previousValue
                .add(entryValue)
                .div(newStock)
            : movementCost;
      }

      await transaction.producto.update({
        where: {
          id: productId,
        },

        data: {
          stockActual: newStock,
          costoPromedio:
            newAverageCost,
        },
      });

      const movement =
        await transaction
          .movimientoInventario
          .create({
            data: {
              productoId: productId,
              usuarioId: userId,

              tipo:
                movementType.databaseType,

              cantidad:
                internalQuantity,

              saldoPosterior:
                newStock,

              costoUnitario:
                movementCost,

              motivo:
                reason ??
                movementType.defaultReason,
            },

            include:
              MOVEMENT_INCLUDE,
          });

      return serializeMovement(
        movement,
      );
    },
  );
}