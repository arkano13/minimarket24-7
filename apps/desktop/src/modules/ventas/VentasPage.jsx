import { useEffect, useMemo, useRef, useState } from "react";
import "./VentasPage.css";
import {
  createSale,
  getCurrentCashShift,
  repriceCart,
  searchSaleClients,
  searchSaleProducts,
} from "../../services/api.js";

function PaymentIcon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  if (name === "EFECTIVO") {
    return (
      <svg {...common}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }

  if (name === "TARJETA") {
    return (
      <svg {...common}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M17 7 7 17" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

const PAYMENT_METHODS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
];

function formatMoney(value) {
  return new Intl.NumberFormat("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuantity(value) {
  return new Intl.NumberFormat("es-HN", {
    maximumFractionDigits: 3,
  }).format(value);
}

function updateMoneyValue(setter, value) {
  const normalized = value.replace(",", ".");

  if (normalized === "" || /^\d+(\.\d{0,2})?$/.test(normalized)) {
    setter(normalized);
  }
}

function unitLabel(type) {
  if (type === "PESO") {
    return "lb";
  }

  if (type === "VOLUMEN") {
    return "L";
  }

  return "unid.";
}

function priceLabel(product, client) {
  if (product.precioEspecial) {
    return `Precio especial · ${client?.nombre ?? "Cliente"}`;
  }

  if (product.turno) {
    return `${product.turno.nombre} · precio automático`;
  }

  return "Precio normal";
}

export function VentasPage({ token }) {
  const searchInputRef = useRef(null);

  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);

  const [paymentMethod, setPaymentMethod] = useState("EFECTIVO");
  const [receivedAmount, setReceivedAmount] = useState("");

  const [loading, setLoading] = useState(false);
  const [charging, setCharging] = useState(false);
  const [error, setError] = useState("");
  const [lastSale, setLastSale] = useState(null);
  const [cashShift, setCashShift] = useState(undefined);

  const [selectedClient, setSelectedClient] = useState(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [repricing, setRepricing] = useState(false);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.precio * Number(item.cantidad || 0), 0),
    [cart],
  );

  const change =
    paymentMethod === "EFECTIVO" && Number(receivedAmount) >= total
      ? Number(receivedAmount) - total
      : 0;

  useEffect(() => {
    let active = true;

    getCurrentCashShift(token)
      .then((result) => {
        if (active) {
          setCashShift(result.turno);
        }
      })
      .catch((requestError) => {
        if (active) {
          setCashShift(null);
          setError(requestError.message);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!showClientPicker) {
      setClientResults([]);
      setSearchingClients(false);
      return undefined;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setSearchingClients(true);

      try {
        const result = await searchSaleClients(token, clientSearch.trim());

        if (active) {
          setClientResults(result.clientes);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setSearchingClients(false);
        }
      }
    }, 200);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [clientSearch, showClientPicker, token]);

  useEffect(() => {
    const term = search.trim();

    if (!term || !cashShift) {
      setProducts([]);
      setLoading(false);
      return undefined;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setLoading(true);

      try {
        const result = await searchSaleProducts(token, term, selectedClient?.id);

        if (active) {
          setProducts(result.productos);
          setError("");
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cashShift, search, selectedClient, token]);

  function focusSearch() {
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  useEffect(() => {
    function handleGlobalShortcut(event) {
      if (event.key !== "/") {
        return;
      }

      const tag = event.target.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (isTyping || !cashShift) {
        return;
      }

      event.preventDefault();
      focusSearch();
    }

    window.addEventListener("keydown", handleGlobalShortcut);

    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, [cashShift]);

  function addProduct(product) {
    if (product.stock <= 0) {
      setError("Este producto no tiene existencia disponible.");
      focusSearch();
      return;
    }

    setCart((current) => {
      const existing = current.find(
        (item) => item.presentacionId === product.presentacionId,
      );

      if (existing) {
        const nextQuantity = Number(existing.cantidad || 0) + 1;

        if (nextQuantity > product.stock) {
          setError("No hay suficiente existencia disponible.");
          return current;
        }

        return current.map((item) =>
          item.presentacionId === product.presentacionId
            ? { ...item, cantidad: String(nextQuantity) }
            : item,
        );
      }

      return [...current, { ...product, cantidad: "1" }];
    });

    setError("");
    setSearch("");
    focusSearch();
  }

  async function handleSearch(event) {
    event.preventDefault();
    setError("");

    const term = search.trim();

    if (!term) {
      setProducts([]);
      return;
    }

    try {
      const result = await searchSaleProducts(token, term, selectedClient?.id);

      const exactProduct = result.productos.find((product) => product.coincidenciaExacta);

      if (exactProduct) {
        addProduct(exactProduct);
        return;
      }

      setProducts(result.productos);

      if (result.productos.length === 0) {
        setError("No se encontró ningún producto.");
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function updateQuantity(presentationId, value) {
    setCart((current) =>
      current.map((item) => {
        if (item.presentacionId !== presentationId) {
          return item;
        }

        if (value === "") {
          setError("");

          return { ...item, cantidad: "" };
        }

        const quantity = Number(value);

        if (!Number.isFinite(quantity)) {
          return item;
        }

        if (quantity > item.stock) {
          setError("La cantidad supera la existencia disponible.");
          return item;
        }

        setError("");

        return { ...item, cantidad: value };
      }),
    );
  }

  function removeProduct(presentationId) {
    setCart((current) => current.filter((item) => item.presentacionId !== presentationId));

    focusSearch();
  }

  function selectPaymentMethod(method) {
    setPaymentMethod(method);
    setReceivedAmount("");
    setError("");
  }

  function openClientPicker() {
    setError("");
    setShowClientPicker((current) => !current);
    setClientSearch("");
  }

  async function selectSaleClient(client) {
    setShowClientPicker(false);
    setClientSearch("");
    setSearch("");
    setProducts([]);
    setError("");

    if (cart.length === 0) {
      setSelectedClient(client);
      return;
    }

    setRepricing(true);

    try {
      const presentationIds = cart.map((item) => item.presentacionId);

      const result = await repriceCart(token, presentationIds, client?.id);

      setCart((current) =>
        current.map((item) => {
          const updated = result.productos.find(
            (product) => product.presentacionId === item.presentacionId,
          );

          if (!updated) {
            return item;
          }

          const cantidad =
            Number(item.cantidad) > updated.stock ? String(updated.stock) : item.cantidad;

          return { ...item, ...updated, cantidad };
        }),
      );

      setSelectedClient(client);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRepricing(false);
    }
  }

  async function handleCharge() {
    setError("");

    if (!cashShift) {
      setError("Debes abrir la caja antes de vender.");
      return;
    }

    if (cart.length === 0) {
      setError("Agrega al menos un producto a la venta.");
      return;
    }

    if (
      cart.some((item) => !Number.isFinite(Number(item.cantidad)) || Number(item.cantidad) <= 0)
    ) {
      setError("Revisa la cantidad de los productos.");
      return;
    }

    if (paymentMethod === "EFECTIVO" && (!receivedAmount || Number(receivedAmount) < total)) {
      setError("El efectivo recibido es menor que el total.");
      return;
    }

    setCharging(true);

    try {
      const result = await createSale(token, {
        productos: cart.map((item) => ({
          presentacionId: item.presentacionId,
          cantidad: Number(item.cantidad),
        })),
        metodoPago: paymentMethod,
        clienteId: selectedClient?.id,
        montoRecibido: paymentMethod === "EFECTIVO" ? receivedAmount : undefined,
      });

      setLastSale(result.venta);
      setCart([]);
      setReceivedAmount("");
      setPaymentMethod("EFECTIVO");
      setSearch("");
      setProducts([]);
      setSelectedClient(null);
      setShowClientPicker(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCharging(false);
      focusSearch();
    }
  }

  return (
    <main className="sales-page">
      <header className="sales-header">
        <div>
          <p className="eyebrow">Punto de venta</p>
          <h1>Nueva venta</h1>
        </div>

        <div className="sales-header__total">
          <span>Total actual</span>
          <strong>L {formatMoney(total)}</strong>
        </div>
      </header>

      {error ? (
        <p className="form-error page-message" role="alert">
          {error}
        </p>
      ) : null}

      {cashShift === null ? (
        <p className="cash-closed-warning">
          La caja está cerrada. Abre <strong>Caja y turnos</strong> antes de vender.
        </p>
      ) : null}

      <section className="sale-client-selector">
        <div>
          <span>Cliente de esta venta</span>

          <strong>{selectedClient?.nombre ?? "Venta normal"}</strong>

          <small>
            {repricing
              ? "Actualizando precios del carrito..."
              : selectedClient
                ? "Se aplicarán sus precios especiales."
                : "Se usarán los precios normales o por turno."}
          </small>
        </div>

        <button
          className="secondary-button"
          disabled={!cashShift || repricing}
          onClick={openClientPicker}
          type="button"
        >
          {selectedClient ? "Cambiar cliente" : "Seleccionar cliente"}
        </button>

        {showClientPicker ? (
          <div className="sale-client-picker">
            <input
              autoFocus
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="Buscar cliente por nombre o teléfono"
              value={clientSearch}
            />

            <button
              className="sale-client-picker__normal"
              onClick={() => selectSaleClient(null)}
              type="button"
            >
              <strong>Venta normal</strong>
              <small>Sin precio especial</small>
            </button>

            {searchingClients ? (
              <p>Buscando clientes...</p>
            ) : clientResults.length === 0 ? (
              <p>No se encontraron clientes.</p>
            ) : (
              clientResults.map((client) => (
                <button key={client.id} onClick={() => selectSaleClient(client)} type="button">
                  <strong>{client.nombre}</strong>
                  <small>{client.telefono || "Sin teléfono"}</small>
                </button>
              ))
            )}
          </div>
        ) : null}
      </section>

      <div className="sales-layout">
        <section className="sales-catalog">
          <form className="sales-search" onSubmit={handleSearch}>
            <span aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>

            <input
              autoFocus
              disabled={!cashShift}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Escanea el código o escribe el producto"
              ref={searchInputRef}
              value={search}
            />

            <kbd className="sales-search__hint" aria-hidden="true">
              /
            </kbd>
          </form>

          <div className="sales-catalog__heading">
            <h2>Productos</h2>

            <small>El precio mostrado ya corresponde al turno actual.</small>
          </div>

          {loading ? (
            <p className="empty-state">Cargando productos...</p>
          ) : products.length === 0 ? (
            <p className="empty-state">
              {search.trim()
                ? "No se encontró ningún producto."
                : "Escribe o escanea un producto para comenzar."}
            </p>
          ) : (
            <div className="sales-product-grid">
              {products.map((product) => (
                <button
                  className="sales-product-card"
                  disabled={product.stock <= 0}
                  key={product.presentacionId}
                  onClick={() => addProduct(product)}
                  type="button"
                >
                  <span className="sales-product-card__name">
                    <strong>{product.nombre}</strong>
                    <small>{product.presentacion}</small>
                  </span>

                  <span className="sales-product-card__price">L {formatMoney(product.precio)}</span>

                  <span className="sales-product-card__details">
                    <small>{priceLabel(product, selectedClient)}</small>

                    <small>
                      {formatQuantity(product.stock)} {unitLabel(product.tipoVenta)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="sales-cart">
          <div className="sales-cart__heading">
            <div>
              <p className="eyebrow">Recibo actual</p>
              <h2>Carrito</h2>
            </div>

            <span>{cart.length} productos</span>
          </div>

          {cart.length === 0 ? (
            <div className="sales-cart__empty">
              <span aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="19" cy="21" r="1" />
                  <path d="M2.5 3h2l2.8 12.5a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21.5 8H6" />
                </svg>
              </span>
              <strong>Carrito vacío</strong>
              <small>Escanea un producto para comenzar.</small>
            </div>
          ) : (
            <div className="sales-cart__items">
              {cart.map((item) => (
                <article className="cart-item" key={item.presentacionId}>
                  <div className="cart-item__top">
                    <div>
                      <strong>{item.nombre}</strong>

                      <small>L {formatMoney(item.precio)} cada uno</small>
                    </div>

                    <button
                      aria-label={`Quitar ${item.nombre}`}
                      className="cart-item__remove"
                      onClick={() => removeProduct(item.presentacionId)}
                      type="button"
                    >
                      ×
                    </button>
                  </div>

                  <div className="cart-item__bottom">
                    <label>
                      <span>Cantidad</span>

                      <input
                        max={item.stock}
                        min={
                          item.tipoVenta === "PESO" || item.tipoVenta === "VOLUMEN"
                            ? "0.001"
                            : "1"
                        }
                        onChange={(event) => updateQuantity(item.presentacionId, event.target.value)}
                        step={
                          item.tipoVenta === "PESO" || item.tipoVenta === "VOLUMEN"
                            ? "0.001"
                            : "1"
                        }
                        type="number"
                        value={item.cantidad}
                      />
                    </label>

                    <strong>L {formatMoney(item.precio * Number(item.cantidad || 0))}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="checkout">
            <div className="checkout__total">
              <span>Total a cobrar</span>
              <strong>L {formatMoney(total)}</strong>
            </div>

            <fieldset className="payment-methods">
              <legend>Método de pago</legend>

              <div>
                {PAYMENT_METHODS.map((method) => (
                  <label className="payment-method" key={method.value}>
                    <input
                      checked={paymentMethod === method.value}
                      name="metodoPago"
                      onChange={() => selectPaymentMethod(method.value)}
                      type="radio"
                    />

                    <span aria-hidden="true">
                      <PaymentIcon name={method.value} />
                    </span>

                    <strong>{method.label}</strong>
                  </label>
                ))}
              </div>
            </fieldset>

            {paymentMethod === "EFECTIVO" ? (
              <div className="cash-payment">
                <label className="field">
                  <span>Efectivo recibido</span>

                  <input
                    autoComplete="off"
                    onChange={(event) => updateMoneyValue(setReceivedAmount, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleCharge();
                      }
                    }}
                    placeholder="Escribe el monto"
                    type="text"
                    value={receivedAmount}
                  />
                </label>

                <div className="cash-payment__change">
                  <span>Cambio</span>
                  <strong>L {formatMoney(change)}</strong>
                </div>
              </div>
            ) : (
              <p className="electronic-payment-note">Confirma el pago antes de pulsar Cobrar.</p>
            )}

            <button
              className="charge-button"
              disabled={charging || cart.length === 0 || !cashShift}
              onClick={handleCharge}
              type="button"
            >
              {charging ? "Cobrando..." : `Cobrar L ${formatMoney(total)}`}
            </button>
          </div>
        </aside>
      </div>

      {lastSale ? (
        <div className="sale-confirmation" role="dialog" aria-modal="true">
          <div className="sale-confirmation__card">
            <span className="sale-confirmation__icon" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>

            <p className="eyebrow">Venta completada</p>
            <h2>Venta #{lastSale.id}</h2>

            <strong className="sale-confirmation__total">L {formatMoney(lastSale.total)}</strong>

            <p>
              {PAYMENT_METHODS.find((method) => method.value === lastSale.pago?.metodo)?.label}
            </p>

            {lastSale.cliente ? (
              <p className="sale-confirmation__client">
                Cliente: <strong>{lastSale.cliente.nombre}</strong>
              </p>
            ) : null}

            {lastSale.pago?.cambio > 0 ? (
              <div className="sale-confirmation__change">
                <span>Entregar cambio</span>

                <strong>L {formatMoney(lastSale.pago.cambio)}</strong>
              </div>
            ) : null}

            <button
              className="primary-button"
              onClick={() => {
                setLastSale(null);
                focusSearch();
              }}
              type="button"
            >
              Nueva venta
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}