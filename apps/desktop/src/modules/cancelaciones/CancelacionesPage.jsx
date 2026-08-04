import { useEffect, useState } from "react";
import "./CancelacionesPage.css";

import { cancelSale, listSales } from "../../services/api.js";

function money(value) {
  return new Intl.NumberFormat("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function dateTime(value) {
  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CancelacionesPage({ token }) {
  const [searchText, setSearchText] = useState("");
  const [sales, setSales] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [selectedSale, setSelectedSale] = useState(null);
  const [canceling, setCanceling] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadSales() {
    setLoadingList(true);

    try {
      const result = await listSales(token, searchText.trim());
      setSales(result.ventas);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      setLoadingList(true);

      try {
        const result = await listSales(token, searchText.trim());

        if (active) {
          setSales(result.ventas);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setLoadingList(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchText, token]);

  function selectSale(sale) {
    setSelectedSale(sale);
    setError("");
    setSuccess("");
  }

  async function handleCancel() {
    if (!selectedSale || canceling) {
      return;
    }

    const confirmado = window.confirm(
      `¿Cancelar la venta #${selectedSale.id} por L ${money(selectedSale.total)}? Esto devuelve el stock vendido al inventario.`,
    );

    if (!confirmado) {
      return;
    }

    setCanceling(true);
    setError("");
    setSuccess("");

    try {
      const result = await cancelSale(token, selectedSale.id);

      setSuccess(result.mensaje);
      setSelectedSale(null);
      await loadSales();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCanceling(false);
    }
  }

  return (
    <main className="returns-page">
      <header className="returns-header">
        <div>
          <h1>Cancelar ventas</h1>

          <p>Busca la venta y cancélala. El stock vuelve al inventario.</p>
        </div>
      </header>

      <div className="returns-workspace">
        <aside className="returns-list-card">
          <input
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar por cliente o cajero"
            value={searchText}
          />

          <div className="returns-list">
            {loadingList ? (
              <p className="empty-state">Buscando...</p>
            ) : sales.length === 0 ? (
              <p className="empty-state">No se encontraron ventas.</p>
            ) : (
              sales.map((sale) => (
                <button
                  className={
                    selectedSale?.id === sale.id
                      ? "returns-list-item returns-list-item--selected"
                      : "returns-list-item"
                  }
                  key={sale.id}
                  onClick={() => selectSale(sale)}
                  type="button"
                >
                  <span>
                    <strong>Venta #{sale.id}</strong>

                    <small>
                      {sale.cliente?.nombre ?? "Cliente general"} · {sale.usuario?.nombre}
                    </small>
                  </span>

                  <span>
                    <b>L {money(sale.total)}</b>
                    <small>{dateTime(sale.creadoEn)}</small>

                    {sale.estado === "CANCELADA" ? (
                      <small className="returns-status-cancelada">Cancelada</small>
                    ) : null}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="returns-detail-card">
          {error ? (
            <p className="form-error page-message" role="alert">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="form-success page-message" role="status">
              {success}
            </p>
          ) : null}

          {!selectedSale ? (
            <div className="returns-detail-empty">
              <span aria-hidden="true">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 10h10a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9" />
                  <path d="M8 5 3 10l5 5" />
                </svg>
              </span>

              <h2>Selecciona una venta</h2>

              <p>Búscala en la lista de la izquierda y haz clic para verla.</p>
            </div>
          ) : (
            <div className="return-detail">
              <div className="return-detail__summary">
                <span>
                  Venta #{selectedSale.id} · {dateTime(selectedSale.creadoEn)}
                </span>

                <span>Registró: {selectedSale.usuario?.nombre}</span>

                <span>Total: L {money(selectedSale.total)}</span>
              </div>

              <div className="return-products">
                {selectedSale.productos.map((product) => (
                  <article className="return-product" key={product.id}>
                    <div className="return-product__name">
                      <strong>{product.nombre}</strong>
                      <small>{product.presentacion}</small>
                    </div>

                    <div className="return-product__stats">
                      <small>
                        {product.cantidad} × L {money(product.precio)}
                      </small>
                    </div>

                    <strong>L {money(product.subtotal)}</strong>
                  </article>
                ))}
              </div>

              {selectedSale.estado === "CANCELADA" ? (
                <p className="returns-status-cancelada">Esta venta ya está cancelada.</p>
              ) : (
                <button
                  className="primary-button"
                  disabled={canceling}
                  onClick={handleCancel}
                  type="button"
                >
                  {canceling ? "Cancelando..." : "Cancelar venta"}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}