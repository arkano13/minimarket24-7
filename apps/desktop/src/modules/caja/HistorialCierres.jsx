import { useEffect, useState } from "react";
import { listCashShiftHistory } from "../../services/api.js";

const money = (value) =>
  new Intl.NumberFormat("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("es-HN", {
        timeZone: "America/Tegucigalpa",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";

function todayBusinessDate() {
  // Aproximación solo para el valor inicial del selector de fecha — el
  // corte real de 2am ya lo aplica el backend al resolver "hasta".
  return new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function HistorialCierres({ currentUser, revision, token }) {
  const isAdmin = currentUser?.rol === "ADMINISTRADOR";

  const [hasta, setHasta] = useState(todayBusinessDate);
  const [soloMios, setSoloMios] = useState(!isAdmin);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(1);
  }, [hasta, soloMios]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const result = await listCashShiftHistory(
          token,
          {
            hasta,
            usuarioId: isAdmin && !soloMios ? undefined : currentUser?.id,
            page,
          },
          controller.signal,
        );

        if (active) {
          setData(result);
        }
      } catch (requestError) {
        if (active && requestError.name !== "AbortError") {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
      controller.abort();
    };
    // "revision" cambia cada vez que se cierra una caja nueva — así el
    // historial se refresca solo sin que el usuario tenga que recargar.
  }, [token, hasta, soloMios, page, currentUser?.id, isAdmin, revision]);

  return (
    <section className="cash-details-card">
      <div className="cash-card-heading">
        <div>
          <h2>Historial de cierres</h2>

          <p>{isAdmin && !soloMios ? "Cierres de todos los usuarios" : "Tus cierres de caja"}</p>
        </div>
      </div>

      <div className="cash-history-filters">
        <label className="field">
          <span>Hasta</span>

          <input
            onChange={(event) => setHasta(event.target.value)}
            type="date"
            value={hasta}
          />
        </label>

        {isAdmin ? (
          <label className="cash-history-toggle">
            <input
              checked={soloMios}
              onChange={(event) => setSoloMios(event.target.checked)}
              type="checkbox"
            />

            <span>Ver solo los míos</span>
          </label>
        ) : null}
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="empty-state">Cargando historial...</p>
      ) : !data || data.cierres.length === 0 ? (
        <p className="empty-state">No hay cierres en este rango.</p>
      ) : (
        <>
          <div className="cash-history-list">
            {data.cierres.map((cierre) => (
              <article className="cash-history-item" key={cierre.id}>
                <header>
                  <strong>{dateTime(cierre.cerradoEn)}</strong>

                  <span
                    className={
                      cierre.diferencia < 0
                        ? "cash-negative"
                        : cierre.diferencia > 0
                          ? "cash-positive"
                          : ""
                    }
                  >
                    {cierre.diferencia === 0
                      ? "Cuadró exacto"
                      : `${cierre.diferencia < 0 ? "Faltante" : "Sobrante"} · L ${money(Math.abs(cierre.diferencia))}`}
                  </span>
                </header>

                <div className="cash-history-item__body">
                  <span>{cierre.usuarioCierre?.nombre ?? "—"}</span>
                  <span>{cierre.totales.cantidadVentas} ventas</span>
                  <span>Vendido L {money(cierre.totales.ventas)}</span>
                  <span>Esperado L {money(cierre.efectivoEsperado)}</span>
                  <span>Contado L {money(cierre.efectivoContado)}</span>
                </div>

                <div className="cash-history-item__breakdown">
                  <span>Efectivo L {money(cierre.totales.efectivo)}</span>
                  <span>Tarjeta L {money(cierre.totales.tarjeta)}</span>
                  <span>Transferencia L {money(cierre.totales.transferencia)}</span>
                  <span className="cash-positive">+ Entradas L {money(cierre.totales.ingresos)}</span>
                  <span className="cash-negative">− Retiros L {money(cierre.totales.retiros)}</span>
                </div>
              </article>
            ))}
          </div>

          {data.totalPaginas > 1 ? (
            <div className="cash-history-pagination">
              <button
                className="secondary-button"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                Anterior
              </button>

              <span>
                Página {data.pagina} de {data.totalPaginas} · {data.total} cierres
              </span>

              <button
                className="secondary-button"
                disabled={page >= data.totalPaginas}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Siguiente
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}