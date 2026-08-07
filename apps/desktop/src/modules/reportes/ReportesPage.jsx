import { useEffect, useMemo, useState } from "react";
import "./ReportesPage.css";
import { cancelSale, getSalesReport } from "../../services/api.js";

const PAYMENT_LABELS = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

function dateText(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function dateTime(value) {
  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function hourLabel(hour) {
  return new Intl.DateTimeFormat("es-HN", {
    hour: "numeric",
  }).format(new Date(2000, 0, 1, Number(hour), 0));
}

function percentage(value, total) {
  const numericTotal = Number(total ?? 0);

  if (numericTotal <= 0) {
    return 0;
  }

  return Math.round((Number(value ?? 0) / numericTotal) * 100);
}

function periodLabel(from, to) {
  const formatter = new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  function parse(value) {
    const [year, month, day] = value.split("-").map(Number);

    return new Date(year, month - 1, day);
  }

  if (from === to) {
    return formatter.format(parse(from));
  }

  return `${formatter.format(parse(from))} — ` + `${formatter.format(parse(to))}`;
}

function ExecutiveView({ report, maximumHourlyTotal }) {
  const productsByQuantity = [...report.productos].sort(
    (first, second) => Number(second.cantidad) - Number(first.cantidad),
  );

  const productsByProfit = [...report.productos].sort(
    (first, second) => Number(second.ganancia) - Number(first.ganancia),
  );

  const peakHour =
    [...report.horas].sort((first, second) => Number(second.total) - Number(first.total))[0] ??
    null;

  const topSales = report.productos[0] ?? null;
  const topQuantity = productsByQuantity[0] ?? null;
  const topProfit = productsByProfit[0] ?? null;

  return (
    <div className="reports-view-content">
      <section aria-label="Resumen financiero" className="reports-kpi-grid">
        <article className="reports-kpi reports-kpi--primary">
          <span>Total vendido</span>
          <strong>L {money(report.resumen.total)}</strong>
          <small>Ingresos del periodo</small>
        </article>

        <article className="reports-kpi reports-kpi--blue">
          <span>Ventas realizadas</span>
          <strong>{report.resumen.operaciones}</strong>
          <small>Operaciones completadas</small>
        </article>

        <article className="reports-kpi reports-kpi--green">
          <span>Ganancia estimada</span>
          <strong>L {money(report.resumen.gananciaEstimada)}</strong>
          <small>Costo: L {money(report.resumen.costoEstimado)}</small>
        </article>

        <article className="reports-kpi reports-kpi--violet">
          <span>Promedio por venta</span>
          <strong>L {money(report.resumen.promedio)}</strong>
          <small>Valor promedio por operación</small>
        </article>
      </section>

      <section className="reports-executive-highlights">
        <article>
          <span>Líder por ingresos</span>
          <strong>{topSales?.nombre ?? "Sin información"}</strong>
          <small>{topSales ? `L ${money(topSales.ventas)} vendidos` : "Sin ventas"}</small>
        </article>

        <article>
          <span>Mayor cantidad vendida</span>
          <strong>{topQuantity?.nombre ?? "Sin información"}</strong>
          <small>
            {topQuantity ? `${quantity(topQuantity.cantidad)} unidades` : "Sin ventas"}
          </small>
        </article>

        <article>
          <span>Mayor ganancia</span>
          <strong>{topProfit?.nombre ?? "Sin información"}</strong>
          <small>{topProfit ? `L ${money(topProfit.ganancia)} estimados` : "Sin ventas"}</small>
        </article>

        <article>
          <span>Hora con más ventas</span>
          <strong>{peakHour ? hourLabel(peakHour.hora) : "Sin información"}</strong>
          <small>{peakHour ? `L ${money(peakHour.total)} vendidos` : "Sin ventas"}</small>
        </article>
      </section>

      <section className="reports-insight-grid">
        <article className="reports-panel">
          <header className="reports-panel__header">
            <div>
              <h2>Métodos de pago</h2>
              <p>Distribución de los ingresos</p>
            </div>
          </header>

          <div className="reports-payments">
            {report.pagos.map((payment) => {
              const share = percentage(payment.total, report.resumen.total);

              return (
                <div
                  className={`reports-payment reports-payment--${payment.metodo.toLowerCase()}`}
                  key={payment.metodo}
                >
                  <div className="reports-payment__heading">
                    <span>{PAYMENT_LABELS[payment.metodo] ?? payment.metodo}</span>
                    <strong>L {money(payment.total)}</strong>
                  </div>

                  <div className="reports-payment__track">
                    <i style={{ width: `${share}%` }} />
                  </div>

                  <small>
                    {share}% del total · {payment.operaciones} operaciones
                  </small>
                </div>
              );
            })}
          </div>
        </article>

        <article className="reports-panel">
          <header className="reports-panel__header">
            <div>
              <h2>Actividad por hora</h2>
              <p>Horas con mayor movimiento</p>
            </div>
          </header>

          {report.horas.length ? (
            <div className="reports-hours">
              {report.horas.map((hour) => (
                <div className="reports-hour" key={hour.hora}>
                  <span>{hourLabel(hour.hora)}</span>

                  <div>
                    <i
                      style={{
                        width: `${Math.max(4, (Number(hour.total) / maximumHourlyTotal) * 100)}%`,
                      }}
                    />
                  </div>

                  <strong>L {money(hour.total)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="reports-empty">No hay actividad en este periodo.</p>
          )}
        </article>
      </section>

      <section className="reports-panel reports-products-panel">
        <header className="reports-panel__header">
          <div>
            <h2>Productos con mejor rendimiento</h2>
            <p>Los 20 productos con mayor valor vendido</p>
          </div>

          <span className="reports-panel__badge">Top {Math.min(report.productos.length, 20)}</span>
        </header>

        {report.productos.length ? (
          <div className="reports-table-wrap">
            <table className="reports-data-table">
              <thead>
                <tr>
                  <th>Posición</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Total vendido</th>
                  <th>Ganancia estimada</th>
                </tr>
              </thead>

              <tbody>
                {report.productos.slice(0, 20).map((product, index) => (
                  <tr key={product.productoId}>
                    <td>
                      <span className="reports-rank">{index + 1}</span>
                    </td>

                    <td>
                      <strong>{product.nombre}</strong>
                    </td>

                    <td>{quantity(product.cantidad)}</td>

                    <td>L {money(product.ventas)}</td>

                    <td className="reports-positive">L {money(product.ganancia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="reports-empty">No se vendieron productos en este periodo.</p>
        )}
      </section>
    </div>
  );
}

function OperationalView({
  cancelingSaleId,
  filteredSales,
  onCancelSale,
  report,
  saleSearch,
  selectedSaleId,
  setSaleSearch,
  setSelectedSaleId,
}) {
  const SALES_PER_PAGE = 15;
  const [salesPage, setSalesPage] = useState(1);

  useEffect(() => {
    setSalesPage(1);
  }, [filteredSales]);

  const totalSalesPages = Math.max(1, Math.ceil(filteredSales.length / SALES_PER_PAGE));

  const pagedSales = filteredSales.slice(
    (salesPage - 1) * SALES_PER_PAGE,
    salesPage * SALES_PER_PAGE,
  );

  const totalUnits = report.productos.reduce((sum, product) => sum + Number(product.cantidad), 0);

  const largestSale =
    [...report.ventas].sort((first, second) => Number(second.total) - Number(first.total))[0] ??
    null;

  const shifts = [
    { id: 1, name: "Turno 1", schedule: "8:00 a. m. – 10:00 p. m.", operations: 0, total: 0 },
    { id: 2, name: "Turno 2", schedule: "10:00 p. m. – 2:00 a. m.", operations: 0, total: 0 },
    { id: 3, name: "Turno 3", schedule: "2:00 a. m. – 8:00 a. m.", operations: 0, total: 0 },
  ];

  const users = new Map();

  for (const sale of report.ventas) {
    const saleDate = new Date(sale.creadoEn);
    const hour = saleDate.getHours();
    const shiftId = hour >= 8 && hour < 22 ? 1 : hour >= 22 || hour < 2 ? 2 : 3;
    const shift = shifts.find((item) => item.id === shiftId);

    shift.operations += 1;
    shift.total += Number(sale.total);

    const userId = sale.usuario?.id ?? `name-${sale.usuario?.nombre ?? "unknown"}`;

    const user = users.get(userId) ?? {
      id: userId,
      name: sale.usuario?.nombre ?? "Sin usuario",
      operations: 0,
      units: 0,
      total: 0,
    };

    user.operations += 1;
    user.total += Number(sale.total);
    user.units += sale.productos.reduce((sum, product) => sum + Number(product.cantidad), 0);

    users.set(userId, user);
  }

  const userPerformance = [...users.values()].sort((first, second) => second.total - first.total);

  return (
    <div className="reports-view-content">
      <section className="reports-operational-summary">
        <article>
          <span>Total vendido</span>
          <strong>L {money(report.resumen.total)}</strong>
          <small>Ingresos del periodo</small>
        </article>

        <article>
          <span>Operaciones</span>
          <strong>{report.resumen.operaciones}</strong>
          <small>Ventas completadas</small>
        </article>

        <article>
          <span>Unidades vendidas</span>
          <strong>{quantity(totalUnits)}</strong>
          <small>En todos los productos</small>
        </article>

        <article>
          <span>Venta más alta</span>
          <strong>L {money(largestSale?.total)}</strong>
          <small>{largestSale ? `Venta #${largestSale.id}` : "Sin operaciones"}</small>
        </article>
      </section>

      <section className="reports-operational-grid">
        <article className="reports-panel reports-shifts-panel">
          <header className="reports-panel__header">
            <div>
              <h2>Resultados por turno</h2>
              <p>Movimiento según los horarios del negocio</p>
            </div>
          </header>

          <div className="reports-shifts">
            {shifts.map((shift) => (
              <article key={shift.id}>
                <span className="reports-shift-number">{shift.id}</span>

                <div>
                  <strong>{shift.name}</strong>
                  <small>{shift.schedule}</small>
                </div>

                <div>
                  <strong>L {money(shift.total)}</strong>
                  <small>{shift.operations} operaciones</small>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="reports-panel reports-collection-panel">
          <header className="reports-panel__header">
            <div>
              <h2>Cobros registrados</h2>
              <p>Totales separados por método de pago</p>
            </div>
          </header>

          <div className="reports-collection-list">
            {report.pagos.map((payment) => (
              <article key={payment.metodo}>
                <span
                  className={`reports-collection-dot reports-collection-dot--${payment.metodo.toLowerCase()}`}
                />

                <div>
                  <strong>{PAYMENT_LABELS[payment.metodo] ?? payment.metodo}</strong>
                  <small>{payment.operaciones} operaciones</small>
                </div>

                <strong>L {money(payment.total)}</strong>
              </article>
            ))}
          </div>

          <div className="reports-collection-total">
            <span>Total de cobros</span>
            <strong>L {money(report.resumen.total)}</strong>
          </div>
        </article>
      </section>

      <section className="reports-panel reports-users-performance">
        <header className="reports-panel__header">
          <div>
            <h2>Rendimiento por usuario</h2>
            <p>Operaciones atendidas durante el periodo</p>
          </div>

          <span className="reports-panel__badge">{userPerformance.length} usuarios</span>
        </header>

        {userPerformance.length ? (
          <div className="reports-table-wrap">
            <table className="reports-data-table reports-users-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Operaciones</th>
                  <th>Unidades</th>
                  <th>Promedio</th>
                  <th>Total vendido</th>
                </tr>
              </thead>

              <tbody>
                {userPerformance.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                    </td>

                    <td>{user.operations}</td>

                    <td>{quantity(user.units)}</td>

                    <td>L {money(user.operations ? user.total / user.operations : 0)}</td>

                    <td className="reports-positive">L {money(user.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="reports-empty">No hay actividad de usuarios en este periodo.</p>
        )}
      </section>

      <section className="reports-panel reports-sales-panel">
        <header className="reports-panel__header">
          <div>
            <h2>Historial de ventas</h2>
            <p>Detalle de cada operación del periodo</p>
          </div>

          <input
            className="reports-sales-search"
            onChange={(event) => setSaleSearch(event.target.value)}
            placeholder="Buscar por cliente, producto o usuario"
            value={saleSearch}
          />
        </header>

        {filteredSales.length === 0 ? (
          <p className="reports-empty">No hay ventas que coincidan con la búsqueda.</p>
        ) : (
          <div className="reports-sales-list">
            {pagedSales.map((sale) => (
              <article className="reports-sale-item" key={sale.id}>
                <button
                  className="reports-sale-summary"
                  onClick={() =>
                    setSelectedSaleId((current) => (current === sale.id ? null : sale.id))
                  }
                  type="button"
                >
                  <span>
                    <strong>Venta #{sale.id}</strong>
                    <small>
                      {sale.cliente?.nombre ?? "Cliente general"} · {sale.usuario?.nombre}
                    </small>
                  </span>

                  <strong>L {money(sale.total)}</strong>
                </button>

                {selectedSaleId === sale.id ? (
                  <div className="reports-sale-detail">
                    {sale.productos.map((product) => (
                      <div key={product.id}>
                        <span>
                          {product.nombre} · {product.presentacion}
                        </span>

                        <span>
                          {quantity(product.cantidad)} × L {money(product.precio)}
                        </span>

                        <strong>L {money(product.subtotal)}</strong>
                      </div>
                    ))}

                    <button
                      className="secondary-button reports-sale-cancel"
                      disabled={cancelingSaleId === sale.id}
                      onClick={() => onCancelSale(sale.id)}
                      type="button"
                    >
                      {cancelingSaleId === sale.id ? "Cancelando..." : "Cancelar venta"}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}

        {totalSalesPages > 1 ? (
          <div className="reports-sales-pagination">
            <button
              className="secondary-button"
              disabled={salesPage <= 1}
              onClick={() => setSalesPage((current) => current - 1)}
              type="button"
            >
              Anterior
            </button>

            <span>
              Página {salesPage} de {totalSalesPages} · {filteredSales.length} ventas
            </span>

            <button
              className="secondary-button"
              disabled={salesPage >= totalSalesPages}
              onClick={() => setSalesPage((current) => current + 1)}
              type="button"
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function ReportesPage({ token }) {
  const today = dateText();

  const [activeView, setActiveView] = useState("EXECUTIVE");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState(null);
  const [saleSearch, setSaleSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [cancelingSaleId, setCancelingSaleId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const maximumHourlyTotal = useMemo(
    () => Math.max(1, ...(report?.horas.map((item) => Number(item.total)) ?? [])),
    [report],
  );

  const filteredSales = useMemo(() => {
    const search = saleSearch.trim().toLocaleLowerCase("es");

    if (!search) {
      return report?.ventas ?? [];
    }

    return (report?.ventas ?? []).filter((sale) => {
      const searchableText = [
        sale.id,
        sale.cliente,
        sale.usuario?.nombre,
        PAYMENT_LABELS[sale.pago?.metodo],
        ...sale.productos.map((product) => product.nombre),
      ]
        .join(" ")
        .toLocaleLowerCase("es");

      return searchableText.includes(search);
    });
  }, [report, saleSearch]);

  async function loadReport(selectedFrom = from, selectedTo = to) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await getSalesReport(token, selectedFrom, selectedTo);

      setReport(result.reporte);
      setSelectedSaleId(null);
      setSaleSearch("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(today, today);
  }, [token]);

  async function handleCancelSale(saleId) {
    if (cancelingSaleId) {
      return;
    }

    const confirmado = window.confirm(
      `¿Cancelar la venta #${saleId}? Esto devuelve el stock vendido al inventario.`,
    );

    if (!confirmado) {
      return;
    }

    setCancelingSaleId(saleId);
    setError("");
    setMessage("");

    try {
      const result = await cancelSale(token, saleId);

      setMessage(result.mensaje);
      await loadReport();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCancelingSaleId(null);
    }
  }

  function applyQuickPeriod(type) {
    const current = new Date();
    let start = new Date(current);

    if (type === "WEEK") {
      start.setDate(current.getDate() - 6);
    }

    if (type === "MONTH") {
      start = new Date(current.getFullYear(), current.getMonth(), 1);
    }

    const selectedFrom = dateText(start);
    const selectedTo = dateText(current);

    setFrom(selectedFrom);
    setTo(selectedTo);

    loadReport(selectedFrom, selectedTo);
  }

  async function savePdf() {
    if (!report || savingPdf) {
      return;
    }

    if (!window.desktop?.saveReportPdf) {
      setError("No se pudo iniciar el guardado del PDF.");

      return;
    }

    setSavingPdf(true);
    setError("");
    setMessage("");

    try {
      const isAdministrative = activeView === "EXECUTIVE";
      const reportType = isAdministrative ? "ADMINISTRATIVE" : "OPERATIONAL";
      const reportLabel = isAdministrative ? "administrativo" : "operativo";

      const fileName =
        `reporte-${reportLabel}-` + `${report.periodo.desde}-a-` + `${report.periodo.hasta}.pdf`;

      const result = await window.desktop.saveReportPdf({
        suggestedName: fileName,
        report,
        reportType,
      });

      if (!result.canceled) {
        setMessage("Reporte PDF guardado correctamente.");
      }
    } catch (saveError) {
      setError(saveError.message || "No se pudo guardar el PDF.");
    } finally {
      setSavingPdf(false);
    }
  }

  return (
    <main className="reports-dashboard">
      <header className="reports-dashboard__header">
        <div>
          <p className="eyebrow">Panel de reportes</p>
          <h1>Información de ventas</h1>
          <p>Consulta el resumen del negocio o revisa cada operación.</p>
        </div>

        <button
          className="reports-pdf-button"
          disabled={!report || loading || savingPdf}
          onClick={savePdf}
          type="button"
        >
          <span aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v13" />
              <path d="m6 11 6 6 6-6" />
              <path d="M4 20h16" />
            </svg>
          </span>

          {savingPdf
            ? "Guardando..."
            : activeView === "EXECUTIVE"
              ? "Guardar PDF administrativo"
              : "Guardar PDF operativo"}
        </button>
      </header>

      <nav aria-label="Tipo de reporte" className="reports-view-switch">
        <button
          aria-selected={activeView === "EXECUTIVE"}
          className={activeView === "EXECUTIVE" ? "is-active" : ""}
          onClick={() => setActiveView("EXECUTIVE")}
          role="tab"
          type="button"
        >
          <span aria-hidden="true" className="reports-view-switch__icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20V10M12 20V4M20 20v-7" />
            </svg>
          </span>

          <span>
            <strong>Vista administrativa</strong>
            <small>Indicadores, ganancias y productos líderes</small>
          </span>
        </button>

        <button
          aria-selected={activeView === "OPERATIONAL"}
          className={activeView === "OPERATIONAL" ? "is-active" : ""}
          onClick={() => setActiveView("OPERATIONAL")}
          role="tab"
          type="button"
        >
          <span aria-hidden="true" className="reports-view-switch__icon">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span>

          <span>
            <strong>Vista operativa</strong>
            <small>Ventas, usuarios y productos de cada operación</small>
          </span>
        </button>
      </nav>

      <section aria-label="Periodo del reporte" className="reports-toolbar">
        <div className="reports-quick-periods">
          <span>Vista rápida</span>

          <div>
            <button disabled={loading} onClick={() => applyQuickPeriod("TODAY")} type="button">
              Hoy
            </button>

            <button disabled={loading} onClick={() => applyQuickPeriod("WEEK")} type="button">
              Últimos 7 días
            </button>

            <button disabled={loading} onClick={() => applyQuickPeriod("MONTH")} type="button">
              Este mes
            </button>
          </div>
        </div>

        <div className="reports-date-range">
          <label>
            <span>Desde</span>
            <input onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
          </label>

          <span className="reports-date-separator">a</span>

          <label>
            <span>Hasta</span>
            <input onChange={(event) => setTo(event.target.value)} type="date" value={to} />
          </label>

          <button disabled={loading} onClick={() => loadReport()} type="button">
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>
      </section>

      {error ? (
        <p className="form-error page-message" role="alert">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="form-success page-message" role="status">
          {message}
        </p>
      ) : null}

      {report ? (
        <>
          <div className="reports-period-heading">
            <div>
              <span>Periodo consultado</span>
              <strong>{periodLabel(report.periodo.desde, report.periodo.hasta)}</strong>
            </div>

            <small>{report.resumen.operaciones} ventas encontradas</small>
          </div>

          {activeView === "EXECUTIVE" ? (
            <ExecutiveView maximumHourlyTotal={maximumHourlyTotal} report={report} />
          ) : (
            <OperationalView
              cancelingSaleId={cancelingSaleId}
              filteredSales={filteredSales}
              onCancelSale={handleCancelSale}
              report={report}
              saleSearch={saleSearch}
              selectedSaleId={selectedSaleId}
              setSaleSearch={setSaleSearch}
              setSelectedSaleId={setSelectedSaleId}
            />
          )}
        </>
      ) : loading ? (
        <section className="reports-loading">Preparando el reporte...</section>
      ) : null}
    </main>
  );
}