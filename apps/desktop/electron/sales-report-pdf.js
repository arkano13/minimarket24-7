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

function formatPeriodDate(value) {
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

function dateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function hourLabel(hour) {
  const date = new Date(
    2000,
    0,
    1,
    Number(hour),
    0,
  );

  return new Intl.DateTimeFormat("es-HN", {
    hour: "numeric",
  }).format(date);
}

function emptyRow(columns, message) {
  return `
    <tr>
      <td class="empty" colspan="${columns}">
        ${escapeHtml(message)}
      </td>
    </tr>
  `;
}

export function safePdfName(value) {
  const name = String(
    value || "reporte-ventas.pdf",
  )
    .replace(
      /[<>:"/\\|?*\u0000-\u001F]/g,
      "-",
    )
    .trim();

  return name.toLowerCase().endsWith(".pdf")
    ? name
    : `${name}.pdf`;
}

export function buildSalesReportHtml(report) {
  const summary = report?.resumen ?? {};

  const payments = Array.isArray(report?.pagos)
    ? report.pagos
    : [];

  const products = Array.isArray(
    report?.productos,
  )
    ? report.productos
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

  const productsByQuantity = [
    ...products,
  ].sort(
    (first, second) =>
      Number(second.cantidad) -
      Number(first.cantidad),
  );

  const productsBySales = [...products].sort(
    (first, second) =>
      Number(second.ventas) -
      Number(first.ventas),
  );

  const productsByProfit = [...products].sort(
    (first, second) =>
      Number(second.ganancia) -
      Number(first.ganancia),
  );

  const topQuantity =
    productsByQuantity[0] ?? null;

  const topSales =
    productsBySales[0] ?? null;

  const topProfit =
    productsByProfit[0] ?? null;

  const peakHour =
    [...hours].sort(
      (first, second) =>
        Number(second.total) -
        Number(first.total),
    )[0] ?? null;

  const maximumHour = Math.max(
    1,
    ...hours.map((item) =>
      Number(item.total ?? 0),
    ),
  );

  const generatedAt =
    new Intl.DateTimeFormat("es-HN", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date());

  const paymentRows = payments.length
    ? payments
        .map(
          (payment) => `
            <tr>
              <td>
                ${escapeHtml(
                  PAYMENT_LABELS[
                    payment.metodo
                  ] ?? payment.metodo,
                )}
              </td>

              <td class="number">
                ${escapeHtml(
                  payment.operaciones,
                )}
              </td>

              <td class="number strong">
                L ${money(payment.total)}
              </td>
            </tr>
          `,
        )
        .join("")
    : emptyRow(
        3,
        "No hay pagos registrados en el periodo.",
      );

  const productRows = products.length
    ? products
        .map(
          (product, index) => `
            <tr>
              <td class="position">
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

              <td class="number">
                L ${money(product.costo)}
              </td>

              <td class="number strong positive">
                L ${money(product.ganancia)}
              </td>
            </tr>
          `,
        )
        .join("")
    : emptyRow(
        6,
        "No hay productos vendidos en el periodo.",
      );

  const quantityRankingRows =
    productsByQuantity.length
      ? productsByQuantity
          .slice(0, 5)
          .map(
            (product, index) => `
              <tr>
                <td class="position">
                  ${index + 1}
                </td>

                <td>
                  ${escapeHtml(
                    product.nombre,
                  )}
                </td>

                <td class="number strong">
                  ${quantity(
                    product.cantidad,
                  )}
                </td>

                <td class="number">
                  L ${money(product.ventas)}
                </td>
              </tr>
            `,
          )
          .join("")
      : emptyRow(
          4,
          "No hay productos para clasificar.",
        );

  const salesRankingRows =
    productsBySales.length
      ? productsBySales
          .slice(0, 5)
          .map(
            (product, index) => `
              <tr>
                <td class="position">
                  ${index + 1}
                </td>

                <td>
                  ${escapeHtml(
                    product.nombre,
                  )}
                </td>

                <td class="number strong">
                  L ${money(product.ventas)}
                </td>

                <td class="number positive">
                  L ${money(
                    product.ganancia,
                  )}
                </td>
              </tr>
            `,
          )
          .join("")
      : emptyRow(
          4,
          "No hay productos para clasificar.",
        );

  const hourRows = hours.length
    ? hours
        .map((hour) => {
          const barPercentage = Math.max(
            3,
            Math.round(
              (Number(hour.total ?? 0) /
                maximumHour) *
                100,
            ),
          );

          return `
            <div class="hour-row">
              <span>
                ${escapeHtml(
                  hourLabel(hour.hora),
                )}
              </span>

              <div class="bar-track">
                <i
                  style="width: ${barPercentage}%"
                ></i>
              </div>

              <strong>
                L ${money(hour.total)}
              </strong>
            </div>
          `;
        })
        .join("")
    : `
        <p class="empty-block">
          No hay ventas por hora en el periodo.
        </p>
      `;

  const saleRows = sales.length
    ? sales
        .map(
          (sale) => `
            <tr>
              <td class="folio">
                #${escapeHtml(sale.id)}
              </td>

              <td>
                ${escapeHtml(
                  dateTime(sale.creadoEn),
                )}
              </td>

              <td>
                ${escapeHtml(
                  sale.cliente ||
                    "Venta normal",
                )}
              </td>

              <td>
                ${escapeHtml(
                  sale.usuario?.nombre || "—",
                )}
              </td>

              <td>
                ${escapeHtml(
                  PAYMENT_LABELS[
                    sale.pago?.metodo
                  ] ?? "Sin pago",
                )}
              </td>

              <td class="number strong">
                L ${money(sale.total)}
              </td>
            </tr>
          `,
        )
        .join("")
    : emptyRow(
        6,
        "No hay ventas registradas en el periodo.",
      );

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />

    <title>Reporte de ventas</title>

    <style>
      @page {
        size: A4 landscape;
        margin: 12mm 11mm 16mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
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

      .report {
        width: 100%;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        border-bottom: 3px solid #0f766e;
        padding-bottom: 12px;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .mark {
        display: grid;
        place-items: center;
        width: 44px;
        height: 44px;
        border-radius: 10px;
        color: #ffffff;
        background: #0f766e;
        font-size: 23px;
        font-weight: 800;
      }

      .brand h1 {
        margin: 0;
        color: #0f172a;
        font-size: 20px;
      }

      .brand p {
        margin: 2px 0 0;
        color: #64748b;
        font-size: 9px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .document-title {
        text-align: right;
      }

      .document-title h2 {
        margin: 0;
        color: #0f172a;
        font-size: 18px;
      }

      .document-title p {
        margin: 3px 0 0;
        color: #475569;
      }

      .metadata {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        margin: 10px 0 12px;
        border: 1px solid #dbe4ea;
        border-radius: 7px;
        padding: 8px 11px;
        color: #475569;
        background: #f8fafc;
      }

      .metadata strong {
        color: #0f172a;
      }

      .kpis {
        display: grid;
        grid-template-columns:
          repeat(6, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 13px;
      }

      .kpi {
        min-height: 62px;
        border: 1px solid #d8e2e8;
        border-top: 3px solid #0f766e;
        border-radius: 7px;
        padding: 9px 11px;
        background: #ffffff;
      }

      .kpi span {
        display: block;
        margin-bottom: 6px;
        color: #64748b;
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .kpi strong {
        color: #0f172a;
        font-size: 15px;
      }

      .kpi.featured {
        border-color: #0f766e;
        color: #ffffff;
        background: #0f766e;
      }

      .kpi.featured span,
      .kpi.featured strong {
        color: #ffffff;
      }

      .insights {
        display: grid;
        grid-template-columns:
          repeat(4, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 13px;
      }

      .insight {
        break-inside: avoid;
        border: 1px solid #d8e2e8;
        border-left: 3px solid #14b8a6;
        border-radius: 7px;
        padding: 9px 10px;
        background: #f8fafc;
      }

      .insight span {
        display: block;
        margin-bottom: 5px;
        color: #64748b;
        font-size: 7px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .insight strong {
        display: block;
        overflow: hidden;
        color: #0f172a;
        font-size: 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .insight small {
        display: block;
        margin-top: 3px;
        color: #0f766e;
        font-size: 8px;
        font-weight: 700;
      }

      .ranking-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 13px;
      }

      .two-column {
        display: grid;
        grid-template-columns:
          0.78fr 1.22fr;
        gap: 10px;
        margin-bottom: 13px;
      }

      .panel {
        break-inside: avoid;
        border: 1px solid #d8e2e8;
        border-radius: 7px;
        padding: 10px 11px;
        background: #ffffff;
      }

      .section {
        margin-top: 13px;
      }

      .section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin: 0 0 7px;
      }

      .section-title h3 {
        margin: 0;
        color: #0f172a;
        font-size: 12px;
      }

      .section-title span {
        color: #64748b;
        font-size: 8px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
      }

      thead {
        display: table-header-group;
      }

      tr {
        break-inside: avoid;
      }

      th {
        border-bottom: 1px solid #cbd5e1;
        padding: 6px 7px;
        color: #334155;
        background: #eef3f6;
        font-size: 7.5px;
        letter-spacing: 0.05em;
        text-align: left;
        text-transform: uppercase;
      }

      td {
        border-bottom: 1px solid #e8edf1;
        padding: 6px 7px;
        color: #334155;
      }

      tbody tr:nth-child(even) {
        background: #fafcfd;
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
      }

      .position {
        width: 28px;
        color: #64748b;
        text-align: center;
      }

      .folio {
        color: #0f766e;
        font-weight: 700;
      }

      .empty {
        padding: 14px;
        color: #64748b;
        text-align: center;
      }

      .empty-block {
        margin: 13px 0;
        color: #64748b;
        text-align: center;
      }

      .hour-list {
        display: grid;
        gap: 6px;
      }

      .hour-row {
        display: grid;
        grid-template-columns:
          54px 1fr 78px;
        align-items: center;
        gap: 8px;
      }

      .hour-row > span {
        color: #475569;
        font-size: 8px;
        font-weight: 600;
      }

      .hour-row > strong {
        color: #0f172a;
        font-size: 8px;
        text-align: right;
      }

      .bar-track {
        overflow: hidden;
        height: 7px;
        border-radius: 999px;
        background: #e2e8f0;
      }

      .bar-track i {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: #14b8a6;
      }

      .note {
        margin: 12px 0 0;
        border-left: 3px solid #94a3b8;
        padding: 6px 9px;
        color: #64748b;
        background: #f8fafc;
        font-size: 8px;
      }
    </style>
  </head>

  <body>
    <main class="report">
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

        <div class="document-title">
          <h2>
            Reporte ejecutivo de ventas
          </h2>

          <p>
            Resumen financiero y operativo
          </p>
        </div>
      </header>

      <section class="metadata">
        <span>
          <strong>Periodo:</strong>

          ${formatPeriodDate(
            report?.periodo?.desde,
          )}

          al

          ${formatPeriodDate(
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
          <span>Costo estimado</span>

          <strong>
            L ${money(
              summary.costoEstimado,
            )}
          </strong>
        </article>

        <article class="kpi">
          <span>Ganancia estimada</span>

          <strong>
            L ${money(
              summary.gananciaEstimada,
            )}
          </strong>
        </article>

        <article class="kpi">
          <span>Margen estimado</span>

          <strong>
            ${money(margin)}%
          </strong>
        </article>

        <article class="kpi">
          <span>Unidades vendidas</span>

          <strong>
            ${quantity(totalUnits)}
          </strong>
        </article>
      </section>

      <section class="insights">
        <article class="insight">
          <span>Líder por ingresos</span>

          <strong>
            ${escapeHtml(
              topSales?.nombre ||
                "Sin información",
            )}
          </strong>

          <small>
            ${
              topSales
                ? `L ${money(
                    topSales.ventas,
                  )} vendidos`
                : "Sin ventas"
            }
          </small>
        </article>

        <article class="insight">
          <span>
            Mayor cantidad vendida
          </span>

          <strong>
            ${escapeHtml(
              topQuantity?.nombre ||
                "Sin información",
            )}
          </strong>

          <small>
            ${
              topQuantity
                ? `${quantity(
                    topQuantity.cantidad,
                  )} unidades`
                : "Sin ventas"
            }
          </small>
        </article>

        <article class="insight">
          <span>
            Mayor ganancia estimada
          </span>

          <strong>
            ${escapeHtml(
              topProfit?.nombre ||
                "Sin información",
            )}
          </strong>

          <small>
            ${
              topProfit
                ? `L ${money(
                    topProfit.ganancia,
                  )} de ganancia`
                : "Sin ventas"
            }
          </small>
        </article>

        <article class="insight">
          <span>Hora con más ventas</span>

          <strong>
            ${
              peakHour
                ? escapeHtml(
                    hourLabel(peakHour.hora),
                  )
                : "Sin información"
            }
          </strong>

          <small>
            ${
              peakHour
                ? `L ${money(
                    peakHour.total,
                  )} vendidos`
                : "Sin ventas"
            }
          </small>
        </article>
      </section>

      <section class="ranking-grid">
        <article class="panel">
          <div class="section-title">
            <h3>
              Top 5 por cantidad vendida
            </h3>

            <span>Unidades</span>
          </div>

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
              </tr>
            </thead>

            <tbody>
              ${quantityRankingRows}
            </tbody>
          </table>
        </article>

        <article class="panel">
          <div class="section-title">
            <h3>
              Top 5 por dinero vendido
            </h3>

            <span>Ingresos</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Producto</th>

                <th class="number">
                  Ventas
                </th>

                <th class="number">
                  Ganancia
                </th>
              </tr>
            </thead>

            <tbody>
              ${salesRankingRows}
            </tbody>
          </table>
        </article>
      </section>

      <section class="two-column">
        <article class="panel">
          <div class="section-title">
            <h3>
              Distribución por método de pago
            </h3>

            <span>
              Valores del periodo
            </span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Método</th>

                <th class="number">
                  Operaciones
                </th>

                <th class="number">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              ${paymentRows}
            </tbody>
          </table>
        </article>

        <article class="panel">
          <div class="section-title">
            <h3>
              Comportamiento por hora
            </h3>

            <span>Total vendido</span>
          </div>

          <div class="hour-list">
            ${hourRows}
          </div>
        </article>
      </section>

      <section class="section">
        <div class="section-title">
          <h3>
            Rendimiento completo de productos
          </h3>

          <span>
            Ordenado por valor vendido
          </span>
        </div>

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
                Costo
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
      <p class="note">
        La ganancia es una estimación calculada
        como ventas menos el costo registrado de
        los productos. Este documento es un
        reporte administrativo interno y no
        constituye una factura fiscal.
      </p>
    </main>
  </body>
</html>
  `;
}