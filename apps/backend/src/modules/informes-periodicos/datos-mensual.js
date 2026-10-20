// apps/backend/src/modules/informes-periodicos/datos-mensual.js
//
// Datos del informe mensual. Los totales, productos, cobros y compras
// salen de getShiftReport (el mismo cálculo del reporte diario); la
// ganancia por semana y por turno se arma con una consulta liviana de
// las ventas del mes.

import { prisma } from "../../lib/prisma.js";
import { businessDayFor, getShiftReport, reportShift } from "../reportes/reportes.service.js";
import { instantesDelRango, rangoMensual, rangoMesAnterior, semanasDelMes } from "./periodos.js";
import { esCigarro, nombreConPresentacion } from "./productos.js";

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

async function cargarVentas(rango) {
  const { from, to } = instantesDelRango(rango);
  return prisma.venta.findMany({
    where: { estado: "COMPLETADA", creadoEn: { gte: from, lte: to } },
    select: {
      creadoEn: true,
      total: true,
      detalles: {
        select: {
          productoId: true, presentacionId: true, productoNombre: true, presentacionNombre: true,
          cantidad: true, cantidadInventario: true, costoUnitario: true, subtotal: true,
          producto: {
            select: {
              categoria: { select: { nombre: true } },
              presentaciones: { where: { esPrincipal: true }, select: { id: true, factorInventario: true }, take: 1 },
            },
          },
        },
      },
    },
  });
}

// Productos vendidos: todo en unidades del producto, salvo los cigarros,
// que se separan por presentación (cajetilla grande, pequeña, unidad).
function productosVendidos(ventas) {
  const productos = new Map();
  for (const detalle of ventas.flatMap((venta) => venta.detalles)) {
    const principal = detalle.producto?.presentaciones?.[0];
    const porPresentacion = esCigarro(detalle.producto, detalle.productoNombre);
    const clave = porPresentacion ? `${detalle.productoId}-${detalle.presentacionId}` : `${detalle.productoId}`;
    const nombre = porPresentacion && principal?.id !== detalle.presentacionId && detalle.presentacionNombre
      ? nombreConPresentacion(detalle.productoNombre, detalle.presentacionNombre)
      : detalle.productoNombre;
    const fila = productos.get(clave) ?? { nombre, cantidad: 0, ventas: 0 };
    fila.cantidad += porPresentacion
      ? Number(detalle.cantidad)
      : Number(detalle.cantidadInventario) / (Number(principal?.factorInventario ?? 1) || 1);
    fila.ventas += Number(detalle.subtotal);
    productos.set(clave, fila);
  }
  return [...productos.values()]
    .map((fila) => ({ ...fila, cantidad: Math.round(fila.cantidad * 1000) / 1000, ventas: redondear(fila.ventas) }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

function gananciaPorVenta(ventas) {
  // Misma fórmula que getShiftReport: total de la venta − costo de sus líneas.
  return ventas.map((venta) => ({
    dia: businessDayFor(venta.creadoEn),
    turno: reportShift(venta.creadoEn),
    total: Number(venta.total),
    ganancia: Number(venta.total) - venta.detalles.reduce(
      (suma, detalle) => suma + Number(detalle.costoUnitario) * Number(detalle.cantidad), 0,
    ),
  }));
}

function porTurno(ventas) {
  const turnos = { A: 0, B: 0, C: 0 };
  for (const venta of ventas) turnos[venta.turno] += venta.ganancia;
  return Object.fromEntries(Object.entries(turnos).map(([turno, ganancia]) => [turno, redondear(ganancia)]));
}

function turnoMasRentable(turnos) {
  const [turno, ganancia] = Object.entries(turnos).sort((a, b) => b[1] - a[1])[0];
  return ganancia > 0 ? { turno, ganancia } : null;
}

function comprasPorProveedor(compras) {
  const proveedores = new Map();
  for (const compra of compras) {
    const entrada = proveedores.get(compra.proveedor) ?? { nombre: compra.proveedor, compras: 0, total: 0 };
    entrada.compras += 1;
    entrada.total += compra.total;
    proveedores.set(compra.proveedor, entrada);
  }
  return [...proveedores.values()]
    .map((proveedor) => ({ ...proveedor, total: redondear(proveedor.total) }))
    .sort((a, b) => b.total - a.total);
}

function resumenMes(reporte, turnos, productos) {
  const compras = reporte.compras ?? [];
  return {
    total: reporte.resumen.total,
    ganancia: reporte.resumen.gananciaEstimada,
    margen: reporte.resumen.margenEstimado,
    operaciones: reporte.resumen.operaciones,
    masVendido: productos[0] ?? null,
    turno: turnoMasRentable(turnos),
    pedidos: compras.length,
    gastadoEnCompras: redondear(compras.reduce((suma, compra) => suma + compra.total, 0)),
  };
}

export async function datosMensuales(fecha) {
  const rango = rangoMensual(fecha);
  const anterior = rangoMesAnterior(fecha);

  const [reporte, reporteAnterior, ventasMes, ventasMesAnterior] = await Promise.all([
    getShiftReport(rango.desde, rango.hasta),
    getShiftReport(anterior.desde, anterior.hasta),
    cargarVentas(rango),
    cargarVentas(anterior),
  ]);
  const ventas = gananciaPorVenta(ventasMes);
  const ventasAnteriores = gananciaPorVenta(ventasMesAnterior);
  const productos = productosVendidos(ventasMes);

  const semanas = semanasDelMes(rango).map((semana) => ({
    ...semana,
    ganancia: redondear(
      ventas.filter((venta) => venta.dia >= semana.desde && venta.dia <= semana.hasta)
        .reduce((suma, venta) => suma + venta.ganancia, 0),
    ),
  }));

  const turnos = porTurno(ventas);
  const turnosAnteriores = porTurno(ventasAnteriores);
  const pagos = reporte.pagos ?? [];
  const cobros = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"].map((metodo) => {
    const pago = pagos.find((item) => item.metodo === metodo);
    return { metodo, total: redondear(pago?.total), operaciones: pago?.operaciones ?? 0 };
  });

  return {
    rango,
    anterior,
    actual: resumenMes(reporte, turnos, productos),
    previo: resumenMes(reporteAnterior, turnosAnteriores, productosVendidos(ventasMesAnterior)),
    top: productos.slice(0, 5),
    cobros,
    credito: redondear(pagos.find((item) => item.metodo === "CREDITO")?.total),
    proveedores: comprasPorProveedor(reporte.compras ?? []),
    semanas,
    turnos,
    turnosAnteriores,
  };
}
