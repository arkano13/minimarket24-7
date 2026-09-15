const PAYMENT_LABELS = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

const HONDURAS_TIME_ZONE = "America/Tegucigalpa";

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

function signedMoney(value, sign) {
  const amount = money(Math.abs(Number(value ?? 0)));
  return sign === "negative" ? `− L ${amount}` : `+ L ${amount}`;
}

function quantity(value) {
  return new Intl.NumberFormat("es-HN", {
    maximumFractionDigits: 3,
  }).format(Number(value ?? 0));
}

function percent(value) {
  return `${new Intl.NumberFormat("es-HN", {
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0))}%`;
}

function periodDate(value) {
  const match = String(value ?? "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  );

  if (!match) {
    return escapeHtml(value);
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  return new Intl.DateTimeFormat("es-HN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function periodLabel(desde, hasta) {
  if (!hasta || desde === hasta) {
    return periodDate(desde);
  }

  return `${periodDate(desde)} – ${periodDate(hasta)}`;
}

function hourLabel(hour) {
  return new Intl.DateTimeFormat("es-HN", {
    hour: "numeric",
    hour12: true,
  }).format(new Date(2000, 0, 1, Number(hour), 0));
}

function dateTimeLabel(value) {
  return new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function safePdfName(value) {
  const name = String(value || "informe-turno.pdf")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .trim();

  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

function renderKpi(label, value, accent = "") {
  return `
    <div class="kpi ${accent}">
      <span class="kpi-label">${escapeHtml(label)}</span>
      <strong class="kpi-value">${value}</strong>
    </div>
  `;
}

function renderPayments(payments, total) {
  if (!payments.length || total <= 0) {
    return `<p class="empty">No hubo cobros registrados en este periodo.</p>`;
  }

  return payments
    .map((payment) => {
      const share = Number(payment.porcentaje ?? 0);

      return `
        <div class="payment-row">
          <div class="payment-title">
            <strong>${escapeHtml(PAYMENT_LABELS[payment.metodo] ?? payment.metodo)}</strong>
            <span>L ${money(payment.total)}</span>
          </div>

          <div class="track"><i style="width: ${Math.min(share, 100)}%"></i></div>

          <small>${percent(share)} del total · ${payment.operaciones} ${payment.operaciones === 1 ? "operación" : "operaciones"}</small>
        </div>
      `;
    })
    .join("");
}

function renderHourChart(hours) {
  if (!hours.length) {
    return `<p class="empty">No se registraron ventas en ninguna hora de este turno.</p>`;
  }

  const max = Math.max(...hours.map((hour) => Number(hour.total)));

  const bars = hours
    .map((hour) => {
      const heightPct = max > 0 ? (Number(hour.total) / max) * 100 : 0;

      return `
        <div class="bar-col">
          <span class="bar-amount">L ${money(hour.total)}</span>
          <div class="bar-track"><div class="bar-fill" style="height: ${Math.max(heightPct, 4)}%"></div></div>
          <span class="bar-label">${hourLabel(hour.hora)}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="bar-chart">${bars}</div>
    <p class="hint">Solo se registraron ventas en estas horas dentro del turno.</p>
  `;
}

function renderLeaderCard(label, title, value) {
  return `
    <div class="leader-card">
      <span class="leader-label">${escapeHtml(label)}</span>
      <strong class="leader-title">${escapeHtml(title)}</strong>
      <span class="leader-value">${value}</span>
    </div>
  `;
}

function renderCashTable(rows, sign, emptyText) {
  if (!rows.length) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }

  const total = rows.reduce((sum, row) => sum + Number(row.monto), 0);

  const body = rows
    .map(
      (row) => `
        <tr>
          <td>${dateTimeLabel(row.creadoEn)}</td>
          <td>${escapeHtml(row.motivo)}</td>
          <td class="number ${sign === "negative" ? "negative" : "positive"}">${signedMoney(row.monto, sign)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <table class="cash-table">
      <thead>
        <tr><th>Hora</th><th>Motivo</th><th class="number">Monto</th></tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total ${sign === "negative" ? "salidas" : "entradas"}</td>
          <td class="number ${sign === "negative" ? "negative" : "positive"}">${signedMoney(total, sign)}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

function renderPurchasesTable(purchases) {
  if (!purchases.length) {
    return `<p class="empty">No hubo compras a proveedores en este periodo.</p>`;
  }

  const total = purchases.reduce((sum, row) => sum + Number(row.total), 0);

  const body = purchases
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.proveedor)}</td>
          <td>${dateTimeLabel(row.creadoEn)}</td>
          <td class="number">L ${money(row.total)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <table class="cash-table">
      <thead>
        <tr><th>Proveedor</th><th>Hora</th><th class="number">Total</th></tr>
      </thead>
      <tbody>${body}</tbody>
      <tfoot>
        <tr><td colspan="2">Total comprado</td><td class="number">L ${money(total)}</td></tr>
      </tfoot>
    </table>
  `;
}

function renderProductsTable(products) {
  if (!products.length) {
    return `<p class="empty">No hay productos vendidos en este periodo.</p>`;
  }

  const body = products
    .map(
      (product, index) => `
        <tr>
          <td class="rank">${index + 1}</td>
          <td>${escapeHtml(product.nombre)}</td>
          <td class="number">${quantity(product.cantidad)}</td>
          <td class="number">L ${money(product.ventas)}</td>
          <td class="number">L ${money(product.costo)}</td>
          <td class="number ${Number(product.ganancia) < 0 ? "negative" : "positive"}">L ${money(product.ganancia)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <table class="products-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Producto</th>
          <th class="number">Cant.</th>
          <th class="number">Ventas</th>
          <th class="number">Costo</th>
          <th class="number">Ganancia</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function buildConclusion(report) {
  const summary = report?.resumen ?? {};
  const products = report?.productos ?? [];
  const payments = report?.pagos ?? [];
  const leaders = report?.lideres ?? {};

  const operations = Number(summary.operaciones ?? 0);

  if (operations === 0) {
    return "No se registraron ventas durante el periodo seleccionado.";
  }

  const totalUnits = products.reduce(
    (sum, product) => sum + Number(product.cantidad ?? 0),
    0,
  );

  const mainPayment = [...payments].sort(
    (first, second) => Number(second.total) - Number(first.total),
  )[0];

  const revenueLeader = leaders.mayorIngreso?.nombre;
  const quantityLeader = leaders.mayorCantidad?.nombre;
  const profitLeader = leaders.mayorGanancia?.nombre;

  const leaderSentence =
    revenueLeader && revenueLeader === quantityLeader
      ? `${escapeHtml(revenueLeader)} lideró en ingresos y cantidad; `
      : revenueLeader
        ? `${escapeHtml(revenueLeader)} lideró en ingresos${quantityLeader ? ` y ${escapeHtml(quantityLeader)} en cantidad; ` : "; "}`
        : "";

  const profitSentence = profitLeader
    ? `${escapeHtml(profitLeader)} dejó la mayor ganancia. `
    : "";

  return (
    `Se completaron ${operations} ${operations === 1 ? "venta" : "ventas"} ` +
    `por un total de L ${money(summary.total)}, con ${quantity(totalUnits)} unidades vendidas ` +
    `en ${products.length} ${products.length === 1 ? "producto distinto" : "productos distintos"}. ` +
    `El método con mayor participación fue ${escapeHtml(PAYMENT_LABELS[mainPayment?.metodo] ?? "sin información")}. ` +
    leaderSentence +
    profitSentence +
    `Tras entradas y salidas de caja, el efectivo esperado en caja es de L ${money(report?.cierre?.efectivoEsperado)} ` +
    `(las compras a proveedores no se descuentan de caja salvo que se registren como salida).`
  );
}

export function generarInformeTurnoHTML(report) {
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
  const creditos = Array.isArray(report?.creditos) ? report.creditos : [];
  const inventario = Array.isArray(report?.movimientosInventario) ? report.movimientosInventario : [];

  const generatedAt = new Intl.DateTimeFormat("es-HN", {
    timeZone: HONDURAS_TIME_ZONE,
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>Informe de turno</title>

    <style>
      @page {
        size: A4 portrait;
        margin: 13mm 12mm 16mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #1c2b22;
        background: #ffffff;
        font-family: "Segoe UI", Arial, sans-serif;
        font-size: 10px;
        line-height: 1.4;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      h2 {
        margin: 0 0 8px;
        padding-bottom: 4px;
        color: #14532d;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        border-bottom: 2px solid #c9a227;
      }

      section {
        margin-bottom: 14px;
        page-break-inside: avoid;
      }

      .empty,
      .hint {
        margin: 4px 0;
        color: #6b7a70;
        font-style: italic;
      }

      /* Encabezado */
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding-bottom: 10px;
        border-bottom: 3px solid #14532d;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 11px;
      }

      .mark {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        border-radius: 10px;
        color: #ffffff;
        background: #14532d;
        font-size: 22px;
        font-weight: 800;
      }

      .brand h1 {
        margin: 0;
        color: #14532d;
        font-size: 18px;
      }

      .brand p {
        margin: 2px 0 0;
        color: #8a7a3d;
        font-size: 8px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .title {
        text-align: right;
      }

      .title h2 {
        margin: 0;
        padding: 0;
        border: none;
        color: #14532d;
        font-size: 16px;
        text-transform: none;
        letter-spacing: normal;
      }

      .title p {
        margin: 3px 0 0;
        color: #6b7a70;
      }

      .meta {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        margin: 9px 0 12px;
        border-radius: 7px;
        padding: 8px 10px;
        color: #55564a;
        background: #faf6e7;
        border: 1px solid #e7dcaa;
      }

      .meta strong {
        color: #14532d;
      }

      /* KPIs */
      .kpis {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 7px;
      }

      .kpi {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 9px 10px;
        border-radius: 7px;
        border: 1px solid #d8e3d9;
        border-top: 3px solid #14532d;
        background: #f5f9f5;
      }

      .kpi.gold {
        border-top-color: #c9a227;
        background: #fbf6e8;
      }

      .kpi-label {
        color: #6b7a70;
        font-size: 8px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .kpi-value {
        color: #14532d;
        font-size: 15px;
      }

      .kpi.gold .kpi-value {
        color: #8a6d00;
      }

      /* Distribución de cobros */
      .payment-row {
        margin-bottom: 8px;
      }

      .payment-title {
        display: flex;
        justify-content: space-between;
        margin-bottom: 3px;
      }

      .track {
        height: 6px;
        border-radius: 4px;
        overflow: hidden;
        background: #e7ece7;
      }

      .track i {
        display: block;
        height: 100%;
        background: #14532d;
      }

      .payment-row small {
        color: #6b7a70;
      }

      /* Cierre */
      .close-grid {
        display: grid;
        gap: 6px;
      }

      .close-row {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px dashed #d8e3d9;
      }

      .close-row.total {
        margin-top: 2px;
        padding-top: 8px;
        border-top: 2px solid #14532d;
        border-bottom: none;
        font-size: 12px;
        font-weight: 700;
        color: #14532d;
      }

      .close-row .negative {
        color: #9a3412;
      }

      .close-row .positive {
        color: #14532d;
      }

      /* Actividad por hora */
      .bar-chart {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        height: 90px;
        padding-top: 14px;
      }

      .bar-col {
        display: flex;
        flex: 1;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        height: 100%;
      }

      .bar-amount {
        font-size: 7px;
        color: #55564a;
        white-space: nowrap;
      }

      .bar-track {
        display: flex;
        align-items: flex-end;
        flex: 1;
        width: 100%;
      }

      .bar-fill {
        width: 100%;
        border-radius: 3px 3px 0 0;
        background: linear-gradient(180deg, #c9a227, #14532d);
      }

      .bar-label {
        font-size: 7px;
        color: #6b7a70;
      }

      /* Líderes */
      .leaders {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 7px;
      }

      .leader-card {
        display: flex;
        flex-direction: column;
        gap: 3px;
        padding: 8px 9px;
        border-radius: 7px;
        border: 1px solid #e7dcaa;
        background: #fbf6e8;
      }

      .leader-label {
        color: #8a7a3d;
        font-size: 7px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .leader-title {
        color: #1c2b22;
        font-size: 9.5px;
      }

      .leader-value {
        color: #8a6d00;
        font-weight: 700;
      }

      /* Tablas */
      table {
        width: 100%;
        border-collapse: collapse;
      }

      .cash-table,
      .products-table {
        margin-bottom: 6px;
      }

      th,
      td {
        padding: 4px 5px;
        text-align: left;
        border-bottom: 1px solid #e7ece7;
      }

      th {
        color: #6b7a70;
        font-size: 8px;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      td.number,
      th.number {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      td.rank {
        color: #6b7a70;
        width: 18px;
      }

      .positive {
        color: #14532d;
      }

      .negative {
        color: #9a3412;
      }

      tfoot td {
        border-bottom: none;
        border-top: 2px solid #14532d;
        font-weight: 700;
      }

      .cash-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      /* Resumen del turno */
      .conclusion {
        padding: 10px 12px;
        border-radius: 7px;
        border: 1px solid #d8e3d9;
        background: #f5f9f5;
      }

      .footnote {
        margin-top: 8px;
        color: #8a8a7a;
        font-size: 8px;
      }
    </style>
  </head>

  <body>
    <div class="header">
      <div class="brand">
        <span class="mark">M</span>
        <div>
          <h1>Minimarket 24/7</h1>
          <p>Sistema de punto de venta · Informe de turno</p>
        </div>
      </div>

      <div class="title">
        <h2>${escapeHtml(periodo.turnoEtiqueta ?? "Informe de turno")}</h2>
        <p>Generado: ${escapeHtml(generatedAt)}</p>
      </div>
    </div>

    <div class="meta">
      <span>Periodo: <strong>${periodLabel(periodo.desde, periodo.hasta)}</strong></span>
    </div>

    <section>
      <h2>Resumen financiero</h2>
      <div class="kpis">
        ${renderKpi("Total vendido", `L ${money(summary.total)}`, "gold")}
        ${renderKpi("Efectivo esperado", `L ${money(summary.efectivoEsperado)}`)}
        ${renderKpi("Ventas realizadas", summary.operaciones ?? 0)}
        ${renderKpi("Costo estimado", `L ${money(summary.costoEstimado)}`)}
        ${renderKpi("Ganancia estimada", `L ${money(summary.gananciaEstimada)}`, "gold")}
        ${renderKpi("Margen estimado", percent(summary.margenEstimado))}
      </div>
    </section>

    <section>
      <h2>Distribución de cobros</h2>
      ${renderPayments(payments, Number(summary.total ?? 0))}
    </section>

    <section>
      <h2>Cierre</h2>
      <div class="close-grid">
        <div class="close-row"><span>Efectivo por ventas</span><span>L ${money(cierre.efectivoVentas)}</span></div>
        <div class="close-row"><span>+ Entradas de caja</span><span class="positive">+ L ${money(cierre.entradas)}</span></div>
        <div class="close-row"><span>− Salidas de caja</span><span class="negative">− L ${money(cierre.salidas)}</span></div>
        <div class="close-row total"><span>Efectivo esperado</span><span>L ${money(cierre.efectivoEsperado)}</span></div>
      </div>
    </section>

    <section>
      <h2>Actividad por hora</h2>
      ${renderHourChart(hours)}
    </section>

    <section>
      <h2>Líderes del turno</h2>
      <div class="leaders">
        ${renderLeaderCard("Líder por ingresos", leaders.mayorIngreso?.nombre ?? "Sin datos", leaders.mayorIngreso ? `L ${money(leaders.mayorIngreso.ventas)}` : "—")}
        ${renderLeaderCard("Mayor cantidad", leaders.mayorCantidad?.nombre ?? "Sin datos", leaders.mayorCantidad ? `${quantity(leaders.mayorCantidad.cantidad)} unidades` : "—")}
        ${renderLeaderCard("Mayor ganancia", leaders.mayorGanancia?.nombre ?? "Sin datos", leaders.mayorGanancia ? `L ${money(leaders.mayorGanancia.ganancia)}` : "—")}
        ${renderLeaderCard("Hora con más ventas", leaders.horaConMasVentas ? hourLabel(leaders.horaConMasVentas.hora) : "Sin datos", leaders.horaConMasVentas ? `L ${money(leaders.horaConMasVentas.total)}` : "—")}
      </div>
    </section>

    <section>
      <h2>Desglose de movimientos</h2>
      <div class="cash-grid">
        <div>
          <p class="hint" style="margin-top:0">Entradas de caja</p>
          ${renderCashTable(entradas, "positive", "No hubo entradas de caja en este periodo.")}
        </div>
        <div>
          <p class="hint" style="margin-top:0">Salidas de caja</p>
          ${renderCashTable(salidas, "negative", "No hubo salidas de caja en este periodo.")}
        </div>
      </div>

      <p class="hint">Compras a proveedores</p>
      ${renderPurchasesTable(compras)}

      <p class="hint">Créditos (fiar)</p>
      ${creditos.length ? "" : `<p class="empty">Sin conectar todavía a datos reales.</p>`}

      <p class="hint">Movimientos de inventario</p>
      ${inventario.length ? "" : `<p class="empty">Sin conectar todavía a datos reales.</p>`}
    </section>

    <section>
      <h2>Todas las ventas · agrupadas por producto</h2>
      ${renderProductsTable(products)}
    </section>

    <section>
      <h2>Resumen del turno</h2>
      <p class="conclusion">${buildConclusion(report)}</p>
      <p class="footnote">La ganancia es una estimación basada en los costos registrados. Créditos (fiar) e inventario aún no están conectados a datos reales.</p>
    </section>
  </body>
</html>
  `;
}