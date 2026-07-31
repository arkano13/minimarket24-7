import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createInventoryMovement,
  listInventoryMovements,
  listProducts,
} from "../../services/api.js";

const EMPTY_FORM = {
  productoId: "",
  tipoMovimiento: "ENTRADA",
  cantidad: "",
  costo: "",
  motivo: "",
};

const MOVEMENT_LABELS = {
  INVENTARIO_INICIAL:
    "Inventario inicial",

  COMPRA: "Entrada",
  VENTA: "Venta",

  DEVOLUCION_CLIENTE:
    "Devolución de cliente",

  DEVOLUCION_PROVEEDOR:
    "Devolución a proveedor",

  AJUSTE_POSITIVO:
    "Ajuste positivo",

  AJUSTE_NEGATIVO:
    "Salida",

  CANCELACION_VENTA:
    "Cancelación de venta",
};

const NEGATIVE_MOVEMENTS = new Set([
  "VENTA",
  "DEVOLUCION_PROVEEDOR",
  "AJUSTE_NEGATIVO",
]);

function formatNumber(value) {
  return new Intl.NumberFormat(
    "es-HN",
    {
      maximumFractionDigits: 3,
    },
  ).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(
    "es-HN",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(new Date(value));
}

function getUnitLabel(product) {
  const type =
    product?.presentacionPrincipal
      ?.tipo;

  if (type === "PESO") {
    return "kilogramos";
  }

  if (type === "VOLUMEN") {
    return "litros";
  }

  return "unidades";
}

function getSingularUnitLabel(product) {
  const type =
    product?.presentacionPrincipal
      ?.tipo;

  if (type === "PESO") {
    return "kilogramo";
  }

  if (type === "VOLUMEN") {
    return "litro";
  }

  return "unidad";
}

export function InventarioPage({
  token,
}) {
  const [products, setProducts] =
    useState([]);

  const [movements, setMovements] =
    useState([]);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [
    productSearch,
    setProductSearch,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) =>
          product.id ===
          Number(form.productoId),
      ) ?? null,

    [form.productoId, products],
  );

  const unitLabel =
    getUnitLabel(selectedProduct);

  const singularUnitLabel =
    getSingularUnitLabel(
      selectedProduct,
    );

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [
          productResult,
          movementResult,
        ] = await Promise.all([
          listProducts(token),

          listInventoryMovements(
            token,
          ),
        ]);

        setProducts(
          productResult.productos,
        );

        setMovements(
          movementResult.movimientos,
        );
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [token]);

  function selectMovementType(type) {
    setForm((current) => ({
      ...current,

      tipoMovimiento: type,

      costo:
        type === "ENTRADA" &&
        selectedProduct
          ? String(
              selectedProduct.costo ??
                "",
            )
          : "",

      motivo: "",
    }));

    setError("");
    setSuccess("");
  }

  function selectProduct(event) {
    const productId =
      event.target.value;

    const product =
      products.find(
        (item) =>
          item.id ===
          Number(productId),
      ) ?? null;

    setForm((current) => ({
      ...current,

      productoId: productId,

      costo:
        current.tipoMovimiento ===
          "ENTRADA" && product
          ? String(
              product.costo ?? "",
            )
          : "",
    }));
  }

  async function handleProductSearch(
    event,
  ) {
    event.preventDefault();
    setError("");

    try {
      const result =
        await listProducts(
          token,
          productSearch,
        );

      setProducts(result.productos);

      setForm((current) => ({
        ...current,
        productoId: "",
        costo: "",
      }));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      await createInventoryMovement(
        token,
        form,
      );

      const [
        productResult,
        movementResult,
      ] = await Promise.all([
        listProducts(
          token,
          productSearch,
        ),

        listInventoryMovements(token),
      ]);

      setProducts(
        productResult.productos,
      );

      setMovements(
        movementResult.movimientos,
      );

      setForm(EMPTY_FORM);

      setSuccess(
        form.tipoMovimiento ===
        "ENTRADA"
          ? "Entrada registrada correctamente."
          : "Salida registrada correctamente.",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">
            Existencias
          </p>

          <h1>Inventario</h1>

          <p>
            Registra entradas y salidas
            sin modificar las ventas.
          </p>
        </div>
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

      <section className="inventory-form-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              Nuevo movimiento
            </p>

            <h2>
              Actualizar existencia
            </h2>
          </div>

          <p>
            Elige qué ocurrió y completa
            la cantidad.
          </p>
        </div>

        <form
          className="inventory-form"
          onSubmit={handleSubmit}
        >
          <fieldset className="movement-type">
            <legend>
              ¿Qué deseas registrar?
            </legend>

            <div className="movement-type__options">
              <label className="movement-option movement-option--entry">
                <input
                  checked={
                    form.tipoMovimiento ===
                    "ENTRADA"
                  }
                  name="tipoMovimiento"
                  onChange={() =>
                    selectMovementType(
                      "ENTRADA",
                    )
                  }
                  type="radio"
                />

                <span>
                  <strong>
                    ＋ Entrada
                  </strong>

                  <small>
                    Recibí más producto.
                  </small>
                </span>
              </label>

              <label className="movement-option movement-option--exit">
                <input
                  checked={
                    form.tipoMovimiento ===
                    "SALIDA"
                  }
                  name="tipoMovimiento"
                  onChange={() =>
                    selectMovementType(
                      "SALIDA",
                    )
                  }
                  type="radio"
                />

                <span>
                  <strong>
                    − Salida
                  </strong>

                  <small>
                    Producto perdido, dañado
                    o retirado.
                  </small>
                </span>
              </label>
            </div>
          </fieldset>

          <div className="inventory-product-search">
            <input
              onChange={(event) =>
                setProductSearch(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  handleProductSearch(
                    event,
                  );
                }
              }}
              placeholder="Buscar producto por nombre, código o SKU"
              value={productSearch}
            />

            <button
              className="secondary-button"
              onClick={
                handleProductSearch
              }
              type="button"
            >
              Buscar
            </button>
          </div>

          <label className="field inventory-form__product">
            <span>Producto *</span>

            <select
              name="productoId"
              onChange={selectProduct}
              required
              value={form.productoId}
            >
              <option value="">
                Selecciona un producto
              </option>

              {products.map(
                (product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.nombre} ·{" "}
                    {formatNumber(
                      product.stock,
                    )}{" "}
                    disponibles
                  </option>
                ),
              )}
            </select>
          </label>

          {selectedProduct ? (
            <div className="stock-summary">
              <span>
                Existencia actual
              </span>

              <strong>
                {formatNumber(
                  selectedProduct.stock,
                )}{" "}
                {unitLabel}
              </strong>
            </div>
          ) : null}

          <div className="form-row">
            <label className="field">
              <span>
                Cantidad en {unitLabel} *
              </span>

              <input
                min="0.001"
                name="cantidad"
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      cantidad:
                        event.target.value,
                    }),
                  )
                }
                placeholder="0"
                required
                step="0.001"
                type="number"
                value={form.cantidad}
              />
            </label>

            {form.tipoMovimiento ===
            "ENTRADA" ? (
              <label className="field">
                <span>
                  Costo por{" "}
                  {singularUnitLabel}
                </span>

                <input
                  min="0.01"
                  name="costo"
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,

                        costo:
                          event.target
                            .value,
                      }),
                    )
                  }
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={form.costo}
                />

                <small>
                  Déjalo vacío si el costo
                  no cambió.
                </small>
              </label>
            ) : (
              <label className="field">
                <span>
                  Motivo de la salida *
                </span>

                <input
                  maxLength="250"
                  name="motivo"
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,

                        motivo:
                          event.target
                            .value,
                      }),
                    )
                  }
                  placeholder="Ejemplo: Producto dañado"
                  required
                  value={form.motivo}
                />
              </label>
            )}
          </div>

          {form.tipoMovimiento ===
          "ENTRADA" ? (
            <label className="field inventory-form__reason">
              <span>Nota opcional</span>

              <input
                maxLength="250"
                name="motivo"
                onChange={(event) =>
                  setForm(
                    (current) => ({
                      ...current,

                      motivo:
                        event.target.value,
                    }),
                  )
                }
                placeholder="Ejemplo: Compra semanal"
                value={form.motivo}
              />
            </label>
          ) : null}

          <div className="form-actions">
            <button
              className={
                form.tipoMovimiento ===
                "ENTRADA"
                  ? "primary-button"
                  : "danger-button"
              }
              disabled={
                saving ||
                products.length === 0
              }
              type="submit"
            >
              {saving
                ? "Guardando..."
                : form.tipoMovimiento ===
                    "ENTRADA"
                  ? "Guardar entrada"
                  : "Guardar salida"}
            </button>
          </div>
        </form>
      </section>

      <section className="inventory-history-card">
        <div className="section-heading inventory-history__heading">
          <div>
            <p className="eyebrow">
              Historial
            </p>

            <h2>
              Últimos movimientos
            </h2>
          </div>

          <p>
            Se muestran los 100
            movimientos más recientes.
          </p>
        </div>

        {loading ? (
          <p className="empty-state">
            Cargando inventario...
          </p>
        ) : movements.length === 0 ? (
          <p className="empty-state">
            Todavía no hay movimientos
            de inventario.
          </p>
        ) : (
          <div className="product-table-wrapper">
            <table className="product-table inventory-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Movimiento</th>
                  <th>Cantidad</th>
                  <th>
                    Existencia final
                  </th>
                  <th>Usuario</th>
                  <th>Motivo</th>
                </tr>
              </thead>

              <tbody>
                {movements.map(
                  (movement) => {
                    const negative =
                      NEGATIVE_MOVEMENTS.has(
                        movement.tipo,
                      );

                    return (
                      <tr
                        key={movement.id}
                      >
                        <td>
                          {formatDate(
                            movement.creadoEn,
                          )}
                        </td>

                        <td>
                          <strong>
                            {
                              movement
                                .producto
                                .nombre
                            }
                          </strong>

                          <small>
                            {
                              movement
                                .producto
                                .presentacion
                            }
                          </small>
                        </td>

                        <td>
                          <span
                            className={`movement-badge ${
                              negative
                                ? "movement-badge--negative"
                                : "movement-badge--positive"
                            }`}
                          >
                            {MOVEMENT_LABELS[
                              movement
                                .tipo
                            ] ??
                              movement.tipo}
                          </span>
                        </td>

                        <td
                          className={
                            negative
                              ? "quantity-negative"
                              : "quantity-positive"
                          }
                        >
                          {negative
                            ? "−"
                            : "+"}

                          {formatNumber(
                            movement.cantidad,
                          )}
                        </td>

                        <td>
                          {formatNumber(
                            movement.saldoPosterior,
                          )}
                        </td>

                        <td>
                          {movement.usuario
                            ?.nombre ??
                            "Sistema"}
                        </td>

                        <td>
                          {movement.motivo ??
                            "—"}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}