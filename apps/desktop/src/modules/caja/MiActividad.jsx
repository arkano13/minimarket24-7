import { useEffect, useState } from "react";
import { listMyCashActivity } from "../../services/api.js";

const money = (value) => new Intl.NumberFormat("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const dateTime = (value) => new Intl.DateTimeFormat("es-HN", { timeZone: "America/Tegucigalpa", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const labels = { VENTA: "Venta", INGRESO: "Ingreso", RETIRO: "Retiro" };

function nextDate(date) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function localDateAndMinute(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Tegucigalpa", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minute: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

async function loadAllSales(token, date) {
  const sales = [];
  let page = 1;
  let response;
  do {
    response = await listMyCashActivity(token, { fecha: date, tipo: "VENTA", page });
    sales.push(...response.registros);
    page += 1;
  } while (response.hayMas);
  return { sales, user: response.usuario };
}

export function MiActividad({ token, revision }) {
  const [fecha, setFecha] = useState(() => new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [tipo, setTipo] = useState("VENTA");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  async function printMySales() {
    if (printing) return;
    if (!window.desktop?.printUserSales) {
      setError("La impresión solo está disponible en la aplicación de escritorio.");
      return;
    }
    setPrinting(true);
    setError("");
    try {
      const followingDate = nextDate(fecha);
      const [current, following] = await Promise.all([
        loadAllSales(token, fecha),
        loadAllSales(token, followingDate),
      ]);
      const shifts = [
        { nombre: "A", horario: "2:00 a. m. – 8:00 a. m.", ventas: [] },
        { nombre: "B", horario: "8:00 a. m. – 6:00 p. m.", ventas: [] },
        { nombre: "C", horario: "6:00 p. m. – 2:00 a. m.", ventas: [] },
      ];
      for (const sale of [...current.sales, ...following.sales]) {
        const local = localDateAndMinute(sale.creadoEn);
        if (local.date === fecha && local.minute >= 120 && local.minute < 480) shifts[0].ventas.push(sale);
        else if (local.date === fecha && local.minute >= 480 && local.minute < 1080) shifts[1].ventas.push(sale);
        else if ((local.date === fecha && local.minute >= 1080) ||
          (local.date === followingDate && local.minute < 120)) shifts[2].ventas.push(sale);
      }
      const sales = shifts.flatMap((shift) => shift.ventas);
      if (sales.length === 0) {
        setError("No tienes ventas para imprimir en la fecha seleccionada.");
        return;
      }
      await window.desktop.printUserSales({ fecha, usuario: current.user ?? following.user, turnos: shifts });
    } catch (err) {
      setError(err.message || "No se pudieron imprimir tus ventas.");
    } finally {
      setPrinting(false);
    }
  }

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
        <button type="button" className="primary-button" disabled={loading || printing} onClick={printMySales}>
          {printing ? "Preparando impresión..." : "Imprimir mis ventas"}
        </button>
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
