const PAYMENT_LABELS = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

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

function hourLabel(hour) {
  return new Intl.DateTimeFormat("es-HN", {
    hour: "numeric",
  }).format(
    new Date(2000, 0, 1, Number(hour), 0),
  );
}

export function buildAdministrativeReportHtml(
  report,
) {
  const summary = report?.resumen ?? {};

  const products = Array.isArray(
    report?.productos,
  )
    ? report.productos
    : [];

  const payments = Array.isArray(
    report?.pagos,
  )
    ? report.pagos
    : [];

  const hours = Array.isArray(report?.horas)
    ? report.horas
    : [];

  const sales = Array.isArray(report?.ventas)
    ? report.ventas
    : [];

  const total = Number(summary.total ?? 0);

  const profit = Number(
    summary.gananciaEstimada ?? 0,
  );

  const margin =
    total > 0 ? (profit / total) * 100 : 0;

  const totalUnits = products.reduce(
    (sum, product) =>
      sum + Number(product.cantidad ?? 0),
    0,
  );

  const byQuantity = [...products].sort(
    (first, second) =>
      Number(second.cantidad) -
      Number(first.cantidad),
  );

  const peakHour =
    [...hours].sort(
      (first, second) =>
        Number(second.total) -
        Number(first.total),
    )[0] ?? null;

  const mainPayment =
    [...payments].sort(
      (first, second) =>
        Number(second.total) -
        Number(first.total),
    )[0] ?? null;

  const generatedAt =
    new Intl.DateTimeFormat("es-HN", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date());

  const paymentRows = payments
    .map((payment) => {
      const share =
        total > 0
          ? Math.round(
              (Number(payment.total) /
                total) *
                100,
            )
          : 0;

      return `
        <div class="payment-row">
          <div class="payment-title">
            <strong>
              ${escapeHtml(
                PAYMENT_LABELS[
                  payment.metodo
                ] ?? payment.metodo,
              )}
            </strong>

            <span>
              L ${money(payment.total)}
            </span>
          </div>

          <div class="track">
            <i style="width: ${share}%"></i>
          </div>

          <small>
            ${share}% del total ·
            ${escapeHtml(
              payment.operaciones,
            )} operaciones
          </small>
        </div>
      `;
    })
    .join("");

  const shifts = [
    {
      id: 1,
      name: "Turno 1",
      schedule: "8 a. m. – 10 p. m.",
      operations: 0,
      total: 0,
    },
    {
      id: 2,
      name: "Turno 2",
      schedule: "10 p. m. – 2 a. m.",
      operations: 0,
      total: 0,
    },
    {
      id: 3,
      name: "Turno 3",
      schedule: "2 a. m. – 8 a. m.",
      operations: 0,
      total: 0,
    },
  ];

  for (const sale of sales) {
    const hour = new Date(
      sale.creadoEn,
    ).getHours();

    const shiftId =
      hour >= 8 && hour < 22
        ? 1
        : hour >= 22 || hour < 2
          ? 2
          : 3;

    const shift = shifts.find(
      (item) => item.id === shiftId,
    );

    shift.operations += 1;
    shift.total += Number(sale.total);
  }

  const shiftRows = shifts
    .map(
      (shift) => `
        <tr>
          <td>
            <strong>${shift.name}</strong>
            <small>${shift.schedule}</small>
          </td>

          <td class="number">
            ${shift.operations}
          </td>

          <td class="number strong">
            L ${money(shift.total)}
          </td>
        </tr>
      `,
    )
    .join("");

  const productRows = products.length
    ? products
        .slice(0, 5)
        .map(
          (product, index) => `
            <tr>
              <td class="rank">
                ${index + 1}
              </td>

              <td>
                ${escapeHtml(product.nombre)}
              </td>

              <td class="number">
                ${quantity(product.cantidad)}
              </td>

              <td class="number">
                L ${money(product.ventas)}
              </td>

              <td class="number positive">
                L ${money(product.ganancia)}
              </td>
            </tr>
          `,
        )
        .join("")
    : `
        <tr>
          <td class="empty" colspan="5">
            No hay productos vendidos en este
            periodo.
          </td>
        </tr>
      `;

  const conclusion = sales.length
    ? `Se completaron ${sales.length} ventas ` +
      `por un total de L ${money(total)}. ` +
      `El método con mayor participación fue ` +
      `${
        PAYMENT_LABELS[
          mainPayment?.metodo
        ] ?? "sin información"
      }. ` +
      `El producto líder por ingresos fue ` +
      `${
        products[0]?.nombre ??
        "sin información"
      } y el de mayor cantidad vendida fue ` +
      `${
        byQuantity[0]?.nombre ??
        "sin información"
      }.`
    : "No se registraron ventas durante el periodo seleccionado.";

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />

    <title>Reporte administrativo</title>

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
        color: #172033;
        background: #ffffff;
        font-family:
          "Segoe UI",
          Arial,
          sans-serif;
        font-size: 10px;
        line-height: 1.35;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        border-bottom: 3px solid #0f766e;
        padding-bottom: 11px;
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
        background: #0f766e;
        font-size: 22px;
        font-weight: 800;
      }

      h1 {
        margin: 0;
        color: #0f172a;
        font-size: 19px;
      }

      .brand p {
        margin: 2px 0 0;
        color: #64748b;
        font-size: 8px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .title {
        text-align: right;
      }

      .title h2 {
        margin: 0;
        color: #0f172a;
        font-size: 16px;
      }

      .title p {
        margin: 3px 0 0;
        color: #64748b;
      }

      .meta {
        display: flex;
        justify-content: space-between;
        gap: 15px;
        margin: 9px 0 11px;
        border-radius: 7px;
        padding: 8px 10px;
        color: #475569;
        background: #f1f5f9;
      }

      .meta strong {
        color: #0f172a;
      }

      .kpis {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 7px;
        margin-bottom: 10px;
      }

      .kpi {
        min-height: 58px;
        border: 1px solid #d8e2e8;
        border-top: 3px solid #0f766e;
        border-radius: 7px;
        padding: 8px 10px;
      }

      .kpi.featured {
        border-color: #0f766e;
        color: #ffffff;
        background: #0f766e;
      }

      .kpi span {
        display: block;
        margin-bottom: 5px;
        color: #64748b;
        font-size: 7px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .kpi strong {
        color: #0f172a;
        font-size: 14px;
      }

      .kpi.featured span,
      .kpi.featured strong {
        color: #ffffff;
      }

      .result {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 10px;
        border: 1px solid #b7e4d8;
        border-radius: 7px;
        padding: 9px 11px;
        background: #f0fdfa;
      }

      .result div {
        display: grid;
        gap: 3px;
      }

      .result span {
        color: #56736c;
        font-size: 7px;
        font-weight: 700;
        text-transform: uppercase;
      }

      .result strong {
        color: #075e54;
        font-size: 12px;
      }

      .section-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 9px;
        margin-bottom: 10px;
      }

      .panel {
        break-inside: avoid;
        border: 1px solid #d8e2e8;
        border-radius: 7px;
        padding: 10px;
      }

      .panel h3,
      .section h3 {
        margin: 0 0 8px;
        color: #0f172a;
        font-size: 11px;
      }

      .payments {
        display: grid;
        gap: 8px;
      }

      .payment-title {
        display: flex;
        justify-content: space-between;
        gap: 10px;
      }

      .payment-title strong,
      .payment-title span {
        font-size: 8px;
      }

      .track {
        overflow: hidden;
        height: 6px;
        margin: 3px 0;
        border-radius: 999px;
        background: #e2e8f0;
      }

      .track i {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: #14b8a6;
      }

      .payment-row small {
        color: #64748b;
        font-size: 7px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      th {
        padding: 5px 6px;
        color: #475569;
        background: #eef3f6;
        font-size: 7px;
        letter-spacing: 0.04em;
        text-align: left;
        text-transform: uppercase;
      }

      td {
        border-bottom: 1px solid #e7edf1;
        padding: 6px;
        color: #334155;
        font-size: 8px;
      }

      td small {
        display: block;
        margin-top: 2px;
        color: #64748b;
        font-size: 6px;
      }

      .number {
        text-align: right;
        white-space: nowrap;
      }

      .strong {
        color: #0f172a;
        font-weight: 700;
      }

      .positive {
        color: #087f5b;
        font-weight: 700;
      }

      .rank {
        width: 22px;
        color: #0f766e;
        font-weight: 800;
        text-align: center;
      }

      .section {
        margin-bottom: 10px;
      }

      .empty {
        padding: 12px;
        color: #64748b;
        text-align: center;
      }

      .conclusion {
        border-left: 3px solid #0f766e;
        border-radius: 0 6px 6px 0;
        padding: 8px 10px;
        color: #334155;
        background: #f8fafc;
      }

      .conclusion strong {
        display: block;
        margin-bottom: 3px;
        color: #0f172a;
        font-size: 9px;
      }

      .conclusion p {
        margin: 0;
        font-size: 8px;
      }

      .note {
        margin: 8px 0 0;
        color: #64748b;
        font-size: 7px;
      }
    </style>
  </head>

  <body>
    <header class="header">
      <div class="brand">
        <div class="mark">M</div>

        <div>
          <h1>Minimarket 24/7</h1>

          <p>
            Sistema de punto de venta
          </p>
        </div>
      </div>

      <div class="title">
        <h2>Reporte administrativo</h2>

        <p>
          Resumen general del negocio
        </p>
      </div>
    </header>

    <section class="meta">
      <span>
        <strong>Periodo:</strong>

        ${periodDate(
          report?.periodo?.desde,
        )}

        al

        ${periodDate(
          report?.periodo?.hasta,
        )}
      </span>

      <span>
        <strong>Generado:</strong>

        ${escapeHtml(generatedAt)}
      </span>
    </section>

    <section class="kpis">
      <article class="kpi featured">
        <span>Total vendido</span>

        <strong>
          L ${money(summary.total)}
        </strong>
      </article>

      <article class="kpi">
        <span>Ventas realizadas</span>

        <strong>
          ${escapeHtml(
            summary.operaciones ?? 0,
          )}
        </strong>
      </article>

      <article class="kpi">
        <span>Promedio por venta</span>

        <strong>
          L ${money(summary.promedio)}
        </strong>
      </article>
    </section>

    <section class="result">
      <div>
        <span>Costo estimado</span>

        <strong>
          L ${money(
            summary.costoEstimado,
          )}
        </strong>
      </div>

      <div>
        <span>Ganancia estimada</span>

        <strong>
          L ${money(
            summary.gananciaEstimada,
          )}
        </strong>
      </div>

      <div>
        <span>Margen estimado</span>

        <strong>
          ${money(margin)}%
        </strong>
      </div>
    </section>

    <section class="section-grid">
      <article class="panel">
        <h3>Distribución de cobros</h3>

        <div class="payments">
          ${paymentRows}
        </div>
      </article>

      <article class="panel">
        <h3>Resumen por turno</h3>

        <table>
          <thead>
            <tr>
              <th>Turno</th>

              <th class="number">
                Ventas
              </th>

              <th class="number">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            ${shiftRows}
          </tbody>
        </table>
      </article>
    </section>

    <section class="section">
      <h3>
        Productos principales por ingresos
      </h3>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Producto</th>

            <th class="number">
              Cantidad
            </th>

            <th class="number">
              Ventas
            </th>

            <th class="number">
              Ganancia
            </th>
          </tr>
        </thead>

        <tbody>
          ${productRows}
        </tbody>
      </table>
    </section>

    <section class="conclusion">
      <strong>Resumen del periodo</strong>

      <p>
        ${escapeHtml(conclusion)}
      </p>
    </section>

    <p class="note">
      Unidades vendidas:
      ${quantity(totalUnits)} ·
      Hora con mayor venta:
      ${
        peakHour
          ? `${escapeHtml(
              hourLabel(peakHour.hora),
            )} con L ${money(
              peakHour.total,
            )}`
          : "sin información"
      }.
      La ganancia mostrada es una estimación
      basada en los costos registrados.
    </p>
  </body>
</html>
  `;
}