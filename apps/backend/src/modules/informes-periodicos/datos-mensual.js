// apps/backend/src/modules/informes-periodicos/datos-mensual.js
//
// Datos del informe mensual. Los totales, productos, cobros y compras
// salen de getShiftReport (el mismo cálculo del reporte diario); la
// ganancia por semana y por turno se arma con una consulta liviana de
// las ventas del mes.

import { prisma } from "../../lib/prisma.js";
import { businessDayFor, getShiftReport, reportShift } from "../reportes/reportes.service.js";
import { instantesDelRango, rangoMensual, rangoMesAnterior, semanasDelMes } from "./periodos.js";

const redondear = (valor) => Math.round((Number(valor) || 0) * 100) / 100;

async function gananciaPorVenta(rango) {
  const { from, to } = instantesDelRango(rango);
  const ventas = await prisma.venta.findMany({
    where: { estado: "COMPLETADA", creadoEn: { gte: from, lte: to } },
    select: {
      creadoEn: true,
      total: true,
      detalles: { select: { costoUnitario: true, cantidad: true } },
    },
  });

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

function masVendido(productos) {
  return [...productos].sort((a, b) => b.cantidad - a.cantidad)[0] ?? null;
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

function resumenMes(reporte, turnos) {
  const compras = reporte.compras ?? [];
  return {
    total: reporte.resumen.total,
    ganancia: reporte.resumen.gananciaEstimada,
    margen: reporte.resumen.margenEstimado,
    operaciones: reporte.resumen.operaciones,
    masVendido: masVendido(reporte.productos),
    turno: turnoMasRentable(turnos),
    pedidos: compras.length,
    gastadoEnCompras: redondear(compras.reduce((suma, compra) => suma + compra.total, 0)),
  };
}

export async function datosMensuales(fecha) {
  const rango = rangoMensual(fecha);
  const anterior = rangoMesAnterior(fecha);

  const [reporte, reporteAnterior, ventas, ventasAnteriores] = await Promise.all([
    getShiftReport(rango.desde, rango.hasta),
    getShiftReport(anterior.desde, anterior.hasta),
    gananciaPorVenta(rango),
    gananciaPorVenta(anterior),
  ]);

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
    actual: resumenMes(reporte, turnos),
    previo: resumenMes(reporteAnterior, turnosAnteriores),
    top: [...reporte.productos].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5),
    cobros,
    credito: redondear(pagos.find((item) => item.metodo === "CREDITO")?.total),
    proveedores: comprasPorProveedor(reporte.compras ?? []),
    semanas,
    turnos,
    turnosAnteriores,
  };
}
