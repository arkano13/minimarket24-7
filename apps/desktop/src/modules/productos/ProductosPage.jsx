import { useEffect, useState } from "react";

import {
  createCategory,
  createProduct,
  listCategories,
  listProducts,
  updateProduct,
} from "../../services/api.js";

const EMPTY_FORM = {
  nombre: "",
  codigoBarra: "",
  categoriaId: "",
  tipoVenta: "UNIDAD",
  costo: "",
  precio: "",
  cambiaPrecioTurno: false,
  precioTurno2: "",
  precioTurno3: "",
  stockInicial: "",
  stockMinimo: "",
  sku: "",
  descripcion: "",
};

const TYPE_LABELS = {
  UNIDAD: "Unidad",
  PAQUETE: "Paquete",
  CAJA: "Caja",
  PESO: "Peso (kilogramos)",
  VOLUMEN: "Volumen (litros)",
};

function formatNumber(value) {
  return new Intl.NumberFormat("es-HN", {
    maximumFractionDigits: 3,
  }).format(value);
}

export function ProductosPage({
  token,
  onBack,
}) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] =
    useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] =
    useState(false);
  const [
    showCategoryForm,
    setShowCategoryForm,
  ] = useState(false);
  const [categoryName, setCategoryName] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [
    editingProductId,
    setEditingProductId,
  ] = useState(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [
          categoryResult,
          productResult,
        ] = await Promise.all([
          listCategories(token),
          listProducts(token),
        ]);

        setCategories(
          categoryResult.categorias,
        );

        setProducts(
          productResult.productos,
        );
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [token]);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSearch(event) {
    event.preventDefault();
    setError("");

    try {
      const result = await listProducts(
        token,
        search,
      );

      setProducts(result.productos);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleCreateCategory(
    event,
  ) {
    event.preventDefault();
    setError("");

    try {
      const result = await createCategory(
        token,
        categoryName,
      );

      setCategories((current) =>
        [
          ...current.filter(
            (item) =>
              item.id !== result.categoria.id,
          ),
          result.categoria,
        ].sort((a, b) =>
          a.nombre.localeCompare(b.nombre),
        ),
      );

      setForm((current) => ({
        ...current,
        categoriaId: String(
          result.categoria.id,
        ),
      }));

      setCategoryName("");
      setShowCategoryForm(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleCreateProduct(
    event,
  ) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      if (editingProductId) {
        await updateProduct(
          token,
          editingProductId,
          form,
        );
      } else {
        await createProduct(token, form);
      }

      const result =
        await listProducts(token);

      setProducts(result.productos);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingProductId(null);

      setSuccess(
        editingProductId
          ? "Producto actualizado correctamente."
          : "Producto registrado correctamente.",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function closeForm() {
    setForm(EMPTY_FORM);
    setShowForm(false);
    setShowCategoryForm(false);
    setCategoryName("");
    setEditingProductId(null);
    setError("");
  }

  function startEditing(product) {
    const presentation =
      product.presentacionPrincipal;

    const shiftTwoPrice =
      presentation?.preciosTurno?.find(
        (shiftPrice) =>
          shiftPrice.turno === 2,
      );

    const shiftThreePrice =
      presentation?.preciosTurno?.find(
        (shiftPrice) =>
          shiftPrice.turno === 3,
      );

    setForm({
      nombre: product.nombre ?? "",

      codigoBarra:
        presentation?.codigoBarra ?? "",

      categoriaId: product.categoria?.id
        ? String(product.categoria.id)
        : "",

      tipoVenta:
        presentation?.tipo ?? "UNIDAD",

      costo: String(product.costo ?? ""),

      precio: String(
        presentation?.precio ?? "",
      ),

      cambiaPrecioTurno:
        product.modoPrecio ===
        "POR_HORARIO",

      precioTurno2: shiftTwoPrice
        ? String(shiftTwoPrice.precio)
        : "",

      precioTurno3: shiftThreePrice
        ? String(shiftThreePrice.precio)
        : "",

      stockInicial: String(
        product.stock ?? "",
      ),

      stockMinimo: String(
        product.stockMinimo ?? "",
      ),

      sku: product.sku ?? "",

      descripcion:
        product.descripcion ?? "",
    });

    setEditingProductId(product.id);
    setShowForm(true);
    setShowCategoryForm(false);
    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  const stockLabel =
    form.tipoVenta === "PESO"
      ? "Kilogramos"
      : form.tipoVenta === "VOLUMEN"
        ? "Litros"
        : "Cantidad";

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          {onBack ? (
            <button
              className="back-button"
              onClick={onBack}
              type="button"
            >
              ← Volver
            </button>
          ) : null}

          <p className="eyebrow">
            Catálogo
          </p>

          <h1>Productos</h1>

          <p>
            Registra y encuentra productos
            sin navegar por varias pantallas.
          </p>
        </div>

        <button
          className="primary-button workspace-header__action"
          onClick={() => {
            if (showForm) {
              closeForm();
            } else {
              setForm(EMPTY_FORM);
              setEditingProductId(null);
              setShowForm(true);
              setError("");
              setSuccess("");
            }
          }}
          type="button"
        >
          {showForm
            ? "Cerrar formulario"
            : "+ Nuevo producto"}
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
        <section className="product-form-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {editingProductId
                  ? "Editar registro"
                  : "Nuevo registro"}
              </p>

              <h2>
                {editingProductId
                  ? "Editar producto"
                  : "Agregar producto"}
              </h2>
            </div>

            <p>
              {editingProductId
                ? "Corrige los datos y guarda los cambios."
                : "Completa únicamente los datos que conozcas."}
            </p>
          </div>

          <form
            className="product-form"
            onSubmit={
              handleCreateProduct
            }
          >
            <label className="field">
              <span>
                Nombre del producto *
              </span>

              <input
                autoFocus
                name="nombre"
                onChange={updateField}
                placeholder="Ejemplo: Agua purificada 600 ml"
                required
                value={form.nombre}
              />
            </label>

            <label className="field">
              <span>
                Código de barras
              </span>

              <input
                name="codigoBarra"
                onChange={updateField}
                placeholder="Escanea o escribe el código"
                value={form.codigoBarra}
              />
            </label>

            <div className="category-field">
              <label className="field">
                <span>Categoría</span>

                <select
                  name="categoriaId"
                  onChange={updateField}
                  value={form.categoriaId}
                >
                  <option value="">
                    Sin categoría
                  </option>

                  {categories.map(
                    (category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.nombre}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <button
                className="text-button"
                onClick={() =>
                  setShowCategoryForm(
                    (current) =>
                      !current,
                  )
                }
                type="button"
              >
                + Nueva categoría
              </button>
            </div>

            {showCategoryForm ? (
              <div className="inline-form">
                <label className="field">
                  <span>
                    Nombre de la categoría
                  </span>

                  <input
                    onChange={(event) =>
                      setCategoryName(
                        event.target.value,
                      )
                    }
                    placeholder="Ejemplo: Bebidas"
                    value={categoryName}
                  />
                </label>

                <button
                  className="secondary-button"
                  disabled={
                    !categoryName.trim()
                  }
                  onClick={
                    handleCreateCategory
                  }
                  type="button"
                >
                  Guardar categoría
                </button>
              </div>
            ) : null}

            <label className="field">
              <span>
                ¿Cómo se vende? *
              </span>

              <select
                disabled={Boolean(
                  editingProductId,
                )}
                name="tipoVenta"
                onChange={updateField}
                value={form.tipoVenta}
              >
                {Object.entries(
                  TYPE_LABELS,
                ).map(
                  ([value, label]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  ),
                )}
              </select>

              {editingProductId ? (
                <small>
                  La forma de venta no se
                  cambia después de registrar
                  el producto.
                </small>
              ) : null}
            </label>

            <div className="form-row">
              <label className="field">
                <span>Costo</span>

                <input
                  min="0"
                  name="costo"
                  onChange={updateField}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={form.costo}
                />
              </label>

              <label className="field">
                <span>
                  Precio de venta *
                </span>

                <input
                  min="0.01"
                  name="precio"
                  onChange={updateField}
                  placeholder="0.00"
                  required
                  step="0.01"
                  type="number"
                  value={form.precio}
                />
              </label>
            </div>

            <fieldset className="price-mode">
              <legend>
                ¿El precio cambia según el
                turno?
              </legend>

              <div className="price-mode__options">
                <label className="radio-option">
                  <input
                    checked={
                      !form.cambiaPrecioTurno
                    }
                    name="modoPrecio"
                    onChange={() =>
                      setForm(
                        (current) => ({
                          ...current,

                          cambiaPrecioTurno:
                            false,

                          precioTurno2: "",

                          precioTurno3: "",
                        }),
                      )
                    }
                    type="radio"
                  />

                  <span>
                    <strong>
                      Mismo precio todo el día
                    </strong>

                    <small>
                      Usará siempre el precio
                      normal.
                    </small>
                  </span>
                </label>

                <label className="radio-option">
                  <input
                    checked={
                      form.cambiaPrecioTurno
                    }
                    name="modoPrecio"
                    onChange={() =>
                      setForm(
                        (current) => ({
                          ...current,

                          cambiaPrecioTurno:
                            true,
                        }),
                      )
                    }
                    type="radio"
                  />

                  <span>
                    <strong>
                      Cambia según el turno
                    </strong>

                    <small>
                      El precio normal se usa
                      de 8 a. m. a 10 p. m.
                    </small>
                  </span>
                </label>
              </div>

              {form.cambiaPrecioTurno ? (
                <div className="form-row price-mode__shift-fields">
                  <label className="field">
                    <span>
                      Precio turno 2 · 10
                      p. m. a 2 a. m. *
                    </span>

                    <input
                      min="0.01"
                      name="precioTurno2"
                      onChange={updateField}
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={
                        form.precioTurno2
                      }
                    />
                  </label>

                  <label className="field">
                    <span>
                      Precio turno 3 · 2
                      a. m. a 8 a. m. *
                    </span>

                    <input
                      min="0.01"
                      name="precioTurno3"
                      onChange={updateField}
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={
                        form.precioTurno3
                      }
                    />
                  </label>
                </div>
              ) : null}
            </fieldset>

            <div className="form-row">
              <label className="field">
                <span>
                  {editingProductId
                    ? `${stockLabel} actuales`
                    : `${stockLabel} disponibles`}
                </span>

                <input
                  min="0"
                  name="stockInicial"
                  onChange={updateField}
                  placeholder="0"
                  step="0.001"
                  type="number"
                  value={
                    form.stockInicial
                  }
                />
              </label>

              <label className="field">
                <span>
                  Avisar cuando queden
                </span>

                <input
                  min="0"
                  name="stockMinimo"
                  onChange={updateField}
                  placeholder="0"
                  step="0.001"
                  type="number"
                  value={
                    form.stockMinimo
                  }
                />
              </label>
            </div>

            <details className="optional-fields">
              <summary>
                Datos opcionales
              </summary>

              <div className="form-row">
                <label className="field">
                  <span>
                    Código interno
                  </span>

                  <input
                    name="sku"
                    onChange={updateField}
                    placeholder="Ejemplo: BEB-001"
                    value={form.sku}
                  />
                </label>

                <label className="field">
                  <span>
                    Descripción
                  </span>

                  <input
                    name="descripcion"
                    onChange={updateField}
                    placeholder="Información adicional"
                    value={
                      form.descripcion
                    }
                  />
                </label>
              </div>
            </details>

            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={closeForm}
                type="button"
              >
                Cancelar
              </button>

              <button
                className="primary-button"
                disabled={saving}
                type="submit"
              >
                {saving
                  ? "Guardando..."
                  : editingProductId
                    ? "Guardar cambios"
                    : "Guardar producto"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="product-list-card">
        <form
          className="search-bar"
          onSubmit={handleSearch}
        >
          <input
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Buscar por nombre, código o SKU"
            value={search}
          />

          <button
            className="secondary-button"
            type="submit"
          >
            Buscar
          </button>
        </form>

        {loading ? (
          <p className="empty-state">
            Cargando productos...
          </p>
        ) : products.length === 0 ? (
          <p className="empty-state">
            No hay productos registrados.
            Pulsa “Nuevo producto” para
            comenzar.
          </p>
        ) : (
          <div className="product-table-wrapper">
            <table className="product-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Presentación</th>
                  <th>Existencia</th>
                  <th>Precio</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {products.map(
                  (product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>
                          {product.nombre}
                        </strong>

                        <small>
                          {product.categoria
                            ?.nombre ??
                            "Sin categoría"}
                        </small>
                      </td>

                      <td>
                        {product
                          .presentacionPrincipal
                          ?.codigoBarra ??
                          product.sku ??
                          "—"}
                      </td>

                      <td>
                        {product
                          .presentacionPrincipal
                          ?.nombre ?? "—"}
                      </td>

                      <td>
                        {formatNumber(
                          product.stock,
                        )}
                      </td>

                      <td>
                        {product.presentacionPrincipal ? (
                          <span className="price-cell">
                            <strong>
                              {Number(
                                product
                                  .presentacionPrincipal
                                  .precio,
                              ).toFixed(2)}
                            </strong>

                            <small>
                              {product.modoPrecio ===
                              "POR_HORARIO"
                                ? "Por turno"
                                : "Todo el día"}
                            </small>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td>
                        <button
                          className="secondary-button product-edit-button"
                          onClick={() =>
                            startEditing(
                              product,
                            )
                          }
                          type="button"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}