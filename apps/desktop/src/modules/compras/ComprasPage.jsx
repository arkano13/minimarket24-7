import { useEffect, useMemo, useState } from "react";

import {
  createPurchase,
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

  const expression = new RegExp(
    `^\\d+(\\.\\d{0,${decimals}})?$`,
  );

  if (
    normalized === "" ||
    expression.test(normalized)
  ) {
    setter(normalized);
  }
}

export function ComprasPage({ token }) {
  const [purchases, setPurchases] = useState([]);

  const [
    selectedPurchase,
    setSelectedPurchase,
  ] = useState(null);

  const [historySearch, setHistorySearch] =
    useState("");

  const [showForm, setShowForm] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");

  const [
    documentNumber,
    setDocumentNumber,
  ] = useState("");

  const [notes, setNotes] = useState("");

  const [productSearch, setProductSearch] =
    useState("");

  const [productResults, setProductResults] =
    useState([]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [
    searchingProducts,
    setSearchingProducts,
  ] = useState(false);

  const [confirming, setConfirming] =
    useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          Number(item.cantidad || 0) *
            Number(item.costo || 0),
        0,
      ),
    [items],
  );

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      try {
        const result = await listPurchases(
          token,
          historySearch.trim(),
        );

        if (active) {
          setPurchases(result.compras);

          setSelectedPurchase((current) =>
            current
              ? result.compras.find(
                  (purchase) =>
                    purchase.id === current.id,
                ) ?? null
              : null,
          );
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

    const timer = window.setTimeout(async () => {
      setSearchingProducts(true);

      try {
        const result =
          await searchPurchaseProducts(
            token,
            term,
          );

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
    };
  }, [productSearch, showForm, token]);

  function resetForm() {
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
    setError("");
    setSuccess("");
  }

  function addProduct(product) {
    const alreadyAdded = items.some(
      (item) =>
        item.presentacionId ===
        product.presentacionId,
    );

    if (alreadyAdded) {
      setError(
        "Ese producto ya está agregado a la compra.",
      );
      return;
    }

    setItems((current) => [
      ...current,
      {
        ...product,
        cantidad: "1",

        costo:
          Number(product.costoSugerido) > 0
            ? Number(
                product.costoSugerido,
              ).toFixed(2)
            : "",
      },
    ]);

    setProductSearch("");
    setProductResults([]);
    setConfirming(false);
    setError("");
  }

  function updateItem(
    presentationId,
    field,
    value,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.presentacionId === presentationId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );

    setConfirming(false);
  }

  function removeItem(presentationId) {
    setItems((current) =>
      current.filter(
        (item) =>
          item.presentacionId !== presentationId,
      ),
    );

    setConfirming(false);
  }

  async function savePurchase() {
    setError("");

    if (!supplierId) {
      setError("Selecciona un proveedor.");
      return;
    }

    if (
      items.length === 0 ||
      items.some(
        (item) =>
          Number(item.cantidad) <= 0 ||
          Number(item.costo) <= 0,
      )
    ) {
      setError(
        "Revisa las cantidades y costos de los productos.",
      );
      return;
    }

    setLoading(true);

    try {
      const result = await createPurchase(token, {
        proveedorId: Number(supplierId),
        numeroDocumento: documentNumber,
        notas: notes,

        productos: items.map((item) => ({
          presentacionId:
            item.presentacionId,
          cantidad: item.cantidad,
          costo: item.costo,
        })),
      });

      setPurchases((current) => [
        result.compra,
        ...current,
      ]);

      setSelectedPurchase(result.compra);
      setShowForm(false);
      resetForm();

      setSuccess(
        "Mercancía registrada e inventario actualizado. No se descontó dinero de caja.",
      );
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
          <p className="eyebrow">
            Entradas de mercancía
          </p>

          <h1>Compras</h1>

          <p>
            Registra productos recibidos. Esta
            operación no paga al proveedor ni afecta
            la caja.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openForm}
          type="button"
        >
          + Registrar mercancía
        </button>
      </header>

      {error ? (
        <p
          className="form-error page-message"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {success ? (
        <p
          className="form-success page-message"
          role="status"
        >
          {success}
        </p>
      ) : null}

      {showForm ? (
        <section className="purchase-form-card">
          <div className="purchase-form-heading">
            <div>
              <p className="eyebrow">
                Mercancía recibida
              </p>

              <h2>Registrar entrada</h2>
            </div>

            <strong>
              Costo total: L {money(total)}
            </strong>
          </div>

          <div className="purchase-general-fields">
            <label className="field">
              <span>Proveedor</span>

              <select
                onChange={(event) => {
                  setSupplierId(
                    event.target.value,
                  );

                  setConfirming(false);
                }}
                required
                value={supplierId}
              >
                <option value="">
                  Selecciona un proveedor
                </option>

                {suppliers.map((supplier) => (
                  <option
                    key={supplier.id}
                    value={supplier.id}
                  >
                    {supplier.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>
                Número de documento opcional
              </span>

              <input
                maxLength="100"
                onChange={(event) =>
                  setDocumentNumber(
                    event.target.value,
                  )
                }
                placeholder="Factura o recibo del proveedor"
                value={documentNumber}
              />
            </label>

            <label className="field purchase-notes-field">
              <span>Notas opcionales</span>

              <input
                maxLength="250"
                onChange={(event) =>
                  setNotes(event.target.value)
                }
                placeholder="Información adicional"
                value={notes}
              />
            </label>
          </div>

          <div className="purchase-product-search">
            <input
              autoFocus
              onChange={(event) =>
                setProductSearch(
                  event.target.value,
                )
              }
              placeholder="Buscar producto por nombre, SKU o código"
              value={productSearch}
            />

            {productSearch.trim() ? (
              <div className="purchase-product-results">
                {searchingProducts ? (
                  <p>Buscando...</p>
                ) : productResults.length === 0 ? (
                  <p>
                    No se encontraron productos.
                  </p>
                ) : (
                  productResults.map((product) => (
                    <button
                      key={product.presentacionId}
                      onClick={() =>
                        addProduct(product)
                      }
                      type="button"
                    >
                      <span>
                        <strong>
                          {product.nombre}
                        </strong>

                        <small>
                          {product.presentacion}
                        </small>
                      </span>

                      <small>
                        Costo anterior: L{" "}
                        {money(
                          product.costoSugerido,
                        )}
                      </small>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="empty-state">
              Busca y agrega los productos recibidos.
            </p>
          ) : (
            <div className="purchase-items">
              {items.map((item) => (
                <article
                  className="purchase-item"
                  key={item.presentacionId}
                >
                  <div className="purchase-item__name">
                    <strong>{item.nombre}</strong>

                    <small>
                      {item.presentacion}
                    </small>
                  </div>

                  <label>
                    <span>Cantidad recibida</span>

                    <input
                      autoComplete="off"
                      onChange={(event) =>
                        decimalValue(
                          (value) =>
                            updateItem(
                              item.presentacionId,
                              "cantidad",
                              value,
                            ),
                          event.target.value,
                          3,
                        )
                      }
                      type="text"
                      value={item.cantidad}
                    />
                  </label>

                  <label>
                    <span>
                      Costo por{" "}
                      {item.presentacion.toLowerCase()}
                    </span>

                    <input
                      autoComplete="off"
                      onChange={(event) =>
                        decimalValue(
                          (value) =>
                            updateItem(
                              item.presentacionId,
                              "costo",
                              value,
                            ),
                          event.target.value,
                          4,
                        )
                      }
                      placeholder="0.00"
                      type="text"
                      value={item.costo}
                    />
                  </label>

                  <strong>
                    L{" "}
                    {money(
                      Number(item.cantidad) *
                        Number(item.costo),
                    )}
                  </strong>

                  <button
                    aria-label={`Quitar ${item.nombre}`}
                    className="cart-item__remove"
                    onClick={() =>
                      removeItem(
                        item.presentacionId,
                      )
                    }
                    type="button"
                  >
                    ×
                  </button>
                </article>
              ))}
            </div>
          )}

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
                disabled={
                  items.length === 0 ||
                  loading
                }
                onClick={() =>
                  setConfirming(true)
                }
                type="button"
              >
                Revisar entrada
              </button>
            ) : (
              <div className="purchase-confirmation">
                <span>
                  Costo total: L {money(total)}.
                  No se descontará dinero de caja.
                </span>

                <button
                  className="primary-button"
                  disabled={loading}
                  onClick={savePurchase}
                  type="button"
                >
                  {loading
                    ? "Registrando..."
                    : "Sí, actualizar inventario"}
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="purchases-layout">
          <aside className="purchase-history-card">
            <input
              onChange={(event) =>
                setHistorySearch(
                  event.target.value,
                )
              }
              placeholder="Buscar por proveedor o documento"
              value={historySearch}
            />

            <div>
              {purchases.length === 0 ? (
                <p className="empty-state">
                  No hay entradas registradas.
                </p>
              ) : (
                purchases.map((purchase) => (
                  <button
                    className={
                      selectedPurchase?.id ===
                      purchase.id
                        ? "purchase-history-item purchase-history-item--selected"
                        : "purchase-history-item"
                    }
                    key={purchase.id}
                    onClick={() =>
                      setSelectedPurchase(
                        purchase,
                      )
                    }
                    type="button"
                  >
                    <span>
                      <strong>
                        Entrada #{purchase.id}
                      </strong>

                      <small>
                        {
                          purchase.proveedor
                            .nombre
                        }
                      </small>
                    </span>

                    <span>
                      <b>
                        L{" "}
                        {money(
                          purchase.total,
                        )}
                      </b>

                      <small>
                        {dateTime(
                          purchase.creadoEn,
                        )}
                      </small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="purchase-detail-card">
            {!selectedPurchase ? (
              <div className="purchase-detail-empty">
                <span aria-hidden="true">🧾</span>

                <h2>
                  Selecciona una entrada
                </h2>

                <p>
                  Aquí aparecerán el proveedor y
                  los productos recibidos.
                </p>
              </div>
            ) : (
              <>
                <header className="purchase-detail-header">
                  <div>
                    <p className="eyebrow">
                      Mercancía recibida
                    </p>

                    <h2>
                      Entrada #
                      {selectedPurchase.id}
                    </h2>

                    <p>
                      {
                        selectedPurchase
                          .proveedor.nombre
                      }
                    </p>
                  </div>

                  <strong>
                    L{" "}
                    {money(
                      selectedPurchase.total,
                    )}
                  </strong>
                </header>

                <div className="purchase-detail-summary">
                  <span>
                    Fecha:{" "}
                    {dateTime(
                      selectedPurchase.creadoEn,
                    )}
                  </span>

                  <span>
                    Documento:{" "}
                    {selectedPurchase.numeroDocumento ||
                      "No registrado"}
                  </span>

                  <span>
                    Registró:{" "}
                    {
                      selectedPurchase.usuario
                        .nombre
                    }
                  </span>

                  <span>
                    Sin movimiento de caja
                  </span>
                </div>

                <div className="purchase-detail-products">
                  {selectedPurchase.productos.map(
                    (product) => (
                      <article key={product.id}>
                        <span>
                          <strong>
                            {product.nombre}
                          </strong>

                          <small>
                            {
                              product.presentacion
                            }
                          </small>
                        </span>

                        <span>
                          {product.cantidad} × L{" "}
                          {money(product.costo)}
                        </span>

                        <strong>
                          L{" "}
                          {money(
                            product.subtotal,
                          )}
                        </strong>
                      </article>
                    ),
                  )}
                </div>

                {selectedPurchase.notas ? (
                  <p className="purchase-detail-notes">
                    <strong>Notas:</strong>{" "}
                    {selectedPurchase.notas}
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