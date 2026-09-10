import { useEffect, useState } from "react";
import { listMyCashActivity } from "../../services/api.js";

const money = (value) => new Intl.NumberFormat("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const dateTime = (value) => new Intl.DateTimeFormat("es-HN", { timeZone: "America/Tegucigalpa", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const labels = { VENTA: "Venta", INGRESO: "Ingreso", RETIRO: "Retiro" };

export function MiActividad({ token, revision }) {
  const [fecha, setFecha] = useState(() => new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [tipo, setTipo] = useState("VENTA");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setResult(null);
    setError("");
    listMyCashActivity(token, { fecha, tipo, page }, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setResult(data); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, fecha, tipo, page, refresh, revision]);

  return (
    <section className="cash-details-card cash-my-activity" aria-labelledby="my-activity-title">
      <h2 id="my-activity-title">Mi actividad</h2>
      <p>Solo tus ventas, ingresos y retiros. Incluye turnos cerrados; las fechas usan la hora de Honduras.</p>
      <div className="cash-activity-filters">
        <label className="field">
          <span>Fecha de actividad</span>
          <input type="date" value={fecha} onChange={(event) => { setFecha(event.target.value); setPage(1); }} />
        </label>
        <label className="field">
          <span>Tipo de actividad</span>
          <select value={tipo} onChange={(event) => { setTipo(event.target.value); setPage(1); }}>
            <option value="VENTA">Mis ventas</option>
            <option value="INGRESO">Mis ingresos</option>
            <option value="RETIRO">Mis retiros</option>
          </select>
        </label>
        <button type="button" className="secondary-button" disabled={loading} onClick={() => { setPage(1); setRefresh((value) => value + 1); }}>Actualizar actividad</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p role="status">Cargando tu actividad...</p> : result && (
        <>
          {result.registros.length === 0 ? <p>No tienes registros de este tipo en la fecha seleccionada.</p> : (
            <div className="cash-activity-list">
              {result.registros.map((item) => (
                <article key={`${item.tipo}-${item.id}`}>
                  <header>
                    <strong>{labels[item.tipo]} #{item.id}</strong>
                    <span>{dateTime(item.creadoEn)} · {item.turnoCajaId ? `Caja #${item.turnoCajaId}` : "Sin turno asociado"}</span>
                    <strong>L {money(item.monto)}</strong>
                  </header>
                  {item.tipo === "VENTA" ? <>
                    <p>{item.estado === "CANCELADA" ? "Cancelada — no suma al efectivo de caja" : "Completada"}</p>
                    <details>
                      <summary>Ver productos y pagos</summary>
                      <ul>{item.productos.map((product) => <li key={product.id}>{product.cantidad} × {product.nombre} ({product.presentacion}) — L {money(product.subtotal)}</li>)}</ul>
                      <p>{item.pagos.map((payment) => `${payment.metodo}: L ${money(payment.monto)}`).join(" · ")}</p>
                    </details>
                  </> : <p>{item.motivo}</p>}
                </article>
              ))}
            </div>
          )}
          <nav className="cash-activity-pagination" aria-label="Páginas de mi actividad">
            <button className="secondary-button" type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
            <span>Página {page}</span>
            <button className="secondary-button" type="button" disabled={!result.hayMas} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
          </nav>
        </>
      )}
    </section>
  );
}
