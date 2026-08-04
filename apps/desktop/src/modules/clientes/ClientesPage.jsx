import { useEffect, useState } from "react";
import "./ClientesPage.css";
import {
  createSpecialClient,
  listSpecialClients,
  removeClientSpecialPrice,
  searchSpecialPriceProducts,
  setClientSpecialPrice,
} from "../../services/api.js";

function formatMoney(value) {
  return new Intl.NumberFormat("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function updateMoneyValue(setter, value) {
  const normalized = value.replace(",", ".");

  if (normalized === "" || /^\d+(\.\d{0,2})?$/.test(normalized)) {
    setter(normalized);
  }
}

export function ClientesPage({ token }) {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [specialPrice, setSpecialPrice] = useState("");

  const [loading, setLoading] = useState(false);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      try {
        const result = await listSpecialClients(token, clientSearch.trim());

        if (active) {
          setClients(result.clientes);

          setSelectedClient((current) =>
            current ? result.clientes.find((client) => client.id === current.id) ?? null : null,
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
  }, [clientSearch, token]);

  useEffect(() => {
    const term = productSearch.trim();

    if (!selectedClient || !term) {
      setProductResults([]);
      setSearchingProducts(false);
      return undefined;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setSearchingProducts(true);

      try {
        const result = await searchSpecialPriceProducts(token, term);

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
  }, [productSearch, selectedClient, token]);

  function updateClientEverywhere(updatedClient) {
    setClients((current) =>
      current
        .map((client) => (client.id === updatedClient.id ? updatedClient : client))
        .sort((first, second) => first.nombre.localeCompare(second.nombre)),
    );

    setSelectedClient(updatedClient);
  }

  async function handleCreateClient(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await createSpecialClient(token, {
        nombre: name,
        telefono: phone,
        notas: notes,
      });

      setClients((current) =>
        [...current, result.cliente].sort((first, second) =>
          first.nombre.localeCompare(second.nombre),
        ),
      );

      setSelectedClient(result.cliente);
      setName("");
      setPhone("");
      setNotes("");
      setShowForm(false);
      setSuccess("Cliente creado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function selectClient(client) {
    setSelectedClient(client);
    setProductSearch("");
    setProductResults([]);
    setSelectedProduct(null);
    setSpecialPrice("");
    setError("");
    setSuccess("");
  }

  function selectProduct(product) {
    const currentPrice = selectedClient.precios.find(
      (price) => price.presentacionId === product.presentacionId,
    );

    setSelectedProduct(product);
    setSpecialPrice(currentPrice ? String(currentPrice.precio) : "");
    setProductSearch("");
    setProductResults([]);
  }

  async function handleSetPrice(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedClient || !selectedProduct) {
      setError("Selecciona un producto.");
      return;
    }

    setLoading(true);

    try {
      const result = await setClientSpecialPrice(token, selectedClient.id, {
        presentacionId: selectedProduct.presentacionId,
        precio: specialPrice,
      });

      updateClientEverywhere(result.cliente);
      setSelectedProduct(null);
      setSpecialPrice("");
      setSuccess("Precio especial guardado correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemovePrice(presentationId) {
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await removeClientSpecialPrice(token, selectedClient.id, presentationId);

      updateClientEverywhere(result.cliente);
      setSuccess("Precio especial eliminado.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="clients-page">
      <header className="clients-header">
        <div>
          <p className="eyebrow">Precios personalizados</p>
          <h1>Clientes especiales</h1>
          <p>Asigna precios fijos a productos específicos de cada cliente.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowForm((current) => !current)}
          type="button"
        >
          {showForm ? "Cancelar" : "+ Nuevo cliente"}
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
        <section className="client-create-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nuevo registro</p>
              <h2>Crear cliente</h2>
            </div>
          </div>

          <form className="client-create-form" onSubmit={handleCreateClient}>
            <label className="field">
              <span>Nombre</span>
              <input
                autoFocus
                maxLength="120"
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre del cliente"
                required
                value={name}
              />
            </label>

            <label className="field">
              <span>Teléfono opcional</span>
              <input
                maxLength="30"
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Número de teléfono"
                value={phone}
              />
            </label>

            <label className="field client-create-form__notes">
              <span>Nota opcional</span>
              <input
                maxLength="250"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Información útil sobre el cliente"
                value={notes}
              />
            </label>

            <button className="primary-button" disabled={loading} type="submit">
              {loading ? "Guardando..." : "Guardar cliente"}
            </button>
          </form>
        </section>
      ) : null}

      <div className="clients-layout">
        <aside className="client-list-card">
          <div className="client-search">
            <input
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="Buscar cliente"
              value={clientSearch}
            />
          </div>

          <div className="client-list">
            {clients.length === 0 ? (
              <p className="empty-state">No hay clientes para mostrar.</p>
            ) : (
              clients.map((client) => (
                <button
                  className={`client-list-item ${
                    selectedClient?.id === client.id ? "client-list-item--selected" : ""
                  }`}
                  key={client.id}
                  onClick={() => selectClient(client)}
                  type="button"
                >
                  <span>
                    <strong>{client.nombre}</strong>
                    <small>{client.telefono || "Sin teléfono"}</small>
                  </span>

                  <b>{client.precios.length}</b>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="client-detail-card">
          {!selectedClient ? (
            <div className="client-detail-empty">
              <span aria-hidden="true">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="8" r="3.2" />
                  <path d="M2.5 19.5c0-3.3 2.9-5.8 6.5-5.8s6.5 2.5 6.5 5.8" />
                  <path d="M16.5 5.2a3.2 3.2 0 0 1 0 6.2" />
                  <path d="M18.5 14.3c2.3.6 4 2.6 4 5.2" />
                </svg>
              </span>
              <h2>Selecciona un cliente</h2>
              <p>Después podrás agregar los productos con precio especial.</p>
            </div>
          ) : (
            <>
              <header className="client-detail-header">
                <div>
                  <p className="eyebrow">Cliente seleccionado</p>
                  <h2>{selectedClient.nombre}</h2>
                  <p>
                    {selectedClient.telefono || "Sin teléfono"}
                    {selectedClient.notas ? ` · ${selectedClient.notas}` : ""}
                  </p>
                </div>

                <span>{selectedClient.precios.length} precios</span>
              </header>

              <section className="special-price-form-card">
                <h3>Agregar precio especial</h3>

                <div className="special-product-search">
                  <input
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Busca por nombre, SKU o código"
                    value={productSearch}
                  />

                  {productSearch.trim() ? (
                    <div className="special-product-results">
                      {searchingProducts ? (
                        <p>Buscando...</p>
                      ) : productResults.length === 0 ? (
                        <p>No se encontraron productos.</p>
                      ) : (
                        productResults.map((product) => (
                          <button
                            key={product.presentacionId}
                            onClick={() => selectProduct(product)}
                            type="button"
                          >
                            <span>
                              <strong>{product.nombre}</strong>
                              <small>{product.presentacion}</small>
                            </span>

                            <b>L {formatMoney(product.precioNormal)}</b>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>

                {selectedProduct ? (
                  <form className="selected-special-product" onSubmit={handleSetPrice}>
                    <div>
                      <span>Producto seleccionado</span>
                      <strong>{selectedProduct.nombre}</strong>
                      <small>
                        {selectedProduct.presentacion} · Normal L{" "}
                        {formatMoney(selectedProduct.precioNormal)}
                      </small>
                    </div>

                    <label className="field">
                      <span>Precio especial</span>
                      <input
                        autoComplete="off"
                        onChange={(event) => updateMoneyValue(setSpecialPrice, event.target.value)}
                        placeholder="Escribe el precio"
                        required
                        type="text"
                        value={specialPrice}
                      />
                    </label>

                    <button className="primary-button" disabled={loading} type="submit">
                      Guardar precio
                    </button>
                  </form>
                ) : null}
              </section>

              <section className="special-price-list">
                <div className="section-heading">
                  <h3>Productos con precio especial</h3>
                </div>

                {selectedClient.precios.length === 0 ? (
                  <p className="empty-state">Este cliente todavía no tiene precios especiales.</p>
                ) : (
                  <div className="special-price-table-wrapper">
                    <table className="special-price-table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th>Normal</th>
                          <th>Especial</th>
                          <th />
                        </tr>
                      </thead>

                      <tbody>
                        {selectedClient.precios.map((price) => (
                          <tr key={price.id}>
                            <td>
                              <strong>{price.producto.nombre}</strong>
                              <small>{price.presentacion}</small>
                            </td>

                            <td>L {formatMoney(price.precioNormal)}</td>

                            <td className="special-price-value">L {formatMoney(price.precio)}</td>

                            <td>
                              <button
                                className="client-remove-price"
                                disabled={loading}
                                onClick={() => handleRemovePrice(price.presentacionId)}
                                type="button"
                              >
                                Quitar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      </div>
    </main>
  );
}