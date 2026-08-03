import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

import { AppError } from "../../utils/AppError.js";
import { registrarBitacora } from "../bitacora/bitacora.service.js";

const PAYMENT_METHODS = new Set(["EFECTIVO", "TARJETA", "TRANSFERENCIA"]);

function positiveInteger(value, field) {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new AppError(`${field} no es válido.`, 400);
  }

  return number;
}

function optionalPositiveInteger(value, field) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return positiveInteger(value, field);
}

function positiveDecimal(value, field) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new AppError(`${field} debe ser mayor que cero.`, 400);
  }

  return new Prisma.Decimal(String(number));
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim().replace(/\s+/g, " ");

  if (text.length > maxLength) {
    throw new AppError(
      `La referencia no puede superar ${maxLength} caracteres.`,
      400,
    );
  }

  return text || null;
}

function currentMinute(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function shiftContainsMinute(shift, minute) {
  if (shift.minutoInicio < shift.minutoFin) {
    return minute >= shift.minutoInicio && minute < shift.minutoFin;
  }

  return minute >= shift.minutoInicio || minute < shift.minutoFin;
}

function getCurrentPrice(presentation, priceMode, minute) {
  const specialPrice = presentation.preciosEspeciales?.[0];

  if (specialPrice) {
    return {
      price: new Prisma.Decimal(specialPrice.precio),

      origin: "CLIENTE_ESPECIAL",

      shift: null,
      special: true,
    };
  }

  if (priceMode !== "POR_HORARIO") {
    return {
      price: new Prisma.Decimal(presentation.precioBase),

      origin: "NORMAL",
      shift: null,
      special: false,
    };
  }

  const currentShiftPrice = presentation.preciosHorario.find(
    (shiftPrice) =>
      shiftPrice.franja.activo &&
      shiftContainsMinute(shiftPrice.franja, minute),
  );

  if (!currentShiftPrice) {
    return {
      price: new Prisma.Decimal(presentation.precioBase),

      origin: "NORMAL",
      shift: null,
      special: false,
    };
  }

  return {
    price: new Prisma.Decimal(currentShiftPrice.precio),

    origin: `TURNO_${currentShiftPrice.franja.orden}`,

    shift: {
      numero: currentShiftPrice.franja.orden,

      nombre: currentShiftPrice.franja.nombre,
    },

    special: false,
  };
}

function principalBarcode(presentation) {
  return (
    presentation.codigosBarra.find((barcode) => barcode.principal)?.codigo ??
    presentation.codigosBarra[0]?.codigo ??
    null
  );
}

function serializeSale(sale) {
  const payment = sale.pagos[0] ?? null;

  return {
    id: sale.id,
    estado: sale.estado,
    subtotal: Number(sale.subtotal),
    total: Number(sale.total),
    creadoEn: sale.creadoEn,

    cliente: sale.clienteEspecialId
      ? {
          id: sale.clienteEspecialId,

          nombre: sale.clienteNombre,
        }
      : null,

    usuario: {
      id: sale.usuario.id,
      nombre: sale.usuario.nombre,
    },

    pago: payment
      ? {
          metodo: payment.metodo,

          monto: Number(payment.monto),

          recibido: payment.recibido ? Number(payment.recibido) : null,

          cambio: Number(payment.cambio),

          referencia: payment.referencia,
        }
      : null,

    productos: sale.detalles.map((detail) => ({
      id: detail.id,

      productoId: detail.productoId,

      presentacionId: detail.presentacionId,

      nombre: detail.productoNombre,

      presentacion: detail.presentacionNombre,

      cantidad: Number(detail.cantidad),

      precio: Number(detail.precioUnitario),

      subtotal: Number(detail.subtotal),

      precioOrigen: detail.precioOrigen,
    })),
  };
}

const SALE_INCLUDE = {
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

  pagos: {
    orderBy: {
      id: "asc",
    },
  },
};
export async function searchSaleClients(search = "") {
  const term = typeof search === "string" ? search.trim() : "";

  return prisma.clienteEspecial.findMany({
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
      telefono: true,
    },
    orderBy: {
      nombre: "asc",
    },
    take: 50,
  });
}

export async function searchSaleProducts(search = "", clientIdInput = null) {
  const term = typeof search === "string" ? search.trim() : "";

  const clientId = optionalPositiveInteger(clientIdInput, "El cliente");

  const minute = currentMinute();

  if (clientId) {
    const client = await prisma.clienteEspecial.findFirst({
      where: {
        id: clientId,
        activo: true,
      },

      select: {
        id: true,
      },
    });

    if (!client) {
      throw new AppError("El cliente especial no existe o está inactivo.", 404);
    }
  }

  const presentations = await prisma.presentacionProducto.findMany({
    where: {
      activo: true,

      producto: {
        activo: true,
      },

      ...(term
        ? {
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
          }
        : {}),
    },

    include: {
      producto: {
        include: {
          categoria: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      },

      codigosBarra: {
        where: {
          activo: true,
        },
      },

      preciosHorario: {
        include: {
          franja: true,
        },
      },

      preciosEspeciales: {
        where: {
          activo: true,

          clienteId: clientId ?? -1,
        },

        take: 1,
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

    take: 50,
  });

  return presentations
    .map((presentation) => {
      const factor = Number(presentation.factorInventario);

      const currentPrice = getCurrentPrice(
        presentation,
        presentation.producto.modoPrecio,
        minute,
      );

      const barcode = principalBarcode(presentation);

      return {
        presentacionId: presentation.id,

        productoId: presentation.producto.id,

        nombre: presentation.producto.nombre,

        presentacion: presentation.nombre,

        tipoVenta: presentation.tipo,

        codigoBarra: barcode,

        sku: presentation.producto.sku,

        categoria: presentation.producto.categoria,

        stock: Number(presentation.producto.stockActual) / factor,

        precio: Number(currentPrice.price),

        precioOrigen: currentPrice.origin,

        turno: currentPrice.shift,

        precioEspecial: currentPrice.special,

        coincidenciaExacta:
          Boolean(term) &&
          presentation.codigosBarra.some((item) => item.codigo === term),
      };
    })
    .sort(
      (first, second) =>
        Number(second.coincidenciaExacta) - Number(first.coincidenciaExacta),
    );
}

export async function repriceCartForClient(
  presentationIdsInput,
  clientIdInput,
) {
  const presentationIds = Array.isArray(presentationIdsInput)
    ? presentationIdsInput.map((id) =>
        positiveInteger(id, "El producto"),
      )
    : [];

  if (presentationIds.length === 0) {
    return [];
  }

  const clientId = optionalPositiveInteger(
    clientIdInput,
    "El cliente",
  );

  const minute = currentMinute();

  if (clientId) {
    const client = await prisma.clienteEspecial.findFirst({
      where: {
        id: clientId,
        activo: true,
      },

      select: {
        id: true,
      },
    });

    if (!client) {
      throw new AppError(
        "El cliente especial no existe o está inactivo.",
        404,
      );
    }
  }

  const presentations = await prisma.presentacionProducto.findMany({
    where: {
      id: { in: presentationIds },
      activo: true,

      producto: {
        activo: true,
      },
    },

    include: {
      producto: {
        include: {
          categoria: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
      },

      codigosBarra: {
        where: {
          activo: true,
        },
      },

      preciosHorario: {
        include: {
          franja: true,
        },
      },

      preciosEspeciales: {
        where: {
          activo: true,
          clienteId: clientId ?? -1,
        },

        take: 1,
      },
    },
  });

  return presentations.map((presentation) => {
    const factor = Number(presentation.factorInventario);

    const currentPrice = getCurrentPrice(
      presentation,
      presentation.producto.modoPrecio,
      minute,
    );

    const barcode = principalBarcode(presentation);

    return {
      presentacionId: presentation.id,
      productoId: presentation.producto.id,
      nombre: presentation.producto.nombre,
      presentacion: presentation.nombre,
      tipoVenta: presentation.tipo,
      codigoBarra: barcode,
      sku: presentation.producto.sku,
      categoria: presentation.producto.categoria,
      stock: Number(presentation.producto.stockActual) / factor,
      precio: Number(currentPrice.price),
      precioOrigen: currentPrice.origin,
      turno: currentPrice.shift,
      precioEspecial: currentPrice.special,
    };
  });
}

export async function createSale(data, userId) {
  if (!Array.isArray(data.productos) || data.productos.length === 0) {
    throw new AppError("Agrega al menos un producto a la venta.", 400);
  }

  if (data.productos.length > 100) {
    throw new AppError("La venta no puede superar 100 productos.", 400);
  }

  const paymentMethod = String(data.metodoPago ?? "").toUpperCase();

  const clientId = optionalPositiveInteger(data.clienteId, "El cliente");

  if (!PAYMENT_METHODS.has(paymentMethod)) {
    throw new AppError("Selecciona un método de pago válido.", 400);
  }

  const reference = optionalText(data.referencia, 100);

  const combinedItems = new Map();

  for (const item of data.productos) {
    const presentationId = positiveInteger(
      item.presentacionId,
      "La presentación",
    );

    const quantity = positiveDecimal(item.cantidad, "La cantidad");

    const current = combinedItems.get(presentationId);

    combinedItems.set(
      presentationId,

      current ? current.add(quantity) : quantity,
    );
  }

  const presentationIds = [...combinedItems.keys()];

  const saleMinute = currentMinute();

  return prisma.$transaction(async (transaction) => {
    const openCashShift = await transaction.turnoCaja.findFirst({
      where: {
        estado: "ABIERTO",
      },

      select: {
        id: true,
      },

      orderBy: {
        abiertoEn: "desc",
      },
    });

    if (!openCashShift) {
      throw new AppError("Debes abrir la caja antes de vender.", 400);
    }

    const specialClient = clientId
      ? await transaction.clienteEspecial.findFirst({
          where: {
            id: clientId,
            activo: true,
          },

          select: {
            id: true,
            nombre: true,
          },
        })
      : null;

    if (clientId && !specialClient) {
      throw new AppError("El cliente especial no existe o está inactivo.", 404);
    }

    const presentations = await transaction.presentacionProducto.findMany({
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

        preciosHorario: {
          include: {
            franja: true,
          },
        },

        preciosEspeciales: {
          where: {
            activo: true,

            clienteId: clientId ?? -1,
          },

          take: 1,
        },
      },
    });

    if (presentations.length !== presentationIds.length) {
      throw new AppError("Uno de los productos ya no está disponible.", 400);
    }

    const deductionsByProduct = new Map();

    const details = [];

    let total = new Prisma.Decimal(0);

    for (const presentation of presentations) {
      const quantity = combinedItems.get(presentation.id);

      const factor = new Prisma.Decimal(presentation.factorInventario);

      const inventoryQuantity = quantity.mul(factor);

      const currentPrice = getCurrentPrice(
        presentation,

        presentation.producto.modoPrecio,

        saleMinute,
      );

      const subtotal = quantity.mul(currentPrice.price).toDecimalPlaces(2);

      const visibleCost = new Prisma.Decimal(
        presentation.producto.costoPromedio,
      ).mul(factor);

      const currentDeduction = deductionsByProduct.get(presentation.productoId);

      deductionsByProduct.set(
        presentation.productoId,

        {
          product: presentation.producto,

          quantity: currentDeduction
            ? currentDeduction.quantity.add(inventoryQuantity)
            : inventoryQuantity,
        },
      );

      details.push({
        productoId: presentation.productoId,

        presentacionId: presentation.id,

        productoNombre: presentation.producto.nombre,

        presentacionNombre: presentation.nombre,

        cantidad: quantity,

        factorInventario: factor,

        cantidadInventario: inventoryQuantity,

        costoUnitario: visibleCost,

        precioUnitario: currentPrice.price,

        subtotal,

        precioOrigen: currentPrice.origin,
      });

      total = total.add(subtotal);
    }

    for (const deduction of deductionsByProduct.values()) {
      if (deduction.quantity.greaterThan(deduction.product.stockActual)) {
        throw new AppError(
          `No hay existencia suficiente de ${deduction.product.nombre}.`,
          400,
        );
      }
    }

    let received = null;

    let change = new Prisma.Decimal(0);

    if (paymentMethod === "EFECTIVO") {
      received = positiveDecimal(data.montoRecibido, "El monto recibido");

      if (received.lessThan(total)) {
        throw new AppError("El efectivo recibido es menor que el total.", 400);
      }

      change = received.sub(total).toDecimalPlaces(2);
    }

    const sale = await transaction.venta.create({
      data: {
        usuarioId: userId,

        turnoCajaId: openCashShift.id,

        clienteEspecialId: specialClient?.id ?? null,

        clienteNombre: specialClient?.nombre ?? null,

        subtotal: total,

        total,

        detalles: {
          create: details,
        },

        pagos: {
          create: {
            metodo: paymentMethod,

            monto: total,

            recibido: received,

            cambio: change,

            referencia: reference,
          },
        },
      },

      include: SALE_INCLUDE,
    });

    for (const [productId, deduction] of deductionsByProduct.entries()) {
      const updateResult = await transaction.producto.updateMany({
        where: {
          id: productId,

          stockActual: {
            gte: deduction.quantity,
          },
        },

        data: {
          stockActual: {
            decrement: deduction.quantity,
          },
        },
      });

      if (updateResult.count !== 1) {
        throw new AppError(
          `La existencia de ${deduction.product.nombre} cambió. Intenta nuevamente.`,
          409,
        );
      }

      const updatedProduct = await transaction.producto.findUnique({
        where: {
          id: productId,
        },

        select: {
          stockActual: true,
          costoPromedio: true,
        },
      });

      await transaction.movimientoInventario.create({
        data: {
          productoId: productId,
          usuarioId: userId,
          ventaId: sale.id,
          tipo: "VENTA",
          cantidad: deduction.quantity,
          saldoPosterior: updatedProduct.stockActual,
          costoUnitario: updatedProduct.costoPromedio,
          motivo: `Venta #${sale.id}.`,
        },
      });
    }

    return serializeSale(sale);
  });
}

export async function cancelSale(saleIdInput, userId) {
  const saleId = positiveInteger(saleIdInput, "La venta");

  const resultado = await prisma.$transaction(async (transaction) => {
    const sale = await transaction.venta.findUnique({
      where: {
        id: saleId,
      },

      include: {
        detalles: true,
      },
    });

    if (!sale) {
      throw new AppError("La venta no existe.", 404);
    }

    if (sale.estado === "CANCELADA") {
      throw new AppError("La venta ya está cancelada.", 400);
    }

    const restoreByProduct = new Map();

    for (const detail of sale.detalles) {
      const current = restoreByProduct.get(detail.productoId);

      restoreByProduct.set(
        detail.productoId,

        current
          ? current.add(detail.cantidadInventario)
          : detail.cantidadInventario,
      );
    }

    for (const [productId, quantity] of restoreByProduct.entries()) {
      const updatedProduct = await transaction.producto.update({
        where: {
          id: productId,
        },

        data: {
          stockActual: {
            increment: quantity,
          },
        },

        select: {
          stockActual: true,
          costoPromedio: true,
        },
      });

      await transaction.movimientoInventario.create({
        data: {
          productoId: productId,
          usuarioId: userId,
          ventaId: sale.id,
          tipo: "CANCELACION_VENTA",
          cantidad: quantity,
          saldoPosterior: updatedProduct.stockActual,
          costoUnitario: updatedProduct.costoPromedio,
          motivo: `Cancelación de venta #${sale.id}.`,
        },
      });
    }

    const canceledSale = await transaction.venta.update({
      where: {
        id: saleId,
      },

      data: {
        estado: "CANCELADA",
        canceladoEn: new Date(),
      },

      include: SALE_INCLUDE,
    });

    return canceledSale;
  });

  await registrarBitacora({
    usuarioId: userId,
    accion: "CANCELAR_VENTA",
    entidad: "Venta",
    entidadId: resultado.id,
    detalle: {
      total: Number(resultado.total),
    },
  });

  return serializeSale(resultado);
}

export async function listSales(search = "") {
  const term = typeof search === "string" ? search.trim() : "";

  const sales = await prisma.venta.findMany({
    where: term
      ? {
          OR: [
            {
              clienteNombre: {
                contains: term,
                mode: "insensitive",
              },
            },
            {
              usuario: {
                nombre: {
                  contains: term,
                  mode: "insensitive",
                },
              },
            },
          ],
        }
      : undefined,

    include: SALE_INCLUDE,
    orderBy: { creadoEn: "desc" },
    take: 100,
  });

  return sales.map(serializeSale);
}