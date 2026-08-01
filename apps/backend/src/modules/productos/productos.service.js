import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

const TIPOS_VENTA = {
  UNIDAD: {
    unidadInventario: "UNIDAD",
    nombrePresentacion: "Unidad",
    factorInventario: 1,
  },
  PAQUETE: {
    unidadInventario: "UNIDAD",
    nombrePresentacion: "Paquete",
    factorInventario: 1,
  },
  CAJA: {
    unidadInventario: "UNIDAD",
    nombrePresentacion: "Caja",
    factorInventario: 1,
  },
  PESO: {
    unidadInventario: "GRAMO",
    nombrePresentacion: "Kilogramo",
    factorInventario: 1000,
  },
  VOLUMEN: {
    unidadInventario: "MILILITRO",
    nombrePresentacion: "Litro",
    factorInventario: 1000,
  },
};

function cleanText(value, field, maxLength) {
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

function optionalText(value, maxLength) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const text = String(value).trim();

  if (text.length > maxLength) {
    throw new AppError(
      `El valor no puede superar ${maxLength} caracteres.`,
      400,
    );
  }

  return text || null;
}

function decimalValue(
  value,
  field,
  { positive = false } = {},
) {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0 ||
    (positive && number <= 0)
  ) {
    throw new AppError(
      `${field} debe ser un número ${
        positive
          ? "mayor que cero"
          : "válido"
      }.`,
      400,
    );
  }

  return new Prisma.Decimal(String(number));
}

function optionalCategoryId(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const categoryId = Number(value);

  if (
    !Number.isInteger(categoryId) ||
    categoryId <= 0
  ) {
    throw new AppError(
      "La categoría seleccionada no es válida.",
      400,
    );
  }

  return categoryId;
}

function productIdValue(value) {
  const productId = Number(value);

  if (
    !Number.isInteger(productId) ||
    productId <= 0
  ) {
    throw new AppError(
      "El producto seleccionado no es válido.",
      400,
    );
  }

  return productId;
}

async function getShiftPrices(
  transaction,
  normalPrice,
  shiftTwoPrice,
  shiftThreePrice,
) {
  const shifts =
    await transaction.franjaHorariaPrecio.findMany({
      where: {
        activo: true,
        orden: {
          in: [1, 2, 3],
        },
      },

      orderBy: {
        orden: "asc",
      },
    });

  const shiftOne = shifts.find(
    (shift) => shift.orden === 1,
  );

  const shiftTwo = shifts.find(
    (shift) => shift.orden === 2,
  );

  const shiftThree = shifts.find(
    (shift) => shift.orden === 3,
  );

  if (
    !shiftOne ||
    !shiftTwo ||
    !shiftThree
  ) {
    throw new AppError(
      "No están configurados los tres turnos de precio.",
      400,
    );
  }

  return [
    {
      franjaId: shiftOne.id,
      precio: normalPrice,
    },
    {
      franjaId: shiftTwo.id,
      precio: shiftTwoPrice,
    },
    {
      franjaId: shiftThree.id,
      precio: shiftThreePrice,
    },
  ];
}

function serializeProduct(product) {
  const principal =
    product.presentaciones.find(
      (presentation) =>
        presentation.esPrincipal,
    ) ??
    product.presentaciones[0] ??
    null;

  const factor = principal
    ? Number(principal.factorInventario)
    : 1;

  return {
    id: product.id,
    sku: product.sku,
    nombre: product.nombre,
    descripcion: product.descripcion,
    categoria: product.categoria,
    modoPrecio: product.modoPrecio,
    activo: product.activo,

    stock:
      Number(product.stockActual) / factor,

    stockMinimo:
      Number(product.stockMinimo) / factor,

    costo:
      Number(product.costoPromedio) * factor,

    presentacionPrincipal: principal
      ? {
          id: principal.id,
          nombre: principal.nombre,
          tipo: principal.tipo,
          precio: Number(
            principal.precioBase,
          ),
          factorInventario: factor,

          codigoBarra:
            principal.codigosBarra.find(
              (barcode) =>
                barcode.principal,
            )?.codigo ??
            principal.codigosBarra[0]
              ?.codigo ??
            null,

          preciosTurno:
            principal.preciosHorario.map(
              (shiftPrice) => ({
                turno:
                  shiftPrice.franja.orden,
                nombre:
                  shiftPrice.franja.nombre,
                minutoInicio:
                  shiftPrice.franja
                    .minutoInicio,
                minutoFin:
                  shiftPrice.franja
                    .minutoFin,
                precio: Number(
                  shiftPrice.precio,
                ),
              }),
            ),
        }
      : null,
  };
}

export async function listProducts(
  search = "",
) {
  const term =
    typeof search === "string"
      ? search.trim()
      : "";

  const products =
    await prisma.producto.findMany({
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
                  sku: {
                    contains: term,
                    mode: "insensitive",
                  },
                },

                {
                  presentaciones: {
                    some: {
                      codigosBarra: {
                        some: {
                          codigo: {
                            contains: term,
                          },
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },

      include: {
        categoria: {
          select: {
            id: true,
            nombre: true,
          },
        },

        presentaciones: {
          where: {
            activo: true,
          },

          include: {
            codigosBarra: {
              where: {
                activo: true,
              },
            },

            preciosHorario: {
              include: {
                franja: true,
              },

              orderBy: {
                franja: {
                  orden: "asc",
                },
              },
            },
          },

          orderBy: {
            id: "asc",
          },
        },
      },

      orderBy: {
        nombre: "asc",
      },

      take: 100,
    });

  return products.map(serializeProduct);
}

export async function createProduct(
  data,
  userId,
) {
  const name = cleanText(
    data.nombre,
    "El nombre del producto",
    150,
  );

  const description = optionalText(
    data.descripcion,
    300,
  );

  const sku = optionalText(
    data.sku,
    40,
  );

  const barcode = optionalText(
    data.codigoBarra,
    80,
  );

  const categoryId = optionalCategoryId(
    data.categoriaId,
  );

  const saleType =
    TIPOS_VENTA[data.tipoVenta];

  if (!saleType) {
    throw new AppError(
      "Selecciona una forma de venta válida.",
      400,
    );
  }

  const price = decimalValue(
    data.precio,
    "El precio",
    {
      positive: true,
    },
  );

  const changesByShift =
    data.cambiaPrecioTurno === true;

  const shiftTwoPrice = changesByShift
    ? decimalValue(
        data.precioTurno2,
        "El precio del turno 2",
        {
          positive: true,
        },
      )
    : null;

  const shiftThreePrice = changesByShift
    ? decimalValue(
        data.precioTurno3,
        "El precio del turno 3",
        {
          positive: true,
        },
      )
    : null;

  const cost = decimalValue(
    data.costo ?? 0,
    "El costo",
  );

  const initialStock = decimalValue(
    data.stockInicial ?? 0,
    "La existencia inicial",
  );

  const minimumStock = decimalValue(
    data.stockMinimo ?? 0,
    "La existencia mínima",
  );

  const factor = new Prisma.Decimal(
    saleType.factorInventario,
  );

  const internalStock =
    initialStock.mul(factor);

  const internalMinimum =
    minimumStock.mul(factor);

  const internalCost = cost.div(factor);

  try {
    return await prisma.$transaction(
      async (transaction) => {
        let shiftPrices = [];

        if (changesByShift) {
          shiftPrices = await getShiftPrices(
            transaction,
            price,
            shiftTwoPrice,
            shiftThreePrice,
          );
        }

        if (categoryId) {
          const category =
            await transaction.categoria.findFirst(
              {
                where: {
                  id: categoryId,
                  activo: true,
                },

                select: {
                  id: true,
                },
              },
            );

          if (!category) {
            throw new AppError(
              "La categoría seleccionada no existe.",
              400,
            );
          }
        }

        const product =
          await transaction.producto.create({
            data: {
              sku,
              nombre: name,
              descripcion: description,
              categoriaId: categoryId,
              unidadInventario:
                saleType.unidadInventario,

              modoPrecio: changesByShift
                ? "POR_HORARIO"
                : "UNICO",

              stockActual: internalStock,
              stockMinimo: internalMinimum,
              costoPromedio: internalCost,

              presentaciones: {
                create: {
                  nombre:
                    saleType.nombrePresentacion,

                  tipo: data.tipoVenta,
                  factorInventario: factor,
                  precioBase: price,
                  esPrincipal: true,

                  ...(barcode
                    ? {
                        codigosBarra: {
                          create: {
                            codigo: barcode,
                            principal: true,
                          },
                        },
                      }
                    : {}),

                  ...(changesByShift
                    ? {
                        preciosHorario: {
                          create: shiftPrices,
                        },
                      }
                    : {}),
                },
              },
            },

            include: {
              categoria: {
                select: {
                  id: true,
                  nombre: true,
                },
              },

              presentaciones: {
                include: {
                  codigosBarra: true,

                  preciosHorario: {
                    include: {
                      franja: true,
                    },

                    orderBy: {
                      franja: {
                        orden: "asc",
                      },
                    },
                  },
                },
              },
            },
          });

        if (
          internalStock.greaterThan(0)
        ) {
          await transaction.movimientoInventario.create(
            {
              data: {
                productoId: product.id,
                usuarioId: userId,

                tipo:
                  "INVENTARIO_INICIAL",

                cantidad: internalStock,
                saldoPosterior:
                  internalStock,

                costoUnitario:
                  internalCost,

                motivo:
                  "Existencia registrada al crear el producto.",
              },
            },
          );
        }

        return serializeProduct(product);
      },
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === "P2002") {
        throw new AppError(
          "El SKU o código de barras ya pertenece a otro producto.",
          409,
        );
      }
    }

    throw error;
  }
}

export async function updateProduct(
  productIdInput,
  data,
  userId,
) {
  const productId = productIdValue(
    productIdInput,
  );

  const name = cleanText(
    data.nombre,
    "El nombre del producto",
    150,
  );

  const description = optionalText(
    data.descripcion,
    300,
  );

  const sku = optionalText(
    data.sku,
    40,
  );

  const barcode = optionalText(
    data.codigoBarra,
    80,
  );

  const categoryId = optionalCategoryId(
    data.categoriaId,
  );

  const price = decimalValue(
    data.precio,
    "El precio",
    {
      positive: true,
    },
  );

  const changesByShift =
    data.cambiaPrecioTurno === true;

  const shiftTwoPrice = changesByShift
    ? decimalValue(
        data.precioTurno2,
        "El precio del turno 2",
        {
          positive: true,
        },
      )
    : null;

  const shiftThreePrice = changesByShift
    ? decimalValue(
        data.precioTurno3,
        "El precio del turno 3",
        {
          positive: true,
        },
      )
    : null;

  const visibleCost = decimalValue(
    data.costo ?? 0,
    "El costo",
  );

  const visibleStock = decimalValue(
    data.stockInicial ?? 0,
    "La existencia actual",
  );

  const visibleMinimum = decimalValue(
    data.stockMinimo ?? 0,
    "La existencia mínima",
  );

  try {
    return await prisma.$transaction(
      async (transaction) => {
        const currentProduct =
          await transaction.producto.findFirst(
            {
              where: {
                id: productId,
                activo: true,
              },

              include: {
                presentaciones: {
                  where: {
                    activo: true,
                  },

                  include: {
                    codigosBarra: true,
                  },

                  orderBy: {
                    id: "asc",
                  },
                },
              },
            },
          );

        if (!currentProduct) {
          throw new AppError(
            "El producto seleccionado no existe.",
            404,
          );
        }

        const principal =
          currentProduct.presentaciones.find(
            (presentation) =>
              presentation.esPrincipal,
          ) ??
          currentProduct.presentaciones[0] ??
          null;

        if (!principal) {
          throw new AppError(
            "El producto no tiene una presentación principal.",
            400,
          );
        }

        if (categoryId) {
          const category =
            await transaction.categoria.findFirst(
              {
                where: {
                  id: categoryId,
                  activo: true,
                },

                select: {
                  id: true,
                },
              },
            );

          if (!category) {
            throw new AppError(
              "La categoría seleccionada no existe.",
              400,
            );
          }
        }

        const factor =
          new Prisma.Decimal(
            principal.factorInventario,
          );

        const internalStock =
          visibleStock.mul(factor);

        const internalMinimum =
          visibleMinimum.mul(factor);

        const internalCost =
          visibleCost.div(factor);

        const stockDifference =
          internalStock.sub(
            currentProduct.stockActual,
          );

        const shiftPrices = changesByShift
          ? await getShiftPrices(
              transaction,
              price,
              shiftTwoPrice,
              shiftThreePrice,
            )
          : [];

        await transaction.precioPresentacionHorario.deleteMany(
          {
            where: {
              presentacionId:
                principal.id,
            },
          },
        );

        await transaction.codigoBarraProducto.deleteMany(
          {
            where: {
              presentacionId:
                principal.id,
            },
          },
        );

        await transaction.presentacionProducto.update(
          {
            where: {
              id: principal.id,
            },

            data: {
              precioBase: price,

              ...(barcode
                ? {
                    codigosBarra: {
                      create: {
                        codigo: barcode,
                        principal: true,
                      },
                    },
                  }
                : {}),

              ...(changesByShift
                ? {
                    preciosHorario: {
                      create: shiftPrices,
                    },
                  }
                : {}),
            },
          },
        );

        const product =
          await transaction.producto.update({
            where: {
              id: productId,
            },

            data: {
              sku,
              nombre: name,
              descripcion: description,
              categoriaId: categoryId,

              modoPrecio: changesByShift
                ? "POR_HORARIO"
                : "UNICO",

              stockActual: internalStock,
              stockMinimo: internalMinimum,
              costoPromedio: internalCost,
            },

            include: {
              categoria: {
                select: {
                  id: true,
                  nombre: true,
                },
              },

              presentaciones: {
                where: {
                  activo: true,
                },

                include: {
                  codigosBarra: {
                    where: {
                      activo: true,
                    },
                  },

                  preciosHorario: {
                    include: {
                      franja: true,
                    },

                    orderBy: {
                      franja: {
                        orden: "asc",
                      },
                    },
                  },
                },

                orderBy: {
                  id: "asc",
                },
              },
            },
          });

        if (!stockDifference.isZero()) {
          await transaction.movimientoInventario.create(
            {
              data: {
                productoId: productId,
                usuarioId: userId,

                tipo:
                  stockDifference.greaterThan(
                    0,
                  )
                    ? "AJUSTE_POSITIVO"
                    : "AJUSTE_NEGATIVO",

                cantidad:
                  stockDifference.abs(),

                saldoPosterior:
                  internalStock,

                costoUnitario:
                  internalCost,

                motivo:
                  "Existencia ajustada al editar el producto.",
              },
            },
          );
        }

        return serializeProduct(product);
      },
    );
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (
      error instanceof
      Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === "P2002") {
        throw new AppError(
          "El SKU o código de barras ya pertenece a otro producto.",
          409,
        );
      }
    }

    throw error;
  }
}