import { useEffect, useMemo, useState } from "react";
import { getSalesReport } from "../../services/api.js";

const PAYMENT_LABELS = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
};

function todayText() {
  const date = new Date();
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
  const date = new Date(2000, 0, 1, hour, 0);

  return new Intl.DateTimeFormat("es-HN", {
    hour: "numeric",
  }).format(date);
}

export function ReportesPage({ token }) {
  const initialDate = todayText();

  const [from, setFrom] = useState(initialDate);
  const [to, setTo] = useState(initialDate);
  const [report, setReport] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const maximumHourlyTotal = useMemo(() => {
    const totals =
      report?.horas.map((hour) => Number(hour.total)) ?? [];

    return Math.max(1, ...totals);
  }, [report]);

  async function loadReport(
    selectedFrom = from,
    selectedTo = to,
  ) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await getSalesReport(
        token,
        selectedFrom,
        selectedTo,
      );

      setReport(result.reporte);
      setSelectedSale(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport(initialDate, initialDate);
  }, [token]);

  function selectToday() {
    const today = todayText();

    setFrom(today);
    setTo(today);
    loadReport(today, today);
  }

  function toggleSale(sale) {
    setSelectedSale((currentSale) =>
      currentSale?.id === sale.id ? null : sale,
    );
  }

  async function savePdf() {
    if (!report || savingPdf) {
      return;
    }

    if (!window.desktop?.saveReportPdf) {
      setError(
        "No se pudo iniciar el guardado del PDF.",
      );
      return;
    }

    setSavingPdf(true);
    setError("");
    setMessage("");

    try {
      const fileName =
        `reporte-ventas-` +
        `${report.periodo.desde}-a-` +
        `${report.periodo.hasta}.pdf`;

      const result =
        await window.desktop.saveReportPdf(fileName);

      if (!result.canceled) {
        setMessage(
          "Reporte PDF guardado correctamente.",
        );
      }
    } catch (saveError) {
      setError(
        saveError.message ||
          "No se pudo guardar el PDF.",
      );
    } finally {
      setSavingPdf(false);
    }
  }

  return (
    <main className="reports-page">
      <header className="reports-header">
        <div>
          <p className="eyebrow">
            Información del negocio
          </p>

          <h1>Reportes</h1>

          <p>
            Consulta las ventas, ganancias y productos
            vendidos.
          </p>
        </div>

        <button
          className="secondary-button reports-print-button"
          disabled={!report || loading || savingPdf}
          onClick={savePdf}
          type="button"
        >
          {savingPdf
            ? "Guardando..."
            : "Guardar PDF"}
        </button>
      </header>

      <section className="report-filters">
        <label className="field">
          <span>Desde</span>

          <input
            onChange={(event) =>
              setFrom(event.target.value)
            }
            type="date"
            value={from}
          />
        </label>

        <label className="field">
          <span>Hasta</span>

          <input
            onChange={(event) =>
              setTo(event.target.value)
            }
            type="date"
            value={to}
          />
        </label>

        <button
          className="primary-button"
          disabled={loading}
          onClick={() => loadReport()}
          type="button"
        >
          {loading
            ? "Generando..."
            : "Generar reporte"}
        </button>

        <button
          className="secondary-button"
          disabled={loading}
          onClick={selectToday}
          type="button"
        >
          Ver hoy
        </button>
      </section>

      {error ? (
        <p
          className="form-error page-message"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {message ? (
        <p
          className="form-success page-message"
          role="status"
        >
          {message}
        </p>
      ) : null}

      {report ? (
        <div className="report-document">
          <header className="report-print-header">
            <h1>Minisúper</h1>
            <h2>Reporte de ventas</h2>

            <p>
              Periodo: {report.periodo.desde} al{" "}
              {report.periodo.hasta}
            </p>
          </header>

          <section className="report-summary-grid">
            <article>
              <span>Total vendido</span>

              <strong>
                L {money(report.resumen.total)}
              </strong>
            </article>

            <article>
              <span>Ventas realizadas</span>

              <strong>
                {report.resumen.operaciones}
              </strong>
            </article>

            <article>
              <span>Ganancia estimada</span>

              <strong>
                L{" "}
                {money(
                  report.resumen.gananciaEstimada,
                )}
              </strong>
            </article>

            <article>
              <span>Promedio por venta</span>

              <strong>
                L {money(report.resumen.promedio)}
              </strong>
            </article>
          </section>

          <section className="report-section">
            <div className="report-section-heading">
              <h2>Métodos de pago</h2>

              <small>
                Costo estimado: L{" "}
                {money(
                  report.resumen.costoEstimado,
                )}
              </small>
            </div>

            <div className="report-payment-grid">
              {report.pagos.map((payment) => (
                <article key={payment.metodo}>
                  <span>
                    {PAYMENT_LABELS[
                      payment.metodo
                    ] ?? payment.metodo}
                  </span>

                  <strong>
                    L {money(payment.total)}
                  </strong>

                  <small>
                    {payment.operaciones} operaciones
                  </small>
                </article>
              ))}
            </div>
          </section>

          <section className="report-section">
            <h2>Productos con más ventas</h2>

            {report.productos.length === 0 ? (
              <p className="empty-state">
                No hay productos vendidos en este
                periodo.
              </p>
            ) : (
              <div className="report-table-wrapper">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Ventas</th>
                      <th>Ganancia estimada</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.productos.map(
                      (product) => (
                        <tr key={product.productoId}>
                          <td>{product.nombre}</td>

                          <td>
                            {quantity(
                              product.cantidad,
                            )}
                          </td>

                          <td>
                            L{" "}
                            {money(product.ventas)}
                          </td>

                          <td>
                            L{" "}
                            {money(
                              product.ganancia,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="report-section report-hours-section">
            <h2>Ventas por hora</h2>

            {report.horas.length === 0 ? (
              <p className="empty-state">
                No hay ventas en este periodo.
              </p>
            ) : (
              <div className="report-hour-bars">
                {report.horas.map((hour) => {
                  const percentage = Math.max(
                    4,
                    (Number(hour.total) /
                      maximumHourlyTotal) *
                      100,
                  );

                  return (
                    <article key={hour.hora}>
                      <span>
                        {hourLabel(hour.hora)}
                      </span>

                      <div>
                        <i
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>

                      <strong>
                        L {money(hour.total)}
                      </strong>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="report-section">
            <h2>Historial de ventas</h2>

            {report.ventas.length === 0 ? (
              <p className="empty-state">
                No hay ventas en este periodo.
              </p>
            ) : (
              <div className="report-sales-list">
                {report.ventas.map((sale) => (
                  <article key={sale.id}>
                    <button
                      onClick={() =>
                        toggleSale(sale)
                      }
                      type="button"
                    >
                      <span>
                        <strong>
                          Venta #{sale.id}
                        </strong>

                        <small>
                          {dateTime(
                            sale.creadoEn,
                          )}
                        </small>
                      </span>

                      <span>
                        <small>
                          {sale.cliente}
                        </small>

                        <small>
                          {PAYMENT_LABELS[
                            sale.pago?.metodo
                          ] ?? "Sin pago"}
                        </small>
                      </span>

                      <strong>
                        L {money(sale.total)}
                      </strong>
                    </button>

                    {selectedSale?.id ===
                    sale.id ? (
                      <div className="report-sale-detail">
                        {sale.productos.map(
                          (product) => (
                            <div key={product.id}>
                              <span>
                                {product.nombre} ·{" "}
                                {
                                  product.presentacion
                                }
                              </span>

                              <span>
                                {quantity(
                                  product.cantidad,
                                )}{" "}
                                × L{" "}
                                {money(
                                  product.precio,
                                )}
                              </span>

                              <strong>
                                L{" "}
                                {money(
                                  product.subtotal,
                                )}
                              </strong>
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <footer className="report-print-footer">
            Generado el {dateTime(new Date())}
          </footer>
        </div>
      ) : loading ? (
        <p className="empty-state">
          Generando reporte...
        </p>
      ) : null}
    </main>
  );
}