import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

const PURCHASE_INCLUDE = {
  proveedor: {
    select: {
      id: true,
      nombre: true,
    },
  },

  usuario: {
    select: {
      id: true,
      nombre: true,
    },
  },

  detalles: {
    orderBy: {
      id: "asc",
    },
  },
};

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

function positiveDecimal(value, field) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new AppError(
      `${field} debe ser mayor que cero.`,
      400,
    );
  }

  return new Prisma.Decimal(String(number));
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

function serializePurchase(purchase) {
  return {
    id: purchase.id,

    proveedor: {
      id: purchase.proveedorId,
      nombre: purchase.proveedorNombre,
    },

    usuario: purchase.usuario,
    numeroDocumento: purchase.numeroDocumento,
    notas: purchase.notas,
    total: Number(purchase.total),
    estado: purchase.estado,
    creadoEn: purchase.creadoEn,
    anuladaEn: purchase.anuladaEn,

    productos: purchase.detalles.map((detail) => ({
      id: detail.id,
      productoId: detail.productoId,
      presentacionId: detail.presentacionId,
      nombre: detail.productoNombre,
      presentacion: detail.presentacionNombre,
      cantidad: Number(detail.cantidad),
      factorInventario: Number(
        detail.factorInventario,
      ),
      cantidadInventario: Number(
        detail.cantidadInventario,
      ),
      costo: Number(detail.costoPresentacion),
      costoInventario: Number(
        detail.costoUnitarioInventario,
      ),
      subtotal: Number(detail.subtotal),
    })),
  };
}

export async function searchPurchaseSuppliers(
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

    select: {
      id: true,
      nombre: true,
      contacto: true,
      telefono: true,
    },

    orderBy: {
      nombre: "asc",
    },

    take: 100,
  });
}

export async function searchPurchaseProducts(
  search = "",
) {
  const term =
    typeof search === "string"
      ? search.trim()
      : "";

  if (!term) {
    return [];
  }

  const presentations =
    await prisma.presentacionProducto.findMany({
      where: {
        activo: true,

        producto: {
          activo: true,
          controlaInventario: true,
        },

        OR: [
          {
            producto: {
              nombre: {
                contains: term,
                mode: "insensitive",
              },
            },
          },

          {
            producto: {
              sku: {
                contains: term,
                mode: "insensitive",
              },
            },
          },

          {
            codigosBarra: {
              some: {
                activo: true,

                codigo: {
                  contains: term,
                },
              },
            },
          },
        ],
      },

      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            sku: true,
            stockActual: true,
            costoPromedio: true,
            unidadInventario: true,
          },
        },

        codigosBarra: {
          where: {
            activo: true,
          },

          orderBy: {
            principal: "desc",
          },
        },
      },

      orderBy: [
        {
          producto: {
            nombre: "asc",
          },
        },

        {
          id: "asc",
        },
      ],

      take: 40,
    });

  return presentations.map((presentation) => {
    const factor = Number(
      presentation.factorInventario,
    );

    return {
      presentacionId: presentation.id,
      productoId: presentation.producto.id,
      nombre: presentation.producto.nombre,
      sku: presentation.producto.sku,
      presentacion: presentation.nombre,
      tipoVenta: presentation.tipo,
      factorInventario: factor,

      stock:
        Number(
          presentation.producto.stockActual,
        ) / factor,

      costoSugerido:
        Number(
          presentation.producto.costoPromedio,
        ) * factor,

      codigoBarra:
        presentation.codigosBarra[0]?.codigo ??
        null,
    };
  });
}

export async function listPurchases(
  search = "",
) {
  const term =
    typeof search === "string"
      ? search.trim()
      : "";

  const purchases = await prisma.compra.findMany({
    where: term
      ? {
          OR: [
            {
              proveedorNombre: {
                contains: term,
                mode: "insensitive",
              },
            },

            {
              numeroDocumento: {
                contains: term,
                mode: "insensitive",
              },
            },
          ],
        }
      : undefined,

    include: PURCHASE_INCLUDE,

    orderBy: {
      creadoEn: "desc",
    },

    take: 100,
  });

  return purchases.map(serializePurchase);
}

export async function getPurchase(
  purchaseIdInput,
) {
  const purchaseId = positiveInteger(
    purchaseIdInput,
    "La compra",
  );

  const purchase = await prisma.compra.findUnique({
    where: {
      id: purchaseId,
    },

    include: PURCHASE_INCLUDE,
  });

  if (!purchase) {
    throw new AppError(
      "La compra no existe.",
      404,
    );
  }

  return serializePurchase(purchase);
}

export async function createPurchase(
  data,
  userId,
) {
  const supplierId = positiveInteger(
    data.proveedorId,
    "El proveedor",
  );

  const documentNumber = optionalText(
    data.numeroDocumento,
    "El número de documento",
    100,
  );

  const notes = optionalText(
    data.notas,
    "Las notas",
    250,
  );

  if (
    !Array.isArray(data.productos) ||
    data.productos.length === 0
  ) {
    throw new AppError(
      "Agrega al menos un producto a la compra.",
      400,
    );
  }

  if (data.productos.length > 100) {
    throw new AppError(
      "La compra no puede superar 100 productos.",
      400,
    );
  }

  const items = new Map();

  for (const item of data.productos) {
    const presentationId = positiveInteger(
      item.presentacionId,
      "La presentación",
    );

    if (items.has(presentationId)) {
      throw new AppError(
        "El mismo producto aparece más de una vez.",
        400,
      );
    }

    items.set(presentationId, {
      cantidad: positiveDecimal(
        item.cantidad,
        "La cantidad",
      ),

      costo: positiveDecimal(
        item.costo,
        "El costo",
      ),
    });
  }

  return prisma.$transaction(
    async (transaction) => {
      const supplier =
        await transaction.proveedor.findFirst({
          where: {
            id: supplierId,
            activo: true,
          },

          select: {
            id: true,
            nombre: true,
          },
        });

      if (!supplier) {
        throw new AppError(
          "El proveedor no existe o está inactivo.",
          404,
        );
      }

      const presentationIds = [
        ...items.keys(),
      ];

      const presentations =
        await transaction.presentacionProducto.findMany(
          {
            where: {
              id: {
                in: presentationIds,
              },

              activo: true,

              producto: {
                activo: true,
                controlaInventario: true,
              },
            },

            include: {
              producto: true,
            },
          },
        );

      if (
        presentations.length !==
        presentationIds.length
      ) {
        throw new AppError(
          "Uno de los productos ya no está disponible.",
          400,
        );
      }

      const details = [];
      const incomingByProduct = new Map();
      let total = new Prisma.Decimal(0);

      for (const presentation of presentations) {
        const item = items.get(
          presentation.id,
        );

        const factor = new Prisma.Decimal(
          presentation.factorInventario,
        );

        const inventoryQuantity =
          item.cantidad.mul(factor);

        const inventoryUnitCost = item.costo
          .div(factor)
          .toDecimalPlaces(4);

        const incomingValue =
          item.cantidad.mul(item.costo);

        const subtotal =
          incomingValue.toDecimalPlaces(2);

        const currentIncoming =
          incomingByProduct.get(
            presentation.productoId,
          );

        incomingByProduct.set(
          presentation.productoId,
          {
            producto: presentation.producto,

            cantidad: currentIncoming
              ? currentIncoming.cantidad.add(
                  inventoryQuantity,
                )
              : inventoryQuantity,

            valor: currentIncoming
              ? currentIncoming.valor.add(
                  incomingValue,
                )
              : incomingValue,
          },
        );

        details.push({
          productoId: presentation.productoId,
          presentacionId: presentation.id,
          productoNombre:
            presentation.producto.nombre,
          presentacionNombre:
            presentation.nombre,
          cantidad: item.cantidad,
          factorInventario: factor,
          cantidadInventario:
            inventoryQuantity,
          costoPresentacion: item.costo,
          costoUnitarioInventario:
            inventoryUnitCost,
          subtotal,
        });

        total = total.add(subtotal);
      }

      const purchase =
        await transaction.compra.create({
          data: {
            proveedorId: supplierId,
            usuarioId: userId,
            proveedorNombre: supplier.nombre,
            numeroDocumento: documentNumber,
             notas: notes,  
            total,

            detalles: {
              create: details,
            },
          },

          include: PURCHASE_INCLUDE,
        });

      for (
        const [
          productId,
          incoming,
        ] of incomingByProduct.entries()
      ) {
        const currentStock =
          new Prisma.Decimal(
            incoming.producto.stockActual,
          );

        const currentCost =
          new Prisma.Decimal(
            incoming.producto.costoPromedio,
          );

        const newStock = currentStock.add(
          incoming.cantidad,
        );

        const currentValue =
          currentStock.mul(currentCost);

        const newAverageCost = currentValue
          .add(incoming.valor)
          .div(newStock)
          .toDecimalPlaces(4);

        const updatedProduct =
          await transaction.producto.update({
            where: {
              id: productId,
            },

            data: {
              stockActual: newStock,
              costoPromedio: newAverageCost,
            },

            select: {
              stockActual: true,
              costoPromedio: true,
            },
          });

        await transaction.movimientoInventario.create(
          {
            data: {
              productoId: productId,
              usuarioId: userId,
              compraId: purchase.id,
              tipo: "COMPRA",
              cantidad: incoming.cantidad,
              saldoPosterior:
                updatedProduct.stockActual,
              costoUnitario:
                updatedProduct.costoPromedio,
              motivo:
                `Compra #${purchase.id} a ` +
                `${supplier.nombre}.`,
            },
          },
        );
      }

      return serializePurchase(purchase);
    },
  );
}