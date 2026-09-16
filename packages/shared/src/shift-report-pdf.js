import { generarInformeTurnoHTML as renderTemplate, formatMoney } from "./informe-turno.template.js";

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

const PAYMENT_LABELS = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

const SHIFT_SCHEDULES = {
  A: ["2:00 a. m.", "8:00 a. m."],
  B: ["8:00 a. m.", "6:00 p. m."],
  C: ["6:00 p. m.", "2:00 a. m."],
};

export function safePdfName(value) {
  const name = String(value || "informe-turno.pdf")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .trim();

  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

function horaCorta(value) {
  return new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

function horaSola(hour) {
  return new Intl.DateTimeFormat("es-HN", {
    hour: "numeric",
    hour12: true,
  }).format(new Date(2000, 0, 1, Number(hour), 0));
}

function periodDate(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return String(value ?? "");
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function periodoTexto(desde, hasta) {
  const rango = !hasta || desde === hasta
    ? periodDate(desde)
    : `${periodDate(desde)} – ${periodDate(hasta)}`;

  return `Periodo: ${rango}`;
}

function turnoHeader(turnos) {
  if (Array.isArray(turnos) && turnos.length === 1 && SHIFT_SCHEDULES[turnos[0]]) {
    const [inicio, fin] = SHIFT_SCHEDULES[turnos[0]];

    return { numero: turnos[0], horaInicio: inicio, horaFin: fin };
  }

  return { numero: (turnos ?? []).join("+") || "Completo", horaInicio: "Día completo", horaFin: "" };
}

function buildResumenHtml(report) {
  const summary = report?.resumen ?? {};
  const products = report?.productos ?? [];
  const payments = report?.pagos ?? [];
  const leaders = report?.lideres ?? {};

  const operations = Number(summary.operaciones ?? 0);

  if (operations === 0) {
    return "No se registraron ventas durante el periodo seleccionado.";
  }

  const totalUnits = products.reduce((sum, product) => sum + Number(product.cantidad ?? 0), 0);

  const mainPayment = [...payments].sort(
    (first, second) => Number(second.total) - Number(first.total),
  )[0];

  const revenueLeader = leaders.mayorIngreso?.nombre;
  const quantityLeader = leaders.mayorCantidad?.nombre;
  const profitLeader = leaders.mayorGanancia?.nombre;

  const leaderSentence =
    revenueLeader && revenueLeader === quantityLeader
      ? `${revenueLeader} lideró en ingresos y cantidad; `
      : revenueLeader
        ? `${revenueLeader} lideró en ingresos${quantityLeader ? ` y ${quantityLeader} en cantidad; ` : "; "}`
        : "";

  const profitSentence = profitLeader ? `${profitLeader} dejó la mayor ganancia. ` : "";

  return (
    `Se completaron ${operations} ${operations === 1 ? "venta" : "ventas"} ` +
    `por un total de ${formatMoney(summary.total)}, con ${totalUnits.toLocaleString("es-HN", { maximumFractionDigits: 3 })} unidades vendidas ` +
    `en ${products.length} ${products.length === 1 ? "producto distinto" : "productos distintos"}. ` +
    `El método con mayor participación fue ${PAYMENT_LABELS[mainPayment?.metodo] ?? "sin información"}. ` +
    leaderSentence +
    profitSentence +
    `Tras entradas y salidas de caja, el efectivo esperado en caja es de ${formatMoney(report?.cierre?.efectivoEsperado)} ` +
    `(las compras a proveedores no se descuentan de caja salvo que se registren como salida).`
  );
}

function buildNotaPie() {
  return "La ganancia es una estimación basada en los costos registrados.";
}

function datosDesdeInforme(report) {
  const periodo = report?.periodo ?? {};
  const summary = report?.resumen ?? {};
  const cierre = report?.cierre ?? {};
  const leaders = report?.lideres ?? {};
  const products = Array.isArray(report?.productos) ? report.productos : [];
  const payments = Array.isArray(report?.pagos) ? report.pagos : [];
  const hours = Array.isArray(report?.horas) ? report.horas : [];
  const entradas = Array.isArray(report?.caja?.entradas) ? report.caja.entradas : [];
  const salidas = Array.isArray(report?.caja?.salidas) ? report.caja.salidas : [];
  const compras = Array.isArray(report?.compras) ? report.compras : [];
  const cierresCaja = Array.isArray(report?.cuadreCaja?.cierres) ? report.cuadreCaja.cierres : [];
  const creditos = Array.isArray(report?.creditos) ? report.creditos : [];
  const movimientosInventario = Array.isArray(report?.movimientosInventario) ? report.movimientosInventario : [];

  const generadoTexto = `Generado: ${new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date())}, ${new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date())}`;

  return {
    turno: turnoHeader(periodo.turnos),
    periodo: { texto: periodoTexto(periodo.desde, periodo.hasta) },
    generadoTexto,

    kpis: [
      { etiqueta: "Total vendido", valor: summary.total, tipo: "dinero" },
      { etiqueta: "Efectivo esperado", valor: summary.efectivoEsperado, tipo: "dinero" },
      { etiqueta: "Ventas realizadas", valor: summary.operaciones, tipo: "numero" },
      { etiqueta: "Costo estimado", valor: summary.costoEstimado, tipo: "dinero" },
      { etiqueta: "Ganancia estimada", valor: summary.gananciaEstimada, tipo: "dinero" },
      { etiqueta: "Margen estimado", valor: summary.margenEstimado, tipo: "margen" },
    ],

    cierre: {
      efectivoVentas: cierre.efectivoVentas,
      totalEntradas: cierre.entradas,
      totalSalidas: cierre.salidas,
    },

    cuadreReal: {
      items: cierresCaja.map((closure) => ({
        hora: horaCorta(closure.cerradoEn),
        cajero: closure.usuarioCierre?.nombre ?? "—",
        fondoInicial: closure.fondoInicial,
        esperado: closure.efectivoEsperado,
        contado: closure.efectivoContado,
      })),
    },

    destacados: [
      {
        etiqueta: "Líder por ingresos",
        nombre: leaders.mayorIngreso?.nombre ?? "Sin datos",
        valor: leaders.mayorIngreso ? formatMoney(leaders.mayorIngreso.ventas) : "—",
      },
      {
        etiqueta: "Mayor cantidad",
        nombre: leaders.mayorCantidad?.nombre ?? "Sin datos",
        valor: leaders.mayorCantidad
          ? `${Number(leaders.mayorCantidad.cantidad).toLocaleString("es-HN", { maximumFractionDigits: 3 })} unidades`
          : "—",
      },
      {
        etiqueta: "Mayor ganancia",
        nombre: leaders.mayorGanancia?.nombre ?? "Sin datos",
        valor: leaders.mayorGanancia ? formatMoney(leaders.mayorGanancia.ganancia) : "—",
      },
      {
        etiqueta: "Hora con más ventas",
        nombre: leaders.horaConMasVentas ? horaSola(leaders.horaConMasVentas.hora) : "Sin datos",
        valor: leaders.horaConMasVentas ? formatMoney(leaders.horaConMasVentas.total) : "—",
      },
    ],

    cobros: payments.map((payment) => ({
      nombre: PAYMENT_LABELS[payment.metodo] ?? payment.metodo,
      monto: payment.total,
      porcentaje: Math.round(Number(payment.porcentaje ?? 0)),
      operaciones: payment.operaciones,
    })),

    horas: hours.map((hour) => ({
      etiqueta: horaSola(hour.hora),
      valor: hour.total,
    })),

    notaHoras: hours.length ? "Solo se registraron ventas en estas horas dentro del turno." : undefined,

    entradas: {
      items: entradas.map((entry) => ({
        hora: horaCorta(entry.creadoEn),
        motivo: entry.motivo,
        monto: entry.monto,
      })),
    },

    salidas: {
      items: salidas.map((entry) => ({
        hora: horaCorta(entry.creadoEn),
        motivo: entry.motivo,
        monto: entry.monto,
      })),
    },

    compras: {
      items: compras.map((purchase) => ({
        proveedor: purchase.proveedor,
        hora: horaCorta(purchase.creadoEn),
        total: purchase.total,
      })),
    },

    creditos: {
      items: creditos.map((credito) => ({
        cliente: credito.cliente,
        hora: horaCorta(credito.creadoEn),
        monto: credito.monto,
      })),
    },

    inventario: {
      items: movimientosInventario.map((movimiento) => ({
        producto: movimiento.producto,
        movimiento: movimiento.movimiento,
        cantidad: movimiento.cantidad,
        motivo: movimiento.motivo ?? "—",
      })),
    },

    productos: products.map((product) => ({
      nombre: product.nombre,
      cantidad: product.cantidad,
      ventas: product.ventas,
      costo: product.costo,
      ganancia: product.ganancia,
    })),

    resumenHtml: buildResumenHtml(report),
    notaPie: buildNotaPie(),
  };
}

export function generarInformeTurnoHTML(report) {
  return renderTemplate(datosDesdeInforme(report));
}