import { useEffect, useState } from "react";
import { listBitacora, listUsers } from "../../services/api.js";

const ORIGEN_LABELS = {
  USUARIO: "Usuarios y sistema",
  INVENTARIO: "Inventario",
  CAJA: "Caja",
};

function todayText() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateTime(value) {
  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function describeDetalle(detalle) {
  if (!detalle || typeof detalle !== "object") {
    return null;
  }

  return Object.entries(detalle)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
}

export function BitacoraPage({ token }) {
  const [desde, setDesde] = useState(todayText());
  const [hasta, setHasta] = useState(todayText());
  const [usuarioId, setUsuarioId] = useState("");
  const [origen, setOrigen] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listUsers(token)
      .then((result) => setUsuarios(result.usuarios ?? []))
      .catch(() => {});
  }, [token]);

  async function loadRegistros(targetPage = 1) {
    setLoading(true);
    setError("");

    try {
      const result = await listBitacora(token, {
        desde,
        hasta,
        usuarioId: usuarioId || undefined,
        origen: origen || undefined,
        page: targetPage,
      });

      setRegistros(result.registros);
      setTotal(result.total);
      setPerPage(result.perPage);
      setPage(result.page);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRegistros(1);
  }, [token]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <main className="bitacora-page">
      <header className="bitacora-header">
        <div>
          <h1>Bitácora</h1>
          <p>Historial de acciones realizadas en el sistema.</p>
        </div>
      </header>

      <section className="bitacora-filters">
        <label className="field">
          <span>Desde</span>
          <input
            type="date"
            value={desde}
            onChange={(event) => setDesde(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Hasta</span>
          <input
            type="date"
            value={hasta}
            onChange={(event) => setHasta(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Usuario</span>
          <select
            value={usuarioId}
            onChange={(event) => setUsuarioId(event.target.value)}
          >
            <option value="">Todos</option>
            {usuarios.map((user) => (
              <option key={user.id} value={user.id}>
                {user.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Origen</span>
          <select
            value={origen}
            onChange={(event) => setOrigen(event.target.value)}
          >
            <option value="">Todos</option>
            <option value="USUARIO">Usuarios y sistema</option>
            <option value="INVENTARIO">Inventario</option>
            <option value="CAJA">Caja</option>
          </select>
        </label>

        <button
          className="primary-button"
          disabled={loading}
          onClick={() => loadRegistros(1)}
          type="button"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </section>

      {error ? (
        <p className="form-error page-message" role="alert">
          {error}
        </p>
      ) : null}

      <section className="bitacora-table-wrapper">
        {registros.length === 0 && !loading ? (
          <p className="empty-state">No hay registros en este periodo.</p>
        ) : (
          <table className="bitacora-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Origen</th>
                <th>Acción</th>
                <th>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {registros.map((registro) => (
                <tr key={registro.id}>
                  <td>{dateTime(registro.fecha)}</td>
                  <td>{registro.usuario?.nombre ?? "—"}</td>
                  <td>
                    <span
                      className={`bitacora-badge bitacora-badge--${registro.origen.toLowerCase()}`}
                    >
                      {ORIGEN_LABELS[registro.origen] ?? registro.origen}
                    </span>
                  </td>
                  <td>{registro.accion}</td>
                  <td>{describeDetalle(registro.detalle) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {totalPages > 1 ? (
        <footer className="bitacora-pagination">
          <button
            className="secondary-button"
            disabled={page <= 1 || loading}
            onClick={() => loadRegistros(page - 1)}
            type="button"
          >
            Anterior
          </button>

          <span>
            Página {page} de {totalPages}
          </span>

          <button
            className="secondary-button"
            disabled={page >= totalPages || loading}
            onClick={() => loadRegistros(page + 1)}
            type="button"
          >
            Siguiente
          </button>
        </footer>
      ) : null}
    </main>
  );
}