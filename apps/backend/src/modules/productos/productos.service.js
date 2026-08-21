import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { registrarBitacora } from "../bitacora/bitacora.service.js";

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
    nombrePresentacion: "Libra",
    factorInventario: 454,
  },
  VOLUMEN: {
    unidadInventario: "MILILITRO",
    nombrePresentacion: "Litro",
    factorInventario: 1000,
  },
};

function cleanText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`${field} es obligatorio.`, 400);
  }

  const text = value.trim().replace(/\s+/g, " ");

  if (text.length > maxLength) {
    throw new AppError(`${field} no puede superar ${maxLength} caracteres.`, 400);
  }

  return text;
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const text = String(value).trim();

  if (text.length > maxLength) {
    throw new AppError(`El valor no puede superar ${maxLength} caracteres.`, 400);
  }

  return text || null;
}

function decimalValue(value, field, { positive = false } = {}) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0 || (positive && number <= 0)) {
    throw new AppError(
      `${field} debe ser un número ${positive ? "mayor que cero" : "válido"}.`,
      400,
    );
  }

  return new Prisma.Decimal(String(number));
}

function optionalCategoryId(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const categoryId = Number(value);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new AppError("La categoría seleccionada no es válida.", 400);
  }

  return categoryId;
}

function productIdValue(value) {
  const productId = Number(value);

  if (!Number.isInteger(productId) || productId <= 0) {
    throw new AppError("El producto seleccionado no es válido.", 400);
  }

  return productId;
}

function quantityValue(value, field) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    throw new AppError(`${field} debe ser un número mayor que cero.`, 400);
  }

  return new Prisma.Decimal(String(number));
}

async function getShiftPrices(transaction, normalPrice, shiftTwoPrice, shiftThreePrice) {
  const shifts = await transaction.franjaHorariaPrecio.findMany({
    where: { activo: true, orden: { in: [1, 2, 3] } },
    orderBy: { orden: "asc" },
  });

  const shiftOne = shifts.find((shift) => shift.orden === 1);
  const shiftTwo = shifts.find((shift) => shift.orden === 2);
  const shiftThree = shifts.find((shift) => shift.orden === 3);

  if (!shiftOne || !shiftTwo || !shiftThree) {
    throw new AppError("No están configurados los tres turnos de precio.", 400);
  }

  return [
    { franjaId: shiftOne.id, precio: normalPrice },
    { franjaId: shiftTwo.id, precio: shiftTwoPrice },
    { franjaId: shiftThree.id, precio: shiftThreePrice },
  ];
}

function serializeProduct(product) {
  const principal =
    product.presentaciones.find((presentation) => presentation.esPrincipal) ??
    product.presentaciones[0] ??
    null;

  const factor = principal ? Number(principal.factorInventario) : 1;

  return {
    id: product.id,
    sku: product.sku,
    nombre: product.nombre,
    descripcion: product.descripcion,
    categoria: product.categoria,
    modoPrecio: product.modoPrecio,
    activo: product.activo,
    stock: Number(product.stockActual) / factor,
    stockMinimo: Number(product.stockMinimo) / factor,
    costo: Number(product.costoPromedio) * factor,

    presentacionPrincipal: principal
      ? {
          id: principal.id,
          nombre: principal.nombre,
          tipo: principal.tipo,
          precio: Number(principal.precioBase),
          factorInventario: factor,

          codigoBarra:
            principal.codigosBarra.find((barcode) => barcode.principal)?.codigo ??
            principal.codigosBarra[0]?.codigo ??
            null,

          preciosTurno: principal.preciosHorario.map((shiftPrice) => ({
            turno: shiftPrice.franja.orden,
            nombre: shiftPrice.franja.nombre,
            minutoInicio: shiftPrice.franja.minutoInicio,
            minutoFin: shiftPrice.franja.minutoFin,
            precio: Number(shiftPrice.precio),
          })),
        }
      : null,

    // Todas las presentaciones activas (unidad, six-pack, caja, etc.),
    // no solo la principal. Útil para mostrar/editar todas en el frontend.
    presentaciones: product.presentaciones.map((presentation) => ({
      id: presentation.id,
      nombre: presentation.nombre,
      tipo: presentation.tipo,
      esPrincipal: presentation.esPrincipal,
      factorInventario: Number(presentation.factorInventario),
      precio: Number(presentation.precioBase),

      codigoBarra:
        presentation.codigosBarra.find((barcode) => barcode.principal)?.codigo ??
        presentation.codigosBarra[0]?.codigo ??
        null,
    })),
  };
}

const PRODUCT_INCLUDE = {
  categoria: {
    select: { id: true, nombre: true },
  },

  presentaciones: {
    where: { activo: true },

    include: {
      codigosBarra: { where: { activo: true } },

      preciosHorario: {
        include: { franja: true },
        orderBy: { franja: { orden: "asc" } },
      },
    },

    orderBy: [{ esPrincipal: "desc" }, { id: "asc" }],
  },
};

export async function listProducts(search = "", pageInput, perPageInput) {
  const term = typeof search === "string" ? search.trim() : "";

  const page = Math.max(1, Number(pageInput) || 1);
  const perPage = Math.min(100, Math.max(1, Number(perPageInput) || 25));

  const where = {
    activo: true,

    ...(term
      ? {
          OR: [
            { nombre: { contains: term, mode: "insensitive" } },
            { sku: { contains: term, mode: "insensitive" } },
            {
              presentaciones: {
                some: {
                  codigosBarra: {
                    some: { codigo: { contains: term } },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.producto.findMany({
      where,
      include: PRODUCT_INCLUDE,
      orderBy: { nombre: "asc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),

    prisma.producto.count({ where }),
  ]);

  return {
    total,
    page,
    perPage,
    productos: products.map(serializeProduct),
  };
}

export async function createProduct(data, userId) {
  const name = cleanText(data.nombre, "El nombre del producto", 150);
  const description = optionalText(data.descripcion, 300);
  const sku = optionalText(data.sku, 40);
  const barcode = optionalText(data.codigoBarra, 80);
  const categoryId = optionalCategoryId(data.categoriaId);

  const saleType = TIPOS_VENTA[data.tipoVenta];

  if (!saleType) {
    throw new AppError("Selecciona una forma de venta válida.", 400);
  }

  const price = decimalValue(data.precio, "El precio", { positive: true });

  const changesByShift = data.cambiaPrecioTurno === true;

  const shiftTwoPrice = changesByShift
    ? decimalValue(data.precioTurno2, "El precio del turno 2", { positive: true })
    : null;

  const shiftThreePrice = changesByShift
    ? decimalValue(data.precioTurno3, "El precio del turno 3", { positive: true })
    : null;

  const cost = decimalValue(data.costo ?? 0, "El costo");
  const initialStock = decimalValue(data.stockInicial ?? 0, "La existencia inicial");
  const minimumStock = decimalValue(data.stockMinimo ?? 0, "La existencia mínima");

  const factor = new Prisma.Decimal(saleType.factorInventario);
  const internalStock = initialStock.mul(factor);
  const internalMinimum = minimumStock.mul(factor);
  const internalCost = cost.div(factor);

  try {
    return await prisma.$transaction(async (transaction) => {
      let shiftPrices = [];

      if (changesByShift) {
        shiftPrices = await getShiftPrices(transaction, price, shiftTwoPrice, shiftThreePrice);
      }

      if (categoryId) {
        const category = await transaction.categoria.findFirst({
          where: { id: categoryId, activo: true },
          select: { id: true },
        });

        if (!category) {
          throw new AppError("La categoría seleccionada no existe.", 400);
        }
      }

      const product = await transaction.producto.create({
        data: {
          sku,
          nombre: name,
          descripcion: description,
          categoriaId: categoryId,
          unidadInventario: saleType.unidadInventario,
          modoPrecio: changesByShift ? "POR_HORARIO" : "UNICO",
          stockActual: internalStock,
          stockMinimo: internalMinimum,
          costoPromedio: internalCost,

          presentaciones: {
            create: {
              nombre: saleType.nombrePresentacion,
              tipo: data.tipoVenta,
              factorInventario: factor,
              precioBase: price,
              esPrincipal: true,

              ...(barcode
                ? { codigosBarra: { create: { codigo: barcode, principal: true } } }
                : {}),

              ...(changesByShift
                ? { preciosHorario: { create: shiftPrices } }
                : {}),
            },
          },
        },

        include: PRODUCT_INCLUDE,
      });

      if (internalStock.greaterThan(0)) {
        await transaction.movimientoInventario.create({
          data: {
            productoId: product.id,
            usuarioId: userId,
            tipo: "INVENTARIO_INICIAL",
            cantidad: internalStock,
            saldoPosterior: internalStock,
            costoUnitario: internalCost,
            motivo: "Existencia registrada al crear el producto.",
          },
        });
      }

      return serializeProduct(product);
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new AppError("El SKU o código de barras ya pertenece a otro producto.", 409);
      }
    }

    throw error;
  }
}

export async function updateProduct(productIdInput, data, userId) {
  const productId = productIdValue(productIdInput);

  const name = cleanText(data.nombre, "El nombre del producto", 150);
  const description = optionalText(data.descripcion, 300);
  const sku = optionalText(data.sku, 40);
  const barcode = optionalText(data.codigoBarra, 80);
  const categoryId = optionalCategoryId(data.categoriaId);

  const price = decimalValue(data.precio, "El precio", { positive: true });

  const changesByShift = data.cambiaPrecioTurno === true;

  const shiftTwoPrice = changesByShift
    ? decimalValue(data.precioTurno2, "El precio del turno 2", { positive: true })
    : null;

  const shiftThreePrice = changesByShift
    ? decimalValue(data.precioTurno3, "El precio del turno 3", { positive: true })
    : null;

  const visibleCost = decimalValue(data.costo ?? 0, "El costo");
  const visibleStock = decimalValue(data.stockInicial ?? 0, "La existencia actual");
  const visibleMinimum = decimalValue(data.stockMinimo ?? 0, "La existencia mínima");

  try {
    const resultado = await prisma.$transaction(async (transaction) => {
      const currentProduct = await transaction.producto.findFirst({
        where: { id: productId, activo: true },

        include: {
          presentaciones: {
            where: { activo: true },
            include: { codigosBarra: true },
            orderBy: { id: "asc" },
          },
        },
      });

      if (!currentProduct) {
        throw new AppError("El producto seleccionado no existe.", 404);
      }

      const principal =
        currentProduct.presentaciones.find((presentation) => presentation.esPrincipal) ??
        currentProduct.presentaciones[0] ??
        null;

      if (!principal) {
        throw new AppError("El producto no tiene una presentación principal.", 400);
      }

      if (categoryId) {
        const category = await transaction.categoria.findFirst({
          where: { id: categoryId, activo: true },
          select: { id: true },
        });

        if (!category) {
          throw new AppError("La categoría seleccionada no existe.", 400);
        }
      }

      const precioAnterior = new Prisma.Decimal(principal.precioBase);
      const factor = new Prisma.Decimal(principal.factorInventario);

      const internalStock = visibleStock.mul(factor);
      const internalMinimum = visibleMinimum.mul(factor);
      const internalCost = visibleCost.div(factor);

      const stockDifference = internalStock.sub(currentProduct.stockActual);

      const shiftPrices = changesByShift
        ? await getShiftPrices(transaction, price, shiftTwoPrice, shiftThreePrice)
        : [];

      await transaction.precioPresentacionHorario.deleteMany({
        where: { presentacionId: principal.id },
      });

      await transaction.codigoBarraProducto.deleteMany({
        where: { presentacionId: principal.id },
      });

      await transaction.presentacionProducto.update({
        where: { id: principal.id },

        data: {
          precioBase: price,

          ...(barcode
            ? { codigosBarra: { create: { codigo: barcode, principal: true } } }
            : {}),

          ...(changesByShift
            ? { preciosHorario: { create: shiftPrices } }
            : {}),
        },
      });

      const product = await transaction.producto.update({
        where: { id: productId },

        data: {
          sku,
          nombre: name,
          descripcion: description,
          categoriaId: categoryId,
          modoPrecio: changesByShift ? "POR_HORARIO" : "UNICO",
          stockActual: internalStock,
          stockMinimo: internalMinimum,
          costoPromedio: internalCost,
        },

        include: PRODUCT_INCLUDE,
      });

      if (!stockDifference.isZero()) {
        await transaction.movimientoInventario.create({
          data: {
            productoId: productId,
            usuarioId: userId,
            tipo: stockDifference.greaterThan(0) ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO",
            cantidad: stockDifference.abs(),
            saldoPosterior: internalStock,
            costoUnitario: internalCost,
            motivo: "Existencia ajustada al editar el producto.",
          },
        });
      }

      return { product, precioAnterior };
    });

    if (!price.equals(resultado.precioAnterior)) {
      await registrarBitacora({
        usuarioId: userId,
        accion: "CAMBIO_PRECIO",
        entidad: "Producto",
        entidadId: productId,

        detalle: {
          nombre: resultado.product.nombre,
          precioAnterior: Number(resultado.precioAnterior),
          precioNuevo: Number(price),
        },
      });
    }

    return serializeProduct(resultado.product);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new AppError("El SKU o código de barras ya pertenece a otro producto.", 409);
      }
    }

    throw error;
  }
}

// --- Presentaciones adicionales (six-pack, caja, paquete, etc.) -----
//
// Un producto puede venderse en varias formas que descuentan del MISMO
// stock (ej. Coca 1.1L suelta vs. six-pack: 1000 unidades en bodega,
// pero factorInventario=1 para la unitaria y =6 para el six-pack).
// Distinto de ComponenteProducto, que reparte entre productos DIFERENTES
// (ej. saco de pollo mixto -> Pierna + Pechuga).

export async function listPresentations(productIdInput) {
  const productId = productIdValue(productIdInput);

  const presentations = await prisma.presentacionProducto.findMany({
    where: { productoId: productId, activo: true },
    include: { codigosBarra: { where: { activo: true } } },
    orderBy: [{ esPrincipal: "desc" }, { id: "asc" }],
  });

  return presentations.map((presentation) => ({
    id: presentation.id,
    nombre: presentation.nombre,
    tipo: presentation.tipo,
    esPrincipal: presentation.esPrincipal,
    factorInventario: Number(presentation.factorInventario),
    precio: Number(presentation.precioBase),

    codigoBarra:
      presentation.codigosBarra.find((barcode) => barcode.principal)?.codigo ??
      presentation.codigosBarra[0]?.codigo ??
      null,
  }));
}

export async function addPresentation(productIdInput, data, userId) {
  const productId = productIdValue(productIdInput);

  const name = cleanText(data.nombre, "El nombre de la presentación", 80);
  const barcode = optionalText(data.codigoBarra, 80);

  const saleType = TIPOS_VENTA[data.tipoVenta];

  if (!saleType) {
    throw new AppError("Selecciona una forma de venta válida.", 400);
  }

  // A diferencia del producto base, aquí el factor lo define el usuario
  // (ej. 6 para un six-pack, 24 para una caja de 24), no viene fijo.
  const factor = decimalValue(data.factorInventario, "La cantidad por presentación", {
    positive: true,
  });

  const price = decimalValue(data.precio, "El precio", { positive: true });

  try {
    const product = await prisma.$transaction(async (transaction) => {
      const parentProduct = await transaction.producto.findFirst({
        where: { id: productId, activo: true },
        select: { id: true },
      });

      if (!parentProduct) {
        throw new AppError("El producto seleccionado no existe.", 404);
      }

      const existingNames = await transaction.presentacionProducto.findFirst({
        where: { productoId: productId, activo: true, nombre: name },
        select: { id: true },
      });

      if (existingNames) {
        throw new AppError("Ya existe una presentación con ese nombre en este producto.", 409);
      }

      await transaction.presentacionProducto.create({
        data: {
          productoId: productId,
          nombre: name,
          tipo: data.tipoVenta,
          factorInventario: factor,
          precioBase: price,
          esPrincipal: false,

          ...(barcode
            ? { codigosBarra: { create: { codigo: barcode, principal: true } } }
            : {}),
        },
      });

      return transaction.producto.findUnique({
        where: { id: productId },
        include: PRODUCT_INCLUDE,
      });
    });

    await registrarBitacora({
      usuarioId: userId,
      accion: "AGREGAR_PRESENTACION",
      entidad: "Producto",
      entidadId: productId,
      detalle: { presentacion: name, factor: Number(factor), precio: Number(price) },
    });

    return serializeProduct(product);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("Ese código de barras ya pertenece a otra presentación.", 409);
    }

    throw error;
  }
}

export async function updatePresentation(productIdInput, presentationIdInput, data, userId) {
  const productId = productIdValue(productIdInput);
  const presentationId = productIdValue(presentationIdInput);

  const name = cleanText(data.nombre, "El nombre de la presentación", 80);
  const barcode = optionalText(data.codigoBarra, 80);
  const price = decimalValue(data.precio, "El precio", { positive: true });

  // El factorInventario NO se permite cambiar aquí a propósito: si ya
  // hay ventas históricas con este factor, cambiarlo rompe la trazabilidad
  // de cantidadInventario registrada en ventas_detalle. Para corregir un
  // factor mal puesto, desactiva la presentación y crea una nueva.

  try {
    const product = await prisma.$transaction(async (transaction) => {
      const presentation = await transaction.presentacionProducto.findFirst({
        where: { id: presentationId, productoId: productId, activo: true },
      });

      if (!presentation) {
        throw new AppError("La presentación no existe.", 404);
      }

      const duplicateName = await transaction.presentacionProducto.findFirst({
        where: {
          productoId: productId,
          activo: true,
          nombre: name,
          id: { not: presentationId },
        },

        select: { id: true },
      });

      if (duplicateName) {
        throw new AppError("Ya existe una presentación con ese nombre en este producto.", 409);
      }

      await transaction.codigoBarraProducto.deleteMany({
        where: { presentacionId: presentationId },
      });

      await transaction.presentacionProducto.update({
        where: { id: presentationId },

        data: {
          nombre: name,
          precioBase: price,

          ...(barcode
            ? { codigosBarra: { create: { codigo: barcode, principal: true } } }
            : {}),
        },
      });

      return transaction.producto.findUnique({
        where: { id: productId },
        include: PRODUCT_INCLUDE,
      });
    });

    await registrarBitacora({
      usuarioId: userId,
      accion: "EDITAR_PRESENTACION",
      entidad: "Producto",
      entidadId: productId,
      detalle: { presentacion: name, precio: Number(price) },
    });

    return serializeProduct(product);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("Ese código de barras ya pertenece a otra presentación.", 409);
    }

    throw error;
  }
}

export async function deactivatePresentation(productIdInput, presentationIdInput, userId) {
  const productId = productIdValue(productIdInput);
  const presentationId = productIdValue(presentationIdInput);

  const product = await prisma.$transaction(async (transaction) => {
    const presentation = await transaction.presentacionProducto.findFirst({
      where: { id: presentationId, productoId: productId, activo: true },
    });

    if (!presentation) {
      throw new AppError("La presentación no existe.", 404);
    }

    if (presentation.esPrincipal) {
      throw new AppError(
        "No puedes eliminar la presentación principal. Desactiva el producto completo si ya no se usa.",
        400,
      );
    }

    // Soft delete: hay relaciones desde ventas_detalle, compras_detalle,
    // etc. con onDelete Restrict, así que nunca se borra físicamente.
    await transaction.presentacionProducto.update({
      where: { id: presentationId },
      data: { activo: false },
    });

    return transaction.producto.findUnique({
      where: { id: productId },
      include: PRODUCT_INCLUDE,
    });
  });

  await registrarBitacora({
    usuarioId: userId,
    accion: "DESACTIVAR_PRESENTACION",
    entidad: "Producto",
    entidadId: productId,
  });

  return serializeProduct(product);
}

// --- Productos compuestos (familias) --------------------------------
//
// Un producto compuesto (ej. "Saco de pollo mixto") no lleva su propio
// stock: al venderse, se descuenta una cantidad FIJA de cada componente
// real (ej. Pierna 56 lb, Pechuga 56 lb) por cada unidad vendida del
// padre. Distinto de PresentacionProducto, que multiplica por un factor
// sobre el MISMO stock (ej. six-pack de Coca).

export async function getProductComponents(productIdInput) {
  const productId = productIdValue(productIdInput);

  const components = await prisma.componenteProducto.findMany({
    where: { productoPadreId: productId },

    include: {
      productoComponente: {
        include: {
          presentaciones: {
            where: { esPrincipal: true, activo: true },
            take: 1,
          },
        },
      },
    },

    orderBy: { id: "asc" },
  });

  return components.map((component) => {
    // El factor de la presentación principal del componente convierte
    // de unidades de inventario (ej. gramos) a unidades visibles
    // (ej. libras), que es como el usuario escribió la cantidad.
    const factor = Number(
      component.productoComponente.presentaciones[0]?.factorInventario ?? 1,
    );

    return {
      id: component.id,
      cantidad: Number(component.cantidad) / factor,

      producto: {
        id: component.productoComponente.id,
        nombre: component.productoComponente.nombre,
        stock: Number(component.productoComponente.stockActual) / factor,
        unidadInventario: component.productoComponente.unidadInventario,
      },
    };
  });
}

export async function setProductComponents(productIdInput, componentsInput, userId) {
  const productId = productIdValue(productIdInput);

  const items = Array.isArray(componentsInput) ? componentsInput : [];

  const parsedComponents = items.map((item) => ({
    productoComponenteId: productIdValue(item.productoId),
    cantidadVisible: quantityValue(item.cantidad, "La cantidad"),
  }));

  for (const component of parsedComponents) {
    if (component.productoComponenteId === productId) {
      throw new AppError("Un producto no puede ser componente de sí mismo.", 400);
    }
  }

  const uniqueIds = new Set(parsedComponents.map((component) => component.productoComponenteId));

  if (uniqueIds.size !== parsedComponents.length) {
    throw new AppError("No repitas el mismo producto como componente dos veces.", 400);
  }

  const product = await prisma.$transaction(async (transaction) => {
    const parentProduct = await transaction.producto.findFirst({
      where: { id: productId, activo: true },
      select: { id: true },
    });

    if (!parentProduct) {
      throw new AppError("El producto seleccionado no existe.", 404);
    }

    let internalFactorById = new Map();

    if (parsedComponents.length > 0) {
      const componentProducts = await transaction.producto.findMany({
        where: { id: { in: [...uniqueIds] }, activo: true },

        include: {
          presentaciones: {
            where: { esPrincipal: true, activo: true },
            take: 1,
          },
        },
      });

      if (componentProducts.length !== uniqueIds.size) {
        throw new AppError("Uno de los productos componente no existe o está inactivo.", 400);
      }

      internalFactorById = new Map(
        componentProducts.map((product) => [
          product.id,
          new Prisma.Decimal(product.presentaciones[0]?.factorInventario ?? 1),
        ]),
      );
    }

    await transaction.componenteProducto.deleteMany({
      where: { productoPadreId: productId },
    });

    if (parsedComponents.length > 0) {
      await transaction.componenteProducto.createMany({
        data: parsedComponents.map((component) => ({
          productoPadreId: productId,
          productoComponenteId: component.productoComponenteId,

          // Se guarda ya convertida a unidades de inventario (ej. si el
          // usuario escribió 56 lb, aquí se guarda en gramos).
          cantidad: component.cantidadVisible.mul(
            internalFactorById.get(component.productoComponenteId),
          ),
        })),
      });
    }

    return transaction.producto.update({
      where: { id: productId },
      data: { esCompuesto: parsedComponents.length > 0 },
      include: PRODUCT_INCLUDE,
    });
  });

  await registrarBitacora({
    usuarioId: userId,
    accion: "ACTUALIZAR_COMPONENTES",
    entidad: "Producto",
    entidadId: productId,
    detalle: { nombre: product.nombre, componentes: parsedComponents.length },
  });

  return serializeProduct(product);
}