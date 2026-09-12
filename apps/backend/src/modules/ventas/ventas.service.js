import { Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

import { AppError } from "../../utils/AppError.js";
import { registrarBitacora } from "../bitacora/bitacora.service.js";

const PAYMENT_METHODS = new Set(["EFECTIVO", "TARJETA", "TRANSFERENCIA", "CREDITO"]);

// Recargo por pagar con tarjeta: el total se multiplica por 1.05 (5%).
const CARD_SURCHARGE_RATE = new Prisma.Decimal(0.05);

// Recargo "Tomar acá" por cerveza: L3 de 8am a 10pm y L5 de 10pm a 8am.
export function alcoholSurchargePerUnit(minute) {
  return new Prisma.Decimal(minute >= 8 * 60 && minute < 22 * 60 ? 3 : 5);
}

// Descuento por cerveza caliente: L5 por cada unidad en el carrito.
const ALCOHOL_DISCOUNT_PER_UNIT = new Prisma.Decimal(5);

const ALCOHOL_CATEGORY_KEYWORDS = ["cerveza", "alcoh", "licor"];

// Recargo de envase: L5 por cada click del botón "Envase" (máx. una vez
// por cada unidad de Barena/Salvavida Botella/Kaguama en el carrito).
const CONTAINER_SURCHARGE_PER_UNIT = new Prisma.Decimal(5);

const CONTAINER_SURCHARGE_PRODUCT_NAMES = [
  "barena botella",
  "barena kaguama",
  "salvavida botella",
  "salvavida kaguama",
];

function hasContainerSurcharge(productName) {
  const normalized = (productName ?? "").trim().toLowerCase();

  return CONTAINER_SURCHARGE_PRODUCT_NAMES.some((name) => normalized.includes(name));
}

// Recargo por preparación de sopa instantánea: L5 por cada unidad en el carrito.
const SOUP_SURCHARGE_PER_UNIT = new Prisma.Decimal(5);

const SOUP_CATEGORY_KEYWORDS = ["sopa instantanea", "sopa instantánea", "sopas instantaneas"];

function isSoupCategory(categoryName) {
  if (!categoryName) {
    return false;
  }

  const normalized = categoryName.toLowerCase();

  return SOUP_CATEGORY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isAlcoholCategory(categoryName) {
  if (!categoryName) {
    return false;
  }

  const normalized = categoryName.toLowerCase();

  return ALCOHOL_CATEGORY_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

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

// Honduras no tiene horario de verano y siempre está en UTC-6, así que
// esto funciona sin importar la zona horaria del servidor donde corra
// el backend (local, Railway, o donde sea).
const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

const hondurasTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: HONDURAS_TIME_ZONE,
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
});

function currentMinute(date = new Date()) {
  const parts = hondurasTimeFormatter.formatToParts(date);

  const hours = Number(parts.find((part) => part.type === "hour").value);
  const minutes = Number(parts.find((part) => part.type === "minute").value);

  // Intl puede devolver "24" en vez de "00" para la medianoche.
  return (hours % 24) * 60 + minutes;
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

// Para un producto compuesto (ej. "Saco de pollo mixto"), el stock
// disponible no es el suyo propio (no se lleva), sino lo que alcance
// según el stock real de sus componentes y la cantidad fija que cada
// uno descuenta. Ej. si Pierna tiene 40 lb y Pechuga 30 lb, y ambas
// descuentan 56 lb por saco, solo alcanza para lo que dé el componente
// más limitado (el que se acaba primero).
function compositeAvailableStock(producto) {
  if (!producto.esCompuesto || !producto.componentes?.length) {
    return null;
  }

  let minStock = Infinity;

  for (const component of producto.componentes) {
    const cantidad = Number(component.cantidad);

    if (cantidad <= 0) {
      continue;
    }

    const available = Number(component.productoComponente.stockActual) / cantidad;

    if (available < minStock) {
      minStock = available;
    }
  }

  return Number.isFinite(minStock) ? minStock : 0;
}

// PEPS/FIFO para productos que se venden directo (no aplica a los
// ingredientes de un compuesto, que siguen usando el costo promedio).
// Descuenta primero del lote más viejo; si los lotes no alcanzan a
// cubrir todo lo vendido (típicamente porque hay stock de antes de
// activar esto, que nunca se convirtió en lote), el resto se costea con
// el costo promedio actual del producto como respaldo.
async function consumeFifoCost(transaction, productId, inventoryQuantity, legacyUnitCost, lotQueues) {
  let remaining = inventoryQuantity;
  let totalCost = new Prisma.Decimal(0);

  const queue = lotQueues.get(productId) ?? [];

  for (const lot of queue) {
    if (remaining.lessThanOrEqualTo(0)) {
      break;
    }

    if (lot.cantidadRestante.lessThanOrEqualTo(0)) {
      continue;
    }

    const taken = Prisma.Decimal.min(remaining, lot.cantidadRestante);

    totalCost = totalCost.add(taken.mul(lot.costoUnitario));
    lot.cantidadRestante = lot.cantidadRestante.sub(taken);
    remaining = remaining.sub(taken);

    await transaction.loteInventario.update({
      where: { id: lot.id },
      data: { cantidadRestante: lot.cantidadRestante },
    });
  }

  if (remaining.greaterThan(0)) {
    totalCost = totalCost.add(remaining.mul(legacyUnitCost));
  }

  return totalCost;
}

const COMPONENT_INCLUDE = {
  componentes: {
    include: {
      productoComponente: {
        select: {
          id: true,
          nombre: true,
          stockActual: true,
        },
      },
    },
  },
};

function serializeSale(sale) {
  const payment = sale.pagos[0] ?? null;

  return {
    id: sale.id,
    estado: sale.estado,
    subtotal: Number(sale.subtotal),
    total: Number(sale.total),
    creadoEn: sale.creadoEn,

    cliente: sale.clienteEspecialId || sale.clienteNombre
      ? {
          id: sale.clienteEspecialId ?? null,

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

          ...COMPONENT_INCLUDE,
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

      const compositeStock = compositeAvailableStock(presentation.producto);

      // Para un compuesto, compositeAvailableStock ya devuelve el stock en
      // unidades de ESTA presentación (la "cantidad" de cada componente se
      // define por unidad vendida del padre) — dividirlo de nuevo por el
      // factor de inventario lo reduce mal. Solo se divide por factor
      // cuando el stock viene crudo (producto normal, no compuesto).
      const stock =
        compositeStock !== null ? compositeStock : Number(presentation.producto.stockActual) / factor;

      return {
        presentacionId: presentation.id,

        productoId: presentation.producto.id,

        nombre: presentation.producto.nombre,

        presentacion: presentation.nombre,

        tipoVenta: presentation.tipo,

        codigoBarra: barcode,

        sku: presentation.producto.sku,

        categoria: presentation.producto.categoria,

        stock,

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

          ...COMPONENT_INCLUDE,
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

    const compositeStock = compositeAvailableStock(presentation.producto);

    // Mismo caso que en la búsqueda: el stock de un compuesto ya viene en
    // unidades de esta presentación, no hay que dividirlo por el factor.
    const stock =
      compositeStock !== null ? compositeStock : Number(presentation.producto.stockActual) / factor;

    return {
      presentacionId: presentation.id,
      productoId: presentation.producto.id,
      nombre: presentation.producto.nombre,
      presentacion: presentation.nombre,
      tipoVenta: presentation.tipo,
      codigoBarra: barcode,
      sku: presentation.producto.sku,
      categoria: presentation.producto.categoria,
      stock,
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
    // Cada cajero vende contra SU PROPIA caja abierta, no contra cualquier
    // caja abierta en el sistema.
    const openCashShift = await transaction.turnoCaja.findFirst({
      where: {
        estado: "ABIERTO",
        usuarioAperturaId: userId,
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

    // El crédito ("fiado") se le puede dar a CUALQUIER persona, no solo a
    // los clientes especiales registrados: si no se eligió un cliente
    // especial, se exige al menos un nombre para poder cobrarle después.
    const creditClientName = optionalText(data.nombreCredito, 120);

    if (paymentMethod === "CREDITO" && !specialClient && !creditClientName) {
      throw new AppError("Escribe el nombre de la persona para el crédito.", 400);
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
        producto: {
          include: {
            categoria: true,
            ...COMPONENT_INCLUDE,
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

    if (presentations.length !== presentationIds.length) {
      throw new AppError("Uno de los productos ya no está disponible.", 400);
    }

    // PEPS: precarga los lotes disponibles (más viejo primero) de los
    // productos que se venden directo en este carrito, para descontar de
    // ahí su costo real en vez del promedio.
    const nonCompositeProductIds = [
      ...new Set(
        presentations
          .filter((presentation) => !presentation.producto.esCompuesto)
          .map((presentation) => presentation.productoId),
      ),
    ];

    const lotQueues = new Map();

    if (nonCompositeProductIds.length > 0) {
      const lots = await transaction.loteInventario.findMany({
        where: {
          productoId: { in: nonCompositeProductIds },
          cantidadRestante: { gt: 0 },
        },
        orderBy: { creadoEn: "asc" },
      });

      for (const lot of lots) {
        const queue = lotQueues.get(lot.productoId) ?? [];

        queue.push({
          id: lot.id,
          cantidadRestante: new Prisma.Decimal(lot.cantidadRestante),
          costoUnitario: new Prisma.Decimal(lot.costoUnitario),
        });

        lotQueues.set(lot.productoId, queue);
      }
    }

    const deductionsByProduct = new Map();

    const details = [];

    let total = new Prisma.Decimal(0);
    let alcoholUnits = new Prisma.Decimal(0);
    let soupUnits = new Prisma.Decimal(0);
    let containerUnits = new Prisma.Decimal(0);

    for (const presentation of presentations) {
      const quantity = combinedItems.get(presentation.id);

      const factor = new Prisma.Decimal(presentation.factorInventario);

      const inventoryQuantity = quantity.mul(factor);

      const currentPrice = getCurrentPrice(
        presentation,

        presentation.producto.modoPrecio,

        saleMinute,
      );

      // No hay moneda fraccionaria en caja: cada producto se redondea al
      // lempira entero individualmente (no solo el total al final).
      const subtotal = quantity
        .mul(currentPrice.price)
        .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

      const isComposite =
        presentation.producto.esCompuesto && presentation.producto.componentes?.length;

      // PEPS solo para lo que se vende directo. Los ingredientes de un
      // compuesto siguen costeándose con el promedio del producto, como
      // antes.
      const visibleCost = isComposite
        ? new Prisma.Decimal(presentation.producto.costoPromedio).mul(factor)
        : (
            await consumeFifoCost(
              transaction,
              presentation.productoId,
              inventoryQuantity,
              new Prisma.Decimal(presentation.producto.costoPromedio),
              lotQueues,
            )
          )
            .div(quantity)
            .toDecimalPlaces(4);

      const currentDeduction = deductionsByProduct.get(presentation.productoId);

      if (isComposite) {
        // Producto compuesto: se descuenta una cantidad FIJA de cada
        // componente por cada unidad vendida del padre (ej. 56 lb pierna
        // + 56 lb pechuga por cada "saco" vendido), no una proporción.
        for (const component of presentation.producto.componentes) {
          const cantidadFija = new Prisma.Decimal(component.cantidad);

          const componentQuantity = quantity.mul(cantidadFija);

          const existingComponentDeduction = deductionsByProduct.get(
            component.productoComponenteId,
          );

          deductionsByProduct.set(component.productoComponenteId, {
            product: component.productoComponente,

            quantity: existingComponentDeduction
              ? existingComponentDeduction.quantity.add(componentQuantity)
              : componentQuantity,
          });
        }
      } else {
        deductionsByProduct.set(
          presentation.productoId,

          {
            product: presentation.producto,

            quantity: currentDeduction
              ? currentDeduction.quantity.add(inventoryQuantity)
              : inventoryQuantity,
          },
        );
      }

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

      if (isAlcoholCategory(presentation.producto.categoria?.nombre)) {
        alcoholUnits = alcoholUnits.add(quantity);
      }

      if (isSoupCategory(presentation.producto.categoria?.nombre)) {
        soupUnits = soupUnits.add(quantity);
      }

      if (hasContainerSurcharge(presentation.producto.nombre)) {
        containerUnits = containerUnits.add(quantity);
      }
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

    const applyAlcoholSurcharge =
      Boolean(data.recargoBebidasAlcoholicas) && alcoholUnits.greaterThan(0);

    const alcoholSurcharge = applyAlcoholSurcharge
      ? alcoholUnits.mul(alcoholSurchargePerUnit(saleMinute)).toDecimalPlaces(2)
      : new Prisma.Decimal(0);

    const applyAlcoholDiscount =
      Boolean(data.descuentoCervezaCaliente) && alcoholUnits.greaterThan(0);

    const alcoholDiscount = applyAlcoholDiscount
      ? alcoholUnits.mul(ALCOHOL_DISCOUNT_PER_UNIT).toDecimalPlaces(2)
      : new Prisma.Decimal(0);

    const applySoupSurcharge =
      Boolean(data.recargoSopaInstantanea) && soupUnits.greaterThan(0);

    const soupSurcharge = applySoupSurcharge
      ? soupUnits.mul(SOUP_SURCHARGE_PER_UNIT).toDecimalPlaces(2)
      : new Prisma.Decimal(0);

    // El botón "Envase" se puede pulsar varias veces (cada click = +5),
    // pero nunca más veces que unidades de Barena/Salvavida haya en el
    // carrito. Se recalcula el límite aquí para no confiar ciegamente en
    // lo que mande el cliente.
    const requestedContainerClicks = Math.max(
      0,
      Math.trunc(Number(data.recargoEnvaseCantidad) || 0),
    );

    const containerClicks = Math.min(
      requestedContainerClicks,
      containerUnits.toNumber(),
    );

    const containerSurcharge =
      containerClicks > 0
        ? CONTAINER_SURCHARGE_PER_UNIT.mul(containerClicks).toDecimalPlaces(2)
        : new Prisma.Decimal(0);

    const totalWithAlcoholSurcharge = total
      .add(alcoholSurcharge)
      .sub(alcoholDiscount)
      .add(soupSurcharge)
      .add(containerSurcharge);

    const cardSurcharge =
      paymentMethod === "TARJETA"
        ? totalWithAlcoholSurcharge.mul(CARD_SURCHARGE_RATE).toDecimalPlaces(2)
        : new Prisma.Decimal(0);

    // El total que se cobra se redondea al lempira entero más cercano,
    // igual que se muestra en la pantalla de ventas.
    const grandTotal = totalWithAlcoholSurcharge
      .add(cardSurcharge)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

    if (paymentMethod === "EFECTIVO") {
      received = positiveDecimal(data.montoRecibido, "El monto recibido");

      if (received.lessThan(grandTotal)) {
        throw new AppError("El efectivo recibido es menor que el total.", 400);
      }

      change = received.sub(grandTotal).toDecimalPlaces(2);
    }

    // CREDITO ("fiado"): el producto sale de inventario pero no entra
    // dinero a la caja. No pide efectivo recibido ni aplica recargo de
    // tarjeta; el pago queda registrado con monto = total, sin efectivo.

    const sale = await transaction.venta.create({
      data: {
        usuarioId: userId,

        turnoCajaId: openCashShift.id,

        clienteEspecialId: specialClient?.id ?? null,

        clienteNombre: specialClient?.nombre ?? creditClientName ?? null,

        subtotal: total,

        total: grandTotal,

        detalles: {
          create: details,
        },

        pagos: {
          create: {
            metodo: paymentMethod,

            monto: grandTotal,

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
  }, { maxWait: 10_000, timeout: 60_000 });
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

// Lista TODOS los créditos ("fiado") del negocio, de cualquier cajero —
// a diferencia de "Mi actividad", que solo muestra lo propio de cada
// usuario. Sirve para que cualquiera vea a quién se le fió y cuánto debe.
export async function listCreditSales(search = "") {
  const term = typeof search === "string" ? search.trim() : "";

  const sales = await prisma.venta.findMany({
    where: {
      pagos: {
        some: {
          metodo: "CREDITO",
        },
      },
      ...(term
        ? {
            clienteNombre: {
              contains: term,
              mode: "insensitive",
            },
          }
        : {}),
    },

    include: SALE_INCLUDE,
    orderBy: { creadoEn: "desc" },
    take: 200,
  });

  return sales.map(serializeSale);
}