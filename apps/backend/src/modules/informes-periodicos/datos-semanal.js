// apps/backend/src/modules/informes-periodicos/datos-semanal.js
//
// Datos del informe semanal: compras detalladas (con utilidad bruta
// proyectada y costo del último lote), bajas, entradas manuales,
// devoluciones a proveedores y entradas/salidas por producto.
//
// Todo el inventario se guarda en unidades internas (unidad, gramo o
// mililitro). Para mostrarlo se pasa a la presentación principal del
// producto, igual que la pantalla de Inventario.

import { prisma } from "../../lib/prisma.js";
import { instantesDelRango, rangoSemanal } from "./periodos.js";
import { esCigarro } from "./productos.js";

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;
const redondearCantidad = (valor) => Math.round((Number(valor) || 0) * 1000) / 1000;

const PRINCIPAL = {
  presentaciones: {
    where: { esPrincipal: true },
    select: { nombre: true, factorInventario: true, precioBase: true },
    take: 1,
  },
};

function factorPrincipal(producto) {
  return Number(producto?.presentaciones?.[0]?.factorInventario ?? 1) || 1;
}

// Signo de cada movimiento sobre el stock. La cantidad se guarda positiva.
const SIGNO = {
  INVENTARIO_INICIAL: 1,
  COMPRA: 1,
  DEVOLUCION_CLIENTE: 1,
  AJUSTE_POSITIVO: 1,
  CANCELACION_VENTA: 1,
  VENTA: -1,
  DEVOLUCION_PROVEEDOR: -1,
  AJUSTE_NEGATIVO: -1,
  ANULACION_COMPRA: -1,
};

const NO_VENTA = ["COMPRA", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO", "DEVOLUCION_PROVEEDOR", "DEVOLUCION_CLIENTE", "ANULACION_COMPRA", "INVENTARIO_INICIAL"];

function plural(nombre) {
  return /[aeiouáéíóú]$/.test(nombre) ? `${nombre}s` : `${nombre}es`;
}

async function ultimoLote(productoId, antesDe) {
  const detalle = await prisma.compraDetalle.findFirst({
    where: { productoId, compra: { estado: "RECIBIDA", creadoEn: { lt: antesDe } } },
    orderBy: { compra: { creadoEn: "desc" } },
    select: { costoUnitarioInventario: true, compra: { select: { creadoEn: true } } },
  });
  return detalle
    ? { costoInventario: Number(detalle.costoUnitarioInventario), fecha: detalle.compra.creadoEn }
    : null;
}

async function cargarCompras(from, to) {
  const compras = await prisma.compra.findMany({
    where: { creadoEn: { gte: from, lte: to } },
    orderBy: { creadoEn: "asc" },
    include: {
      usuario: { select: { nombre: true } },
      detalles: { orderBy: { id: "asc" }, include: { producto: { select: { unidadInventario: true, categoria: { select: { nombre: true } }, ...PRINCIPAL } } } },
    },
  });

  return Promise.all(compras.map(async (compra) => ({
    id: compra.id,
    proveedor: compra.proveedorNombre,
    documento: compra.numeroDocumento,
    creadoEn: compra.creadoEn,
    usuario: compra.usuario?.nombre ?? "—",
    anulada: compra.estado === "ANULADA",
    anuladaEn: compra.anuladaEn,
    total: Number(compra.total),
    lineas: await Promise.all(compra.detalles.map(async (detalle) => {
      const principal = detalle.producto?.presentaciones?.[0];
      const factor = factorPrincipal(detalle.producto);
      const costoInventario = Number(detalle.costoUnitarioInventario);
      const cantidadInventario = Number(detalle.cantidadInventario);
      const precioVenta = principal ? Number(principal.precioBase) : null;
      const lote = await ultimoLote(detalle.productoId, compra.creadoEn);
      const costoUnidad = costoInventario * factor;
      const utilidadUnidad = precioVenta === null ? null : precioVenta - costoUnidad;

      return {
        producto: detalle.productoNombre,
        // Solo los cigarros muestran la presentación; lo demás va en unidades (o libras, etc.).
        presentacion: esCigarro(detalle.producto, detalle.productoNombre)
          ? { nombre: detalle.presentacionNombre, cantidad: Number(detalle.cantidad), costo: Number(detalle.costoPresentacion) }
          : null,
        unidad: detalle.producto?.unidadInventario === "UNIDAD" || !principal ? "unidades" : plural(principal.nombre.toLowerCase()),
        unidades: redondearCantidad(cantidadInventario / factor),
        costoUnidad,
        lote: lote ? { costoUnidad: lote.costoInventario * factor, fecha: lote.fecha } : null,
        precioVenta,
        utilidadUnidad,
        margen: precioVenta ? (utilidadUnidad / precioVenta) * 100 : null,
        utilidad: utilidadUnidad === null ? null : redondear(utilidadUnidad * (cantidadInventario / factor)),
        subtotal: Number(detalle.subtotal),
      };
    })),
  })));
}

function movimientoVisible(movimiento) {
  const factor = factorPrincipal(movimiento.producto);
  return {
    creadoEn: movimiento.creadoEn,
    tipo: movimiento.tipo,
    producto: movimiento.producto?.nombre ?? "—",
    cantidad: redondearCantidad(Number(movimiento.cantidad) / factor),
    costoUnidad: Number(movimiento.costoUnitario ?? movimiento.producto?.costoPromedio ?? 0) * factor,
    perdida: redondear(Number(movimiento.cantidad) * Number(movimiento.costoUnitario ?? movimiento.producto?.costoPromedio ?? 0)),
    motivo: movimiento.motivo ?? "—",
    usuario: movimiento.usuario?.nombre ?? "—",
  };
}

async function cargarMovimientosManuales(from, to) {
  const movimientos = await prisma.movimientoInventario.findMany({
    where: {
      creadoEn: { gte: from, lte: to },
      OR: [
        { tipo: { in: ["AJUSTE_NEGATIVO", "AJUSTE_POSITIVO", "DEVOLUCION_PROVEEDOR", "DEVOLUCION_CLIENTE"] } },
        // Las entradas manuales de Inventario se guardan como COMPRA sin compra.
        { tipo: "COMPRA", compraId: null },
      ],
    },
    orderBy: { creadoEn: "asc" },
    include: {
      usuario: { select: { nombre: true } },
      producto: { select: { nombre: true, costoPromedio: true, ...PRINCIPAL } },
    },
  });

  const visibles = movimientos.map(movimientoVisible);
  return {
    bajas: visibles.filter((movimiento) => movimiento.tipo === "AJUSTE_NEGATIVO"),
    otros: visibles.filter((movimiento) => movimiento.tipo !== "AJUSTE_NEGATIVO"),
  };
}

async function cargarInventarioPorProducto(from, to) {
  const conCambios = await prisma.movimientoInventario.findMany({
    where: { creadoEn: { gte: from, lte: to }, tipo: { in: NO_VENTA } },
    distinct: ["productoId"],
    select: { productoId: true },
  });
  if (!conCambios.length) return [];

  const movimientos = await prisma.movimientoInventario.findMany({
    where: { creadoEn: { gte: from, lte: to }, productoId: { in: conCambios.map((item) => item.productoId) } },
    // Por id: es el orden real en que se guardaron (y en que se calculó cada saldo).
    orderBy: { id: "asc" },
    select: {
      productoId: true, tipo: true, compraId: true, cantidad: true, saldoPosterior: true,
      producto: { select: { nombre: true, ...PRINCIPAL } },
    },
  });

  const productos = new Map();
  for (const movimiento of movimientos) {
    const cantidad = Math.abs(Number(movimiento.cantidad));
    const signo = SIGNO[movimiento.tipo] ?? 0;
    const fila = productos.get(movimiento.productoId) ?? {
      producto: movimiento.producto?.nombre ?? "—",
      factor: factorPrincipal(movimiento.producto),
      inicial: 0, compras: 0, ajustes: 0, ventas: 0, bajas: 0, final: 0,
    };

    if (movimiento.tipo === "COMPRA" && movimiento.compraId) fila.compras += cantidad;
    else if (movimiento.tipo === "ANULACION_COMPRA") fila.compras -= cantidad;
    else if (movimiento.tipo === "VENTA") fila.ventas += cantidad;
    else if (movimiento.tipo === "CANCELACION_VENTA") fila.ventas -= cantidad;
    else if (signo > 0) fila.ajustes += cantidad;
    else fila.bajas += cantidad;

    fila.final = Number(movimiento.saldoPosterior);
    productos.set(movimiento.productoId, fila);
  }

  // Lo que había al iniciar = lo que quedó − lo que cambió en la semana,
  // así la fila siempre cuadra.
  for (const fila of productos.values()) {
    fila.inicial = fila.final - fila.compras - fila.ajustes + fila.ventas + fila.bajas;
  }

  return [...productos.values()]
    .map(({ factor, ...fila }) => Object.fromEntries(
      Object.entries(fila).map(([clave, valor]) => [clave, typeof valor === "number" ? redondearCantidad(valor / factor) : valor]),
    ))
    .sort((a, b) => a.producto.localeCompare(b.producto, "es"));
}

export async function datosSemanales(fecha) {
  const rango = rangoSemanal(fecha);
  const { from, to } = instantesDelRango(rango);

  const [compras, manuales, inventario, devoluciones] = await Promise.all([
    cargarCompras(from, to),
    cargarMovimientosManuales(from, to),
    cargarInventarioPorProducto(from, to),
    prisma.devolucion.aggregate({
      where: { tipo: "PROVEEDOR", creadoEn: { gte: from, lte: to } },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  return {
    rango,
    compras,
    bajas: manuales.bajas,
    otrosMovimientos: manuales.otros,
    inventario,
    devueltoProveedores: { total: redondear(devoluciones._sum.total), cantidad: devoluciones._count._all },
  };
}
