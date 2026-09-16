import { useEffect, useMemo, useState } from "react";
import "./ReportesPage.css";
import { cancelSale, getShiftReport, listReportUsers } from "../../services/api.js";
import { emptyShifts, shiftIdForDate } from "./shifts.js";

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

function ShiftReportView({
  cancelingSaleId,
  filteredSales,
  maximumHourlyTotal,
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

  const lideres = report.lideres ?? {};
  const cierre = report.cierre ?? {};
  const cuadreCaja = report.cuadreCaja ?? { cierres: [], resumen: null };
  const entradas = report.caja?.entradas ?? [];
  const salidas = report.caja?.salidas ?? [];
  const compras = report.compras ?? [];

  const shifts = emptyShifts();
  const users = new Map();

  for (const sale of report.ventas) {
    const shiftId = shiftIdForDate(sale.creadoEn);
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
      <section aria-label="Resumen financiero" className="reports-kpi-grid">
        <article className="reports-kpi reports-kpi--primary">
          <span>Total vendido</span>
          <strong>L {money(report.resumen.total)}</strong>
          <small>Ingresos del periodo</small>
        </article>

        <article className="reports-kpi reports-kpi--blue">
          <span>Efectivo esperado</span>
          <strong>L {money(report.resumen.efectivoEsperado)}</strong>
          <small>Tras entradas y salidas de caja</small>
        </article>

        <article className="reports-kpi reports-kpi--violet">
          <span>Ventas realizadas</span>
          <strong>{report.resumen.operaciones}</strong>
          <small>Operaciones completadas</small>
        </article>

        <article className="reports-kpi">
          <span>Costo estimado</span>
          <strong>L {money(report.resumen.costoEstimado)}</strong>
          <small>Costo de lo vendido</small>
        </article>

        <article className="reports-kpi reports-kpi--green">
          <span>Ganancia estimada</span>
          <strong>L {money(report.resumen.gananciaEstimada)}</strong>
          <small>Sobre el costo registrado</small>
        </article>

        <article className="reports-kpi reports-kpi--green">
          <span>Margen estimado</span>
          <strong>{money(report.resumen.margenEstimado)}%</strong>
          <small>Ganancia / total vendido</small>
        </article>
      </section>

      <section className="reports-executive-highlights">
        <article>
          <span>Líder por ingresos</span>
          <strong>{lideres.mayorIngreso?.nombre ?? "Sin información"}</strong>
          <small>{lideres.mayorIngreso ? `L ${money(lideres.mayorIngreso.ventas)} vendidos` : "Sin ventas"}</small>
        </article>

        <article>
          <span>Mayor cantidad vendida</span>
          <strong>{lideres.mayorCantidad?.nombre ?? "Sin información"}</strong>
          <small>
            {lideres.mayorCantidad ? `${quantity(lideres.mayorCantidad.cantidad)} unidades` : "Sin ventas"}
          </small>
        </article>

        <article>
          <span>Mayor ganancia</span>
          <strong>{lideres.mayorGanancia?.nombre ?? "Sin información"}</strong>
          <small>{lideres.mayorGanancia ? `L ${money(lideres.mayorGanancia.ganancia)} estimados` : "Sin ventas"}</small>
        </article>

        <article>
          <span>Hora con más ventas</span>
          <strong>{lideres.horaConMasVentas ? hourLabel(lideres.horaConMasVentas.hora) : "Sin información"}</strong>
          <small>{lideres.horaConMasVentas ? `L ${money(lideres.horaConMasVentas.total)} vendidos` : "Sin ventas"}</small>
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
            {report.pagos.map((payment) => (
              <div
                className={`reports-payment reports-payment--${payment.metodo.toLowerCase()}`}
                key={payment.metodo}
              >
                <div className="reports-payment__heading">
                  <span>{PAYMENT_LABELS[payment.metodo] ?? payment.metodo}</span>
                  <strong>L {money(payment.total)}</strong>
                </div>

                <div className="reports-payment__track">
                  <i style={{ width: `${payment.porcentaje}%` }} />
                </div>

                <small>
                  {money(payment.porcentaje)}% del total · {payment.operaciones} operaciones
                </small>
              </div>
            ))}
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

      <section className="reports-insight-grid">
        <article className="reports-panel">
          <header className="reports-panel__header">
            <div>
              <h2>Cierre</h2>
              <p>Efectivo de ventas contra movimientos de caja</p>
            </div>
          </header>

          <div className="reports-close-list">
            <div className="reports-close-row">
              <span>Efectivo por ventas</span>
              <strong>L {money(cierre.efectivoVentas)}</strong>
            </div>

            <div className="reports-close-row">
              <span>+ Entradas de caja</span>
              <strong className="reports-positive">+ L {money(cierre.entradas)}</strong>
            </div>

            <div className="reports-close-row">
              <span>− Salidas de caja</span>
              <strong className="reports-negative">− L {money(cierre.salidas)}</strong>
            </div>

            <div className="reports-close-row reports-close-row--total">
              <span>Efectivo esperado</span>
              <strong>L {money(cierre.efectivoEsperado)}</strong>
            </div>
          </div>
        </article>

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
      </section>

      <section className="reports-panel reports-cuadre-panel">
        <header className="reports-panel__header">
          <div>
            <h2>Cuadre real de caja</h2>
            <p>Faltante o sobrante de los cierres ya hechos en este periodo</p>
          </div>

          {cuadreCaja.resumen?.cierres ? (
            <span
              className={`reports-panel__badge ${
                cuadreCaja.resumen.totalDiferencia < 0
                  ? "reports-panel__badge--negative"
                  : cuadreCaja.resumen.totalDiferencia > 0
                    ? "reports-panel__badge--positive"
                    : ""
              }`}
            >
              {cuadreCaja.resumen.totalDiferencia === 0
                ? "Cuadró exacto"
                : `${cuadreCaja.resumen.totalDiferencia < 0 ? "Faltante" : "Sobrante"} de L ${money(Math.abs(cuadreCaja.resumen.totalDiferencia))}`}
            </span>
          ) : null}
        </header>

        {cuadreCaja.cierres?.length ? (
          <div className="reports-table-wrap">
            <table className="reports-data-table">
              <thead>
                <tr>
                  <th>Cierre</th>
                  <th>Cajero</th>
                  <th>Fondo inicial</th>
                  <th>Esperado</th>
                  <th>Contado</th>
                  <th>Diferencia</th>
                </tr>
              </thead>

              <tbody>
                {cuadreCaja.cierres.map((closure) => (
                  <tr key={closure.id}>
                    <td>{dateTime(closure.cerradoEn)}</td>
                    <td>{closure.usuarioCierre?.nombre ?? "—"}</td>
                    <td>L {money(closure.fondoInicial)}</td>
                    <td>L {money(closure.efectivoEsperado)}</td>
                    <td>L {money(closure.efectivoContado)}</td>
                    <td className={closure.diferencia < 0 ? "reports-negative" : closure.diferencia > 0 ? "reports-positive" : ""}>
                      {closure.diferencia === 0
                        ? "Exacto"
                        : `${closure.diferencia < 0 ? "Faltante" : "Sobrante"} · L ${money(Math.abs(closure.diferencia))}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="reports-empty">No se cerró ninguna caja dentro de este periodo/turno — no hay cuadre que mostrar todavía.</p>
        )}
      </section>

      <section className="reports-panel reports-movements-panel">
        <header className="reports-panel__header">
          <div>
            <h2>Desglose de movimientos</h2>
            <p>Entradas, salidas de caja y compras a proveedores</p>
          </div>
        </header>

        <div className="reports-movements-grid">
          <div>
            <h3>Entradas de caja</h3>

            {entradas.length ? (
              <div className="reports-table-wrap">
                <table className="reports-data-table">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Motivo</th>
                      <th>Monto</th>
                    </tr>
                  </thead>

                  <tbody>
                    {entradas.map((entry) => (
                      <tr key={entry.id}>
                        <td>{dateTime(entry.creadoEn)}</td>
                        <td>{entry.motivo}</td>
                        <td className="reports-positive">+ L {money(entry.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="reports-empty">No hubo entradas de caja en este periodo.</p>
            )}
          </div>

          <div>
            <h3>Salidas de caja</h3>

            {salidas.length ? (
              <div className="reports-table-wrap">
                <table className="reports-data-table">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Motivo</th>
                      <th>Monto</th>
                    </tr>
                  </thead>

                  <tbody>
                    {salidas.map((entry) => (
                      <tr key={entry.id}>
                        <td>{dateTime(entry.creadoEn)}</td>
                        <td>{entry.motivo}</td>
                        <td className="reports-negative">− L {money(entry.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="reports-empty">No hubo salidas de caja en este periodo.</p>
            )}
          </div>
        </div>

        <h3>Compras a proveedores</h3>

        {compras.length ? (
          <div className="reports-table-wrap">
            <table className="reports-data-table">
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Hora</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {compras.map((purchase) => (
                  <tr key={purchase.id}>
                    <td>{purchase.proveedor}</td>
                    <td>{dateTime(purchase.creadoEn)}</td>
                    <td>L {money(purchase.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="reports-empty">No hubo compras a proveedores en este periodo.</p>
        )}
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

      <section className="reports-panel reports-products-panel">
        <header className="reports-panel__header">
          <div>
            <h2>Todas las ventas · agrupadas por producto</h2>
            <p>Ordenadas por total vendido</p>
          </div>

          <span className="reports-panel__badge">{report.productos.length} productos</span>
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
                  <th>Costo</th>
                  <th>Ganancia estimada</th>
                </tr>
              </thead>

              <tbody>
                {report.productos.map((product, index) => (
                  <tr key={product.productoId}>
                    <td>
                      <span className="reports-rank">{index + 1}</span>
                    </td>

                    <td>
                      <strong>{product.nombre}</strong>
                    </td>

                    <td>{quantity(product.cantidad)}</td>

                    <td>L {money(product.ventas)}</td>

                    <td>L {money(product.costo)}</td>

                    <td className={Number(product.ganancia) < 0 ? "reports-negative" : "reports-positive"}>
                      L {money(product.ganancia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="reports-empty">No se vendieron productos en este periodo.</p>
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

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [turnos, setTurnos] = useState(["A", "B", "C"]);
  const [usuarioId, setUsuarioId] = useState("");
  const [users, setUsers] = useState([]);
  const [report, setReport] = useState(null);
  const [saleSearch, setSaleSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState(null);
  const [cancelingSaleId, setCancelingSaleId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
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

  async function loadReport(
    selectedFrom = from,
    selectedTo = to,
    selectedTurnos = turnos,
    selectedUsuarioId = usuarioId,
  ) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await getShiftReport(
        token,
        selectedFrom,
        selectedTo,
        selectedTurnos,
        selectedUsuarioId || undefined,
      );

      setReport(result.reporte);
      setSelectedSaleId(null);
      setSaleSearch("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleTurno(value) {
    setTurnos((current) => {
      const has = current.includes(value);

      // No dejar seleccionado cero turnos.
      if (has && current.length === 1) {
        return current;
      }

      const next = has ? current.filter((item) => item !== value) : [...current, value];

      loadReport(from, to, next, usuarioId);

      return next;
    });
  }

  function handleUsuarioChange(value) {
    setUsuarioId(value);
    loadReport(from, to, turnos, value);
  }

  useEffect(() => {
    loadReport(today, today);
  }, [token]);

  useEffect(() => {
    let active = true;

    listReportUsers(token)
      .then((result) => {
        if (active) {
          setUsers(result.usuarios);
        }
      })
      .catch(() => {
        // Si falla, simplemente no se muestra el selector de usuario —
        // el resto del reporte sigue funcionando igual.
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function handleCancelSale(saleId) {
    if (cancelingSaleId) {
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
      setConfirmCancelId(null);
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
      const fileName = `informe-turno-${report.periodo.desde}-a-${report.periodo.hasta}.pdf`;

      const result = await window.desktop.saveReportPdf({
        suggestedName: fileName,
        report,
      });

      if (!result.canceled) {
        setMessage("Informe PDF guardado correctamente.");
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
          <h1>Informe de turno</h1>
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

          {savingPdf ? "Guardando..." : "Guardar PDF"}
        </button>
      </header>

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

        <div className="reports-shift-filter">
          <span>Turnos</span>

          {[
            { value: "A", label: "Turno A · 2am–8am" },
            { value: "B", label: "Turno B · 8am–6pm" },
            { value: "C", label: "Turno C · 6pm–2am" },
          ].map((shift) => (
            <label key={shift.value}>
              <input
                checked={turnos.includes(shift.value)}
                onChange={() => toggleTurno(shift.value)}
                type="checkbox"
              />
              {shift.label}
            </label>
          ))}

          {users.length > 0 ? (
            <label className="reports-user-filter">
              <span>Usuario</span>

              <select
                onChange={(event) => handleUsuarioChange(event.target.value)}
                value={usuarioId}
              >
                <option value="">Todos</option>

                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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

      {confirmCancelId ? (
        <section aria-label="Confirmar cancelación" className="page-message">
          <p>¿Cancelar la venta #{confirmCancelId}? Esto devuelve el stock vendido al inventario.</p>
          <button autoFocus className="secondary-button" disabled={Boolean(cancelingSaleId)} onClick={() => setConfirmCancelId(null)} type="button">Volver</button>
          <button className="primary-button" disabled={Boolean(cancelingSaleId)} onClick={() => handleCancelSale(confirmCancelId)} type="button">
            {cancelingSaleId ? "Cancelando..." : "Sí, cancelar venta"}
          </button>
        </section>
      ) : null}
      {report ? (
        <>
          <div className="reports-period-heading">
            <div>
              <span>Periodo consultado</span>
              <strong>{periodLabel(report.periodo.desde, report.periodo.hasta)}</strong>
              <small>{report.periodo.turnoEtiqueta}</small>
            </div>

            <small>{report.resumen.operaciones} ventas encontradas</small>
          </div>

          <ShiftReportView
            cancelingSaleId={cancelingSaleId}
            filteredSales={filteredSales}
            maximumHourlyTotal={maximumHourlyTotal}
            onCancelSale={(saleId) => { if (!cancelingSaleId) setConfirmCancelId(saleId); }}
            report={report}
            saleSearch={saleSearch}
            selectedSaleId={selectedSaleId}
            setSaleSearch={setSaleSearch}
            setSelectedSaleId={setSelectedSaleId}
          />
        </>
      ) : loading ? (
        <section className="reports-loading">Preparando el reporte...</section>
      ) : null}
    </main>
  );
}