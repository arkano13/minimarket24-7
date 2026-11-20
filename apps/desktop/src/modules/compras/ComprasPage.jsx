import { useEffect, useMemo, useRef, useState } from "react";
import "./ComprasPage.css";
import { newOperationKey } from "../../services/operationKey.js";
import { formatUnits, presentationLabel } from "../../services/presentation.js";

import {
  cancelPurchase,
  createPurchase,
  getPurchase,
  listPurchases,
  searchPurchaseProducts,
  searchPurchaseSuppliers,
} from "../../services/api.js";

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

function decimalValue(setter, value, decimals) {
  const normalized = value.replace(",", ".");

  const expression = new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`);

  if (normalized === "" || expression.test(normalized)) {
    setter(normalized);
  }
}

// ISV de Honduras: 15 % general y 18 % bebidas alcohólicas y tabaco.
const ISV_OPCIONES = [
  { valor: 0, etiqueta: "No lleva" },
  { valor: 15, etiqueta: "15 %" },
  { valor: 18, etiqueta: "18 %" },
];

function isvDeLinea(item) {
  return Math.round(Number(item.costoTotal || 0) * Number(item.isv || 0)) / 100;
}

export function ComprasPage({ token }) {
  const operationKeyRef = useRef(newOperationKey());
  const [purchases, setPurchases] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Subtotal sin impuesto, ISV por tasa y total a pagar.
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.costoTotal || 0), 0);
    const isvDe = (tasa) =>
      items.filter((item) => Number(item.isv) === tasa).reduce((sum, item) => sum + isvDeLinea(item), 0);
    const isv15 = isvDe(15);
    const isv18 = isvDe(18);
    return { subtotal, isv15, isv18, total: subtotal + isv15 + isv18 };
  }, [items]);
  const total = totals.total;

  async function handleCancelPurchase() {
    if (!selectedPurchase || canceling) {
      return;
    }

    setCanceling(true);
    setError("");
    setSuccess("");

    try {
      const result = await cancelPurchase(token, selectedPurchase.id);

      setSelectedPurchase(result.compra);

      setPurchases((current) =>
        current.map((purchase) => (purchase.id === result.compra.id ? result.compra : purchase)),
      );

      setSuccess(result.mensaje);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCanceling(false);
      setConfirmCancel(false);
    }
  }

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      try {
        const result = await listPurchases(token, historySearch.trim(), "", true);

        if (active) {
          setPurchases(result.compras);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [historySearch, token]);

  useEffect(() => {
    if (!selectedPurchaseId) return;
    let active = true;
    setLoadingDetail(true);
    setConfirmCancel(false);
    setSelectedPurchase(null);
    getPurchase(token, selectedPurchaseId)
      .then((result) => { if (active) setSelectedPurchase(result.compra); })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message);
          setSelectedPurchaseId(null);
          setLoadingDetail(false);
        }
      })
      .finally(() => { if (active) setLoadingDetail(false); });
    return () => { active = false; };
  }, [selectedPurchaseId, token]);

  useEffect(() => {
    let active = true;

    searchPurchaseSuppliers(token)
      .then((result) => {
        if (active) {
          setSuppliers(result.proveedores);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const term = productSearch.trim();

    if (!showForm || !term) {
      setProductResults([]);
      setSearchingProducts(false);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setSearchingProducts(true);

      try {
        const result = await searchPurchaseProducts(token, term, controller.signal);

        if (active) {
          setProductResults(result.productos);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setSearchingProducts(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [productSearch, showForm, token]);

  function resetForm() {
    operationKeyRef.current = newOperationKey();
    setSupplierId("");
    setDocumentNumber("");
    setNotes("");
    setProductSearch("");
    setProductResults([]);
    setItems([]);
    setConfirming(false);
  }

  function openForm() {
    resetForm();
    setShowForm(true);
    setSelectedPurchase(null);
    setSelectedPurchaseId(null);
    setLoadingDetail(false);
    setError("");
    setSuccess("");
  }

  function addProduct(product) {
    if (items.length >= 100) {
      setError("Cada entrada admite hasta 100 productos. Registra otra entrada para los restantes.");
      return;
    }
    const alreadyAdded = items.some(
      (item) => item.presentacionId === product.presentacionId,
    );

    if (alreadyAdded) {
      setError("Ese producto ya está agregado a la compra.");
      return;
    }

    setItems((current) => [
      ...current,
      {
        ...product,
        cantidad: "1",
        costoTotal: "",
        // Se propone el ISV que tuvo el producto en su última compra.
        isv: Number(product.isv) || 0,
      },
    ]);

    setProductSearch("");
    setProductResults([]);
    setConfirming(false);
    setError("");
  }

  function updateItem(presentationId, field, value) {
    setItems((current) =>
      current.map((item) =>
        item.presentacionId === presentationId ? { ...item, [field]: value } : item,
      ),
    );

    setConfirming(false);
  }

  function removeItem(presentationId) {
    setItems((current) => current.filter((item) => item.presentacionId !== presentationId));

    setConfirming(false);
  }

  async function savePurchase() {
    if (loading) return;
    setError("");

    if (!supplierId) {
      setError("Selecciona un proveedor.");
      return;
    }

    if (
      items.length === 0 ||
      items.some((item) => Number(item.cantidad) <= 0 || Number(item.costoTotal) <= 0)
    ) {
      setError("Revisa las cantidades y costos de los productos.");
      return;
    }

    setLoading(true);

    try {
      const result = await createPurchase(token, {
        claveOperacion: operationKeyRef.current,
        proveedorId: Number(supplierId),
        numeroDocumento: documentNumber,
        notas: notes,
        productos: items.map((item) => ({
          presentacionId: item.presentacionId,
          cantidad: item.cantidad,
          costoTotal: item.costoTotal,
          isv: Number(item.isv) || 0,
          // Compatibility with servers from before costoTotal was introduced.
          // Current servers preserve costoTotal; older ones require unit cost.
          costo: Number(item.costoTotal) / Number(item.cantidad),
        })),
      });

      setPurchases((current) => [result.compra, ...current]);

      setSelectedPurchase(result.compra);
      setShowForm(false);
      resetForm();

      setSuccess("Mercancía registrada e inventario actualizado. No se descontó dinero de caja.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="purchases-page">
      <header className="purchases-header">
        <div>
          <p className="eyebrow">Entradas de mercancía</p>

          <h1>Compras</h1>

          <p>Registra productos recibidos. Esta operación no paga al proveedor ni afecta la caja.</p>
        </div>

        <button className="primary-button" disabled={loading || canceling} onClick={openForm} type="button">
          + Registrar mercancía
        </button>
      </header>

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

      {showForm ? (
        <section className="purchase-form-card">
          <div className="purchase-form-heading">
            <div>
              <p className="eyebrow">Mercancía recibida</p>

              <h2>Registrar entrada</h2>
            </div>

            <strong>Total: L {money(total)}</strong>
          </div>

          <fieldset disabled={loading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="purchase-general-fields">
            <label className="field">
              <span>Proveedor</span>

              <select
                onChange={(event) => {
                  setSupplierId(event.target.value);
                  setConfirming(false);
                }}
                required
                value={supplierId}
              >
                <option value="">Selecciona un proveedor</option>

                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Número de documento opcional</span>

              <input
                maxLength="100"
                onChange={(event) => setDocumentNumber(event.target.value)}
                placeholder="Factura o recibo del proveedor"
                value={documentNumber}
              />
            </label>

            <label className="field purchase-notes-field">
              <span>Notas opcionales</span>

              <input
                maxLength="250"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Información adicional"
                value={notes}
              />
            </label>
          </div>

          <div className="purchase-product-search">
            <input
              autoFocus
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder="Buscar producto por nombre, SKU o código"
              value={productSearch}
            />

            {productSearch.trim() ? (
              <div className="purchase-product-results">
                {searchingProducts ? (
                  <p>Buscando...</p>
                ) : productResults.length === 0 ? (
                  <p>No se encontraron productos.</p>
                ) : (
                  productResults.map((product) => (
                    <button
                      key={product.presentacionId}
                      onClick={() => addProduct(product)}
                      type="button"
                    >
                      <span>
                        <strong>{presentationLabel(product).titulo}</strong>

                        <small>
                          {presentationLabel(product).detalle}
                          {product.factorInventario !== 1
                            ? ` · equivale a ${formatUnits(product.factorInventario)} unid.`
                            : ""}
                        </small>
                      </span>

                      <small>Costo anterior: L {money(product.costoSugerido)}</small>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="empty-state">Busca y agrega los productos recibidos.</p>
          ) : (
            <div className="purchase-items">
              {items.map((item) => (
                <article className="purchase-item" key={item.presentacionId}>
                  <div className="purchase-item__name">
                    <strong>{presentationLabel(item).titulo}</strong>

                    <small>{presentationLabel(item).detalle}</small>

                    {item.factorInventario !== 1 ? (
                      <small className="purchase-item__units">
                        Entran al inventario:{" "}
                        {formatUnits((Number(item.cantidad) || 0) * item.factorInventario)} unid.
                        de {item.nombre}
                      </small>
                    ) : null}
                  </div>

                  <label>
                    <span>Cantidad recibida</span>

                    <input
                      autoComplete="off"
                      onChange={(event) =>
                        decimalValue(
                          (value) => updateItem(item.presentacionId, "cantidad", value),
                          event.target.value,
                          3,
                        )
                      }
                      type="text"
                      value={item.cantidad}
                    />
                  </label>

                  <label>
                    <span>Costo total de la cantidad recibida</span>

                    <input
                      autoComplete="off"
                      onChange={(event) =>
                        decimalValue(
                          (value) => updateItem(item.presentacionId, "costoTotal", value),
                          event.target.value,
                          2,
                        )
                      }
                      placeholder="0.00"
                      type="text"
                      value={item.costoTotal}
                    />
                  </label>

                  <strong>Costo c/u: L {money(Number(item.cantidad) > 0 ? Number(item.costoTotal) / Number(item.cantidad) : 0)}</strong>

                  <button
                    aria-label={`Quitar ${item.nombre}`}
                    className="cart-item__remove"
                    onClick={() => removeItem(item.presentacionId)}
                    type="button"
                  >
                    ×
                  </button>

                  <div className="purchase-item__isv" role="radiogroup" aria-label={`Impuesto de ${item.nombre}`}>
                    <span>Impuesto (ISV)</span>

                    <div className="isv-options">
                      {ISV_OPCIONES.map((opcion) => (
                        <label
                          className={Number(item.isv) === opcion.valor ? "isv-option isv-option--selected" : "isv-option"}
                          key={opcion.valor}
                        >
                          <input
                            checked={Number(item.isv) === opcion.valor}
                            name={`isv-${item.presentacionId}`}
                            onChange={() => updateItem(item.presentacionId, "isv", opcion.valor)}
                            type="radio"
                          />
                          {opcion.etiqueta}
                        </label>
                      ))}
                    </div>

                    {Number(item.isv) > 0 ? (
                      <small>
                        + L {money(isvDeLinea(item))} · total L {money(Number(item.costoTotal || 0) + isvDeLinea(item))}
                      </small>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}

          {items.length > 0 ? (
            <div className="purchase-totals">
              <div><span>Subtotal (sin impuesto)</span><span>L {money(totals.subtotal)}</span></div>
              {totals.isv15 > 0 ? <div><span>ISV 15 %</span><span>L {money(totals.isv15)}</span></div> : null}
              {totals.isv18 > 0 ? <div><span>ISV 18 %</span><span>L {money(totals.isv18)}</span></div> : null}
              <div className="purchase-totals__total"><span>Total a pagar</span><span>L {money(totals.total)}</span></div>
            </div>
          ) : null}

          </fieldset>
          <div className="purchase-form-actions">
            <button
              className="secondary-button"
              disabled={loading}
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              type="button"
            >
              Cancelar
            </button>

            {!confirming ? (
              <button
                className="primary-button"
                disabled={items.length === 0 || loading}
                onClick={() => setConfirming(true)}
                type="button"
              >
                Revisar entrada
              </button>
            ) : (
              <div className="purchase-confirmation">
                <span>Total a pagar: L {money(total)}. No se descontará dinero de caja.</span>

                <button className="primary-button" disabled={loading} onClick={savePurchase} type="button">
                  {loading ? "Registrando..." : "Sí, actualizar inventario"}
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="purchases-layout">
          <aside className="purchase-history-card">
            <input
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Buscar por proveedor o documento"
              value={historySearch}
            />

            <div>
              {purchases.length === 0 ? (
                <p className="empty-state">No hay entradas registradas.</p>
              ) : (
                purchases.map((purchase) => (
                  <button
                    className={
                      selectedPurchase?.id === purchase.id
                        ? "purchase-history-item purchase-history-item--selected"
                        : "purchase-history-item"
                    }
                    key={purchase.id}
                    disabled={canceling}
                    onClick={() => setSelectedPurchaseId(purchase.id)}
                    type="button"
                  >
                    <span>
                      <strong>Entrada #{purchase.id}</strong>

                      <small>{purchase.proveedor.nombre}</small>
                    </span>

                    <span>
                      <b>L {money(purchase.total)}</b>

                      <small>{dateTime(purchase.creadoEn)}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="purchase-detail-card">
            {!selectedPurchase ? (
              <div className="purchase-detail-empty">
                <span aria-hidden="true">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3h12l1 5H5Z" />
                    <path d="M5 8v11a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8" />
                    <path d="M9.5 12a2.5 2.5 0 0 0 5 0" />
                  </svg>
                </span>

                <h2>{loadingDetail ? "Cargando entrada..." : "Selecciona una entrada"}</h2>

                <p>Aquí aparecerán el proveedor y los productos recibidos.</p>
              </div>
            ) : (
              <>
                <header className="purchase-detail-header">
                  <div>
                    <p className="eyebrow">Mercancía recibida</p>

                    <h2>Entrada #{selectedPurchase.id}</h2>

                    <p>{selectedPurchase.proveedor.nombre}</p>
                  </div>

                  <div className="purchase-detail-actions">
                    <strong>L {money(selectedPurchase.total)}</strong>

                    {selectedPurchase.estado === "ANULADA" ? (
                      <span className="purchase-status purchase-status--anulada">Anulada</span>
                    ) : (
                      <button
                        className="secondary-button purchase-cancel-button"
                        disabled={canceling}
                        onClick={() => setConfirmCancel(true)}
                        type="button"
                      >
                        {canceling ? "Anulando..." : "Anular compra"}
                      </button>
                    )}
                  </div>
                </header>

                {confirmCancel ? (
                  <section aria-label="Confirmar anulación">
                    <p>¿Anular la compra #{selectedPurchase.id}? Esto revierte el inventario recibido.</p>
                    <button className="secondary-button" disabled={canceling} onClick={() => setConfirmCancel(false)} type="button">Volver</button>
                    <button className="primary-button" disabled={canceling} onClick={handleCancelPurchase} type="button">
                      {canceling ? "Anulando..." : "Sí, anular compra"}
                    </button>
                  </section>
                ) : null}
                <div className="purchase-detail-summary">
                  <span>Fecha: {dateTime(selectedPurchase.creadoEn)}</span>

                  <span>Documento: {selectedPurchase.numeroDocumento || "No registrado"}</span>

                  <span>Registró: {selectedPurchase.usuario.nombre}</span>

                  <span>Sin movimiento de caja</span>
                </div>

                <div className="purchase-detail-products">
                  {selectedPurchase.productos.map((product) => (
                    <article key={product.id}>
                      <span>
                        <strong>
                          {presentationLabel(product).titulo}
                          {product.isv > 0 ? (
                            <span className={`isv-tag isv-tag--${product.isv}`}>ISV {product.isv} %</span>
                          ) : null}
                        </strong>

                        <small>{presentationLabel(product).detalle}</small>
                      </span>

                      <span>
                        {product.cantidad} × L {money(product.costo)}
                        {product.factorInventario !== 1
                          ? ` (= ${formatUnits(product.cantidadInventario)} unid.)`
                          : ""}
                      </span>

                      <strong>L {money(product.subtotal)}</strong>
                    </article>
                  ))}
                </div>

                {selectedPurchase.isv15 > 0 || selectedPurchase.isv18 > 0 ? (
                  <div className="purchase-totals purchase-totals--detail">
                    <div><span>Subtotal (sin impuesto)</span><span>L {money(selectedPurchase.subtotalSinIsv)}</span></div>
                    {selectedPurchase.isv15 > 0 ? <div><span>ISV 15 %</span><span>L {money(selectedPurchase.isv15)}</span></div> : null}
                    {selectedPurchase.isv18 > 0 ? <div><span>ISV 18 %</span><span>L {money(selectedPurchase.isv18)}</span></div> : null}
                    <div className="purchase-totals__total"><span>Total</span><span>L {money(selectedPurchase.total)}</span></div>
                  </div>
                ) : null}

                {selectedPurchase.notas ? (
                  <p className="purchase-detail-notes">
                    <strong>Notas:</strong> {selectedPurchase.notas}
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
