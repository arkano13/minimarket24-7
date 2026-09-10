function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function quantity(value) {
  return new Intl.NumberFormat("es-HN", {
    maximumFractionDigits: 3,
  }).format(Number(value ?? 0));
}

function paymentLabel(method) {
  return {
    EFECTIVO: "Efectivo",
    TARJETA: "Tarjeta",
    TRANSFERENCIA: "Transferencia",
  }[method] ?? method ?? "No indicado";
}

export function buildUserSalesReceiptHtml(report) {
  if (!report || !Array.isArray(report.turnos)) {
    throw new Error("No se recibieron las ventas del usuario.");
  }
  const completedSales = report.turnos.flatMap((shift) => shift.ventas)
    .filter((sale) => sale.estado !== "CANCELADA");
  const total = completedSales.reduce((sum, sale) => sum + Number(sale.monto ?? 0), 0);
  const paymentTotals = completedSales.flatMap((sale) => sale.pagos).reduce(
    (totals, payment) => ({
      ...totals,
      [payment.metodo]: (totals[payment.metodo] ?? 0) + Number(payment.monto ?? 0),
    }),
    { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 },
  );
  const saleHtml = (sale) => {
    const time = new Intl.DateTimeFormat("es-HN", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/Tegucigalpa",
    }).format(new Date(sale.creadoEn));
    const products = sale.productos.map((product) => {
      const unitPrice = Number(product.cantidad) > 0
        ? Number(product.subtotal) / Number(product.cantidad)
        : 0;
      return `<div class="item">
        <div class="item-name">${escapeHtml(product.nombre)} · ${escapeHtml(product.presentacion)}</div>
        <div class="item-values"><span>${quantity(product.cantidad)} × L ${money(unitPrice)}</span><strong>L ${money(product.subtotal)}</strong></div>
      </div>`;
    }).join("");
    const payments = sale.pagos.map((payment) => paymentLabel(payment.metodo)).join(" + ");
    return `<div class="sale">
      <div class="sale-heading"><strong>VENTA #${escapeHtml(sale.id)}</strong><span>${escapeHtml(time)}</span></div>
      ${products}
      <div class="sale-total"><span>${escapeHtml(payments)}</span><strong>${sale.estado === "CANCELADA" ? "CANCELADA" : `L ${money(sale.monto)}`}</strong></div>
    </div>`;
  };
  const shifts = report.turnos.map((shift) => {
    const shiftTotal = shift.ventas
      .filter((sale) => sale.estado !== "CANCELADA")
      .reduce((sum, sale) => sum + Number(sale.monto ?? 0), 0);
    return `<section class="shift">
      <div class="shift-heading"><strong>TURNO ${escapeHtml(shift.nombre)}</strong><span>${escapeHtml(shift.horario)}</span></div>
      ${shift.ventas.length ? shift.ventas.map(saleHtml).join("") : '<p class="empty">Sin ventas</p>'}
      <div class="shift-total"><strong>TOTAL TURNO ${escapeHtml(shift.nombre)}</strong><strong>L ${money(shiftTotal)}</strong></div>
    </section>`;
  }).join("");

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Mis ventas ${escapeHtml(report.fecha)}</title>
      <style>
        @page { size: 80mm auto; margin: 3mm; }
        * { box-sizing: border-box; }
        body { width: 74mm; margin: 0; color: #000; background: #fff; font-family: "Courier New", monospace; font-size: 11px; line-height: 1.3; }
        h1, p { margin: 0; }
        header { padding-bottom: 8px; border-bottom: 1px dashed #000; text-align: center; }
        h1 { font-size: 17px; }
        .meta { display: grid; gap: 2px; padding: 8px 0; border-bottom: 1px dashed #000; }
        .shift { padding: 8px 0; border-bottom: 2px dashed #000; }
        .shift-heading, .shift-total { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
        .shift-total { padding-top: 7px; }
        .sale { padding: 8px 0; border-bottom: 1px dashed #000; }
        .sale-heading, .sale-total { display: flex; justify-content: space-between; gap: 8px; }
        .item { padding: 5px 0; border-bottom: 1px dotted #777; }
        .item-name { font-weight: 700; overflow-wrap: anywhere; }
        .item-values, .summary-row { display: flex; justify-content: space-between; gap: 8px; }
        .summary { display: grid; gap: 4px; padding-top: 8px; }
        .total { margin-top: 3px; padding: 6px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; font-size: 15px; font-weight: 700; }
        .empty { margin: 7px 0; text-align: center; }
        footer { padding-top: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <header><h1>Minimarket 24/7</h1><p>Resumen de ventas del usuario</p></header>
      <section class="meta">
        <span>Usuario: ${escapeHtml(report.usuario?.nombre ?? "Usuario actual")}</span>
        <span>Fecha: ${escapeHtml(report.fecha)}</span>
      </section>
      <main>${shifts}</main>
      <section class="summary">
        <div class="summary-row"><span>Ventas completadas</span><strong>${completedSales.length}</strong></div>
        <div class="summary-row"><span>Efectivo</span><strong>L ${money(paymentTotals.EFECTIVO)}</strong></div>
        <div class="summary-row"><span>Tarjeta</span><strong>L ${money(paymentTotals.TARJETA)}</strong></div>
        <div class="summary-row"><span>Transferencia</span><strong>L ${money(paymentTotals.TRANSFERENCIA)}</strong></div>
        <div class="summary-row total"><span>TOTAL GENERAL</span><strong>L ${money(total)}</strong></div>
      </section>
      <footer><p>Fin del reporte de ventas</p></footer>
    </body>
  </html>`;
}
