import { useEffect, useState } from "react";
import "./ProductosPage.css";

import {
  addPresentation,
  createCategory,
  createProduct,
  getProductComponents,
  listCategories,
  listPresentations,
  listProducts,
  removePresentation,
  setProductComponents,
  updatePresentation,
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

// Presentaciones: la cantidad se escribe en la unidad en que se vende el
// producto (unidades, libras, litros). Al guardar se convierte a la unidad
// de inventario multiplicando por el factor de la presentación principal.
const EMPTY_PRESENTATION_FORM = {
  nombre: "",
  cantidad: "",
  precio: "",
  codigoBarra: "",
};

// Factor de la presentación principal según cómo se vende el producto.
// Debe coincidir con TIPOS_VENTA de productos.service.js.
const BASE_FACTORS = {
  UNIDAD: 1,
  PAQUETE: 1,
  CAJA: 1,
  PESO: 454,
  VOLUMEN: 1000,
};

const BASE_UNIT_LABELS = {
  UNIDAD: "unidades",
  PAQUETE: "paquetes",
  CAJA: "cajas",
  PESO: "lb",
  VOLUMEN: "L",
};

function presentationTypeFor(baseType) {
  if (baseType === "PESO" || baseType === "VOLUMEN") {
    return baseType;
  }

  return "PAQUETE";
}

const TYPE_LABELS = {
  UNIDAD: "Unidad",
  PAQUETE: "Paquete",
  CAJA: "Caja",
  PESO: "Peso (libras)",
  VOLUMEN: "Volumen (litros)",
};

function formatNumber(value) {
  return new Intl.NumberFormat("es-HN", {
    maximumFractionDigits: 3,
  }).format(value);
}

export function ProductosPage({ token, onBack }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingProductId, setEditingProductId] = useState(null);
  const [formSnapshot, setFormSnapshot] = useState(EMPTY_FORM);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [isComposite, setIsComposite] = useState(false);
  const [components, setComponents] = useState([]);
  const [componentSearch, setComponentSearch] = useState("");
  const [componentResults, setComponentResults] = useState([]);
  const [searchingComponents, setSearchingComponents] = useState(false);

  // --- Presentaciones adicionales (six-pack, caja, paquete, etc.) ---
  const [presentations, setPresentations] = useState([]);
  const [loadingPresentations, setLoadingPresentations] = useState(false);
  const [presentationForm, setPresentationForm] = useState(EMPTY_PRESENTATION_FORM);
  const [editingPresentationId, setEditingPresentationId] = useState(null);
  const [savingPresentation, setSavingPresentation] = useState(false);
  const [presentationError, setPresentationError] = useState("");
  // Mientras el producto no existe, las presentaciones se arman en esta
  // lista local y se guardan justo después de crear el producto.
  const [draftPresentations, setDraftPresentations] = useState([]);
  const [showCompositeSection, setShowCompositeSection] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalProducts / perPage));

  async function loadProducts(targetPage = 1) {
    const result = await listProducts(token, search, targetPage);

    setProducts(result.productos);
    setTotalProducts(result.total);
    setPerPage(result.perPage);
    setPage(result.page);
  }

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [categoryResult] = await Promise.all([
          listCategories(token),
          loadProducts(1),
        ]);

        setCategories(categoryResult.categorias);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, [token]);

  useEffect(() => {
    if (!isComposite || !componentSearch.trim()) {
      setComponentResults([]);
      return undefined;
    }

    let active = true;

    const timer = window.setTimeout(async () => {
      setSearchingComponents(true);

      try {
        const result = await listProducts(token, componentSearch.trim(), 1, 10);

        if (active) {
          setComponentResults(result.productos);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
        }
      } finally {
        if (active) {
          setSearchingComponents(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [componentSearch, isComposite, token]);

  function updateField(event) {
    const { name, value } = event.target;

    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSearch(event) {
    event.preventDefault();
    setError("");

    try {
      await loadProducts(1);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function addComponent(product) {
    setComponents((current) => {
      if (current.some((item) => item.productoId === product.id)) {
        return current;
      }

      return [
        ...current,
        {
          productoId: product.id,
          nombre: product.nombre,
          tipo: product.presentacionPrincipal?.tipo ?? "UNIDAD",
          cantidad: "",
        },
      ];
    });

    setComponentSearch("");
    setComponentResults([]);
  }

  function updateComponentQuantity(productoId, value) {
    setComponents((current) =>
      current.map((item) =>
        item.productoId === productoId ? { ...item, cantidad: value } : item,
      ),
    );
  }

  function removeComponent(productoId) {
    setComponents((current) => current.filter((item) => item.productoId !== productoId));
  }

  async function handleCreateCategory(event) {
    event.preventDefault();
    setError("");

    try {
      const result = await createCategory(token, categoryName);

      setCategories((current) =>
        [
          ...current.filter((item) => item.id !== result.categoria.id),
          result.categoria,
        ].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      );

      setForm((current) => ({
        ...current,
        categoriaId: String(result.categoria.id),
      }));

      setCategoryName("");
      setShowCategoryForm(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleCreateProduct(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (isComposite) {
      if (components.length === 0) {
        setError("Agrega al menos un componente, o desactiva 'Producto compuesto'.");
        return;
      }

      if (components.some((item) => !item.cantidad || Number(item.cantidad) <= 0)) {
        setError("Escribe una cantidad válida para cada componente.");
        return;
      }
    }

    setSaving(true);

    try {
      let productId = editingProductId;

      if (editingProductId) {
        await updateProduct(token, editingProductId, form);
      } else {
        const result = await createProduct(token, form);
        productId = result.producto.id;
      }

      if (isComposite || editingProductId) {
        await setProductComponents(
          token,
          productId,
          isComposite
            ? components.map((item) => ({
                productoId: item.productoId,
                cantidad: Number(item.cantidad),
              }))
            : [],
        );
      }

      const failedPresentations = [];

      if (!editingProductId && draftPresentations.length > 0) {
        for (const draft of draftPresentations) {
          try {
            await addPresentation(token, productId, toPresentationPayload(draft));
          } catch (requestError) {
            failedPresentations.push(`${draft.nombre}: ${requestError.message}`);
          }
        }
      }

      const savedDrafts = draftPresentations.length - failedPresentations.length;

      await loadProducts(1);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setEditingProductId(null);
      setIsComposite(false);
      setComponents([]);
      setShowCompositeSection(false);
      resetPresentationState();

      if (failedPresentations.length > 0) {
        setError(
          `El producto se guardó, pero estas presentaciones no: ${failedPresentations.join(" · ")}. Edita el producto para agregarlas.`,
        );
      }

      setSuccess(
        editingProductId
          ? "Producto actualizado correctamente."
          : savedDrafts > 0
            ? `Producto registrado con ${savedDrafts} presentación(es) adicional(es).`
            : "Producto registrado correctamente.",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function closeForm() {
    const hasUnsavedChanges =
      JSON.stringify(form) !== JSON.stringify(formSnapshot) ||
      draftPresentations.length > 0 ||
      JSON.stringify(presentationForm) !== JSON.stringify(EMPTY_PRESENTATION_FORM);

    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
      return;
    }

    resetForm();
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setShowForm(false);
    setShowCategoryForm(false);
    setCategoryName("");
    setEditingProductId(null);
    setError("");
    setShowUnsavedConfirm(false);
    setIsComposite(false);
    setComponents([]);
    setComponentSearch("");
    setComponentResults([]);
    setShowCompositeSection(false);
    resetPresentationState();
  }

  function resetPresentationState() {
    setPresentations([]);
    setDraftPresentations([]);
    setPresentationForm(EMPTY_PRESENTATION_FORM);
    setEditingPresentationId(null);
    setPresentationError("");
  }

  async function loadPresentations(productId) {
    setLoadingPresentations(true);

    try {
      const result = await listPresentations(token, productId);
      setPresentations(result.presentaciones);
    } catch (requestError) {
      setPresentationError(requestError.message);
    } finally {
      setLoadingPresentations(false);
    }
  }

  function updatePresentationField(event) {
    const { name, value } = event.target;

    setPresentationForm((current) => ({ ...current, [name]: value }));
  }

  // Convierte la cantidad escrita (6 unidades, 5 lb, 2 L) al factor de
  // inventario que espera el backend (6, 2270 g, 2000 ml).
  function toPresentationPayload(draft) {
    const factor = Math.round(Number(draft.cantidad) * principalFactor * 1000) / 1000;

    return {
      nombre: draft.nombre.trim(),
      tipoVenta: presentationTypeFor(form.tipoVenta),
      factorInventario: factor,
      precio: draft.precio,
      codigoBarra: draft.codigoBarra.trim(),
    };
  }

  function validatePresentationForm() {
    const name = presentationForm.nombre.trim();

    if (!name) {
      return "Escribe el nombre de la presentación (ej. Six-pack, Cajetilla).";
    }

    if (!isEditingSavedPresentation && !(Number(presentationForm.cantidad) > 0)) {
      return `Escribe cuántas ${baseUnitLabel} trae la presentación.`;
    }

    if (!(Number(presentationForm.precio) > 0)) {
      return "Escribe un precio de venta válido.";
    }

    const others = extraPresentations.filter((item) => item.id !== editingPresentationId);

    if (
      name.toLowerCase() === principalName.toLowerCase() ||
      others.some((item) => item.nombre.toLowerCase() === name.toLowerCase())
    ) {
      return "Ya existe una presentación con ese nombre en este producto.";
    }

    // Repetir el código de la unidad u otra presentación de ESTE producto
    // está permitido (ej. "Café" y "Café servido en vaso"). Si el código es
    // de otro producto, lo rechaza el backend.

    return "";
  }

  function startEditingPresentation(item) {
    setPresentationForm({
      nombre: item.nombre,
      cantidad: String(item.cantidad),
      precio: String(item.precio),
      codigoBarra: item.codigoBarra ?? "",
    });

    setEditingPresentationId(item.id);
    setPresentationError("");
  }

  function cancelPresentationForm() {
    setPresentationForm(EMPTY_PRESENTATION_FORM);
    setEditingPresentationId(null);
    setPresentationError("");
  }

  async function handleSavePresentation() {
    setPresentationError("");

    const validationError = validatePresentationForm();

    if (validationError) {
      setPresentationError(validationError);
      return;
    }

    // Producto todavía sin guardar: solo se arma la lista local.
    if (!editingProductId) {
      const draft = {
        nombre: presentationForm.nombre.trim(),
        cantidad: presentationForm.cantidad,
        precio: presentationForm.precio,
        codigoBarra: presentationForm.codigoBarra.trim(),
      };

      setDraftPresentations((current) =>
        editingPresentationId
          ? current.map((item) =>
              item.localId === editingPresentationId ? { ...item, ...draft } : item,
            )
          : [...current, { localId: `draft-${Date.now()}`, ...draft }],
      );

      cancelPresentationForm();
      return;
    }

    setSavingPresentation(true);

    try {
      if (editingPresentationId) {
        // El factor no se edita aquí a propósito (rompería la trazabilidad
        // de ventas ya registradas con ese factor). Solo nombre, precio y
        // código de barras.
        await updatePresentation(token, editingProductId, editingPresentationId, {
          nombre: presentationForm.nombre.trim(),
          precio: presentationForm.precio,
          codigoBarra: presentationForm.codigoBarra.trim(),
        });
      } else {
        await addPresentation(token, editingProductId, toPresentationPayload(presentationForm));
      }

      await loadPresentations(editingProductId);
      cancelPresentationForm();
    } catch (requestError) {
      setPresentationError(requestError.message);
    } finally {
      setSavingPresentation(false);
    }
  }

  async function handleRemovePresentation(item) {
    setPresentationError("");

    if (!editingProductId) {
      setDraftPresentations((current) => current.filter((draft) => draft.localId !== item.id));

      if (editingPresentationId === item.id) {
        cancelPresentationForm();
      }

      return;
    }

    if (!window.confirm(`¿Quitar la presentación "${item.nombre}"? Ya no aparecerá en ventas ni compras.`)) {
      return;
    }

    try {
      await removePresentation(token, editingProductId, item.id);

      if (editingPresentationId === item.id) {
        cancelPresentationForm();
      }

      await loadPresentations(editingProductId);
    } catch (requestError) {
      setPresentationError(requestError.message);
    }
  }

  // Enter dentro del editor de presentaciones NO debe enviar el formulario
  // del producto (el lector de códigos manda Enter al final del escaneo).
  function handlePresentationKeyDown(event) {
    if (event.key !== "Enter" || event.target.tagName !== "INPUT") {
      return;
    }

    event.preventDefault();

    if (event.target.name !== "codigoBarra") {
      handleSavePresentation();
    }
  }

  async function startEditing(product) {
    const presentation = product.presentacionPrincipal;

    const shiftTwoPrice = presentation?.preciosTurno?.find(
      (shiftPrice) => shiftPrice.turno === 2,
    );

    const shiftThreePrice = presentation?.preciosTurno?.find(
      (shiftPrice) => shiftPrice.turno === 3,
    );

    setForm({
      nombre: product.nombre ?? "",
      codigoBarra: presentation?.codigoBarra ?? "",
      categoriaId: product.categoria?.id ? String(product.categoria.id) : "",
      tipoVenta: presentation?.tipo ?? "UNIDAD",
      costo: String(product.costo ?? ""),
      precio: String(presentation?.precio ?? ""),
      cambiaPrecioTurno: product.modoPrecio === "POR_HORARIO",
      precioTurno2: shiftTwoPrice ? String(shiftTwoPrice.precio) : "",
      precioTurno3: shiftThreePrice ? String(shiftThreePrice.precio) : "",
      stockInicial: String(product.stock ?? ""),
      stockMinimo: String(product.stockMinimo ?? ""),
      sku: product.sku ?? "",
      descripcion: product.descripcion ?? "",
    });

    setFormSnapshot({
      nombre: product.nombre ?? "",
      codigoBarra: presentation?.codigoBarra ?? "",
      categoriaId: product.categoria?.id ? String(product.categoria.id) : "",
      tipoVenta: presentation?.tipo ?? "UNIDAD",
      costo: String(product.costo ?? ""),
      precio: String(presentation?.precio ?? ""),
      cambiaPrecioTurno: product.modoPrecio === "POR_HORARIO",
      precioTurno2: shiftTwoPrice ? String(shiftTwoPrice.precio) : "",
      precioTurno3: shiftThreePrice ? String(shiftThreePrice.precio) : "",
      stockInicial: String(product.stock ?? ""),
      stockMinimo: String(product.stockMinimo ?? ""),
      sku: product.sku ?? "",
      descripcion: product.descripcion ?? "",
    });

    setEditingProductId(product.id);
    setShowForm(true);
    setShowCategoryForm(false);
    setError("");
    setSuccess("");
    resetPresentationState();

    try {
      const existingComponents = await getProductComponents(token, product.id);

      if (existingComponents.componentes.length > 0) {
        setIsComposite(true);
        setShowCompositeSection(true);
        setComponents(
          existingComponents.componentes.map((item) => ({
            productoId: item.producto.id,
            nombre: item.producto.nombre,
            tipo: item.producto.unidadInventario === "GRAMO" ? "PESO" : "UNIDAD",
            cantidad: String(item.cantidad),
          })),
        );
      } else {
        setIsComposite(false);
        setShowCompositeSection(false);
        setComponents([]);
      }
    } catch (requestError) {
      setError(requestError.message);
    }

    await loadPresentations(product.id);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const principalPresentation = presentations.find((item) => item.esPrincipal) ?? null;

  const principalFactor =
    principalPresentation?.factorInventario || BASE_FACTORS[form.tipoVenta] || 1;

  const principalName =
    principalPresentation?.nombre ?? TYPE_LABELS[form.tipoVenta] ?? "Unidad";

  const baseUnitLabel = BASE_UNIT_LABELS[form.tipoVenta] ?? "unidades";

  const isEditingSavedPresentation = Boolean(editingProductId && editingPresentationId);

  // Lista unificada: presentaciones guardadas (al editar) o el borrador
  // local (al crear). La cantidad siempre en unidades de venta.
  const extraPresentations = editingProductId
    ? presentations
        .filter((item) => !item.esPrincipal)
        .map((item) => ({
          id: item.id,
          nombre: item.nombre,
          cantidad: Number(item.factorInventario) / principalFactor,
          precio: Number(item.precio),
          codigoBarra: item.codigoBarra,
        }))
    : draftPresentations.map((item) => ({
        id: item.localId,
        nombre: item.nombre,
        cantidad: Number(item.cantidad),
        precio: Number(item.precio),
        codigoBarra: item.codigoBarra,
      }));

  const typedBarcode = presentationForm.codigoBarra.trim();

  const sharedBarcodeWith = typedBarcode
    ? [
        ...(typedBarcode === form.codigoBarra.trim() ? [principalName] : []),
        ...extraPresentations
          .filter((item) => item.id !== editingPresentationId && item.codigoBarra === typedBarcode)
          .map((item) => item.nombre),
      ]
    : [];

  const previewQuantity = Number(presentationForm.cantidad);
  const previewPrice = Number(presentationForm.precio);

  const stockLabel =
    form.tipoVenta === "PESO"
      ? "Libras"
      : form.tipoVenta === "VOLUMEN"
        ? "Litros"
        : "Cantidad";

  return (
    <main className="workspace-page">
      <header className="workspace-header">
        <div>
          {onBack ? (
            <button className="back-button" onClick={onBack} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18 9 12l6-6" />
              </svg>

              Volver
            </button>
          ) : null}

          <p className="eyebrow">Catálogo</p>

          <h1>Productos</h1>

          <p>Registra y encuentra productos sin navegar por varias pantallas.</p>
        </div>

        <button
          className="primary-button workspace-header__action"
          onClick={() => {
            if (showForm) {
              closeForm();
            } else {
              setForm(EMPTY_FORM);
              setFormSnapshot(EMPTY_FORM);
              setEditingProductId(null);
              setShowForm(true);
              setError("");
              setSuccess("");
              setIsComposite(false);
              setComponents([]);
              setComponentSearch("");
              setComponentResults([]);
              setShowCompositeSection(false);
              resetPresentationState();
            }
          }}
          type="button"
        >
          {showForm ? "Cerrar formulario" : "+ Nuevo producto"}
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
        <section className="product-form-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {editingProductId ? "Editar registro" : "Nuevo registro"}
              </p>

              <h2>{editingProductId ? "Editar producto" : "Agregar producto"}</h2>
            </div>

            <p>
              {editingProductId
                ? "Corrige los datos y guarda los cambios."
                : "Completa únicamente los datos que conozcas."}
            </p>
          </div>

          <form className="product-form" onSubmit={handleCreateProduct}>
            <label className="field">
              <span>Nombre del producto *</span>

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
              <span>Código de barras</span>

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

                <select name="categoriaId" onChange={updateField} value={form.categoriaId}>
                  <option value="">Sin categoría</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <button
                className="text-button"
                onClick={() => setShowCategoryForm((current) => !current)}
                type="button"
              >
                + Nueva categoría
              </button>
            </div>

            {showCategoryForm ? (
              <div className="inline-form">
                <label className="field">
                  <span>Nombre de la categoría</span>

                  <input
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="Ejemplo: Bebidas"
                    value={categoryName}
                  />
                </label>

                <button
                  className="secondary-button"
                  disabled={!categoryName.trim()}
                  onClick={handleCreateCategory}
                  type="button"
                >
                  Guardar categoría
                </button>
              </div>
            ) : null}

            <label className="field">
              <span>¿Cómo se vende? *</span>

              <select
                disabled={Boolean(editingProductId)}
                name="tipoVenta"
                onChange={updateField}
                value={form.tipoVenta}
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              {editingProductId ? (
                <small>La forma de venta no se cambia después de registrar el producto.</small>
              ) : null}
            </label>

            <div className="form-row">
              <label className="field">
                <span>Costo</span>

                <input
                  min="0"
                  name="costo"
                  onChange={updateField}
                  placeholder="0.0000"
                  step="0.0001"
                  type="number"
                  value={form.costo}
                />
              </label>

              <label className="field">
                <span>Precio de venta *</span>

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
              <legend>¿El precio cambia según el turno?</legend>

              <div className="price-mode__options">
                <label className="radio-option">
                  <input
                    checked={!form.cambiaPrecioTurno}
                    name="modoPrecio"
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        cambiaPrecioTurno: false,
                        precioTurno2: "",
                        precioTurno3: "",
                      }))
                    }
                    type="radio"
                  />

                  <span>
                    <strong>Mismo precio todo el día</strong>

                    <small>Usará siempre el precio normal.</small>
                  </span>
                </label>

                <label className="radio-option">
                  <input
                    checked={form.cambiaPrecioTurno}
                    name="modoPrecio"
                    onChange={() =>
                      setForm((current) => ({ ...current, cambiaPrecioTurno: true }))
                    }
                    type="radio"
                  />

                  <span>
                    <strong>Cambia según el turno</strong>

                    <small>El precio normal se usa de 8 a. m. a 10 p. m.</small>
                  </span>
                </label>
              </div>

              {form.cambiaPrecioTurno ? (
                <div className="form-row price-mode__shift-fields">
                  <label className="field">
                    <span>Precio turno 2 · 10 p. m. a 2 a. m. *</span>

                    <input
                      min="0.01"
                      name="precioTurno2"
                      onChange={updateField}
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={form.precioTurno2}
                    />
                  </label>

                  <label className="field">
                    <span>Precio turno 3 · 2 a. m. a 8 a. m. *</span>

                    <input
                      min="0.01"
                      name="precioTurno3"
                      onChange={updateField}
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={form.precioTurno3}
                    />
                  </label>
                </div>
              ) : null}
            </fieldset>

            <div className="form-row">
              <label className="field">
                <span>
                  {editingProductId ? `${stockLabel} actuales` : `${stockLabel} disponibles`}
                </span>

                <input
                  min="0"
                  name="stockInicial"
                  onChange={updateField}
                  placeholder="0"
                  step="0.001"
                  type="number"
                  value={form.stockInicial}
                />
              </label>

              <label className="field">
                <span>Avisar cuando queden</span>

                <input
                  min="0"
                  name="stockMinimo"
                  onChange={updateField}
                  placeholder="0"
                  step="0.001"
                  type="number"
                  value={form.stockMinimo}
                />
              </label>
            </div>

            <section className="presentations-card" onKeyDown={handlePresentationKeyDown}>
              <header className="presentations-card__header">
                <div>
                  <p className="eyebrow">Formas de venta</p>

                  <h3>Presentaciones de este producto</h3>
                </div>

                <span className="presentations-card__badge">
                  {extraPresentations.length + 1} en total
                </span>
              </header>

              <p className="presentations-field__hint">
                Todas descuentan del mismo inventario ({baseUnitLabel}). Ej. cigarro:
                la unidad es el cigarro suelto; aquí agregas Cajetilla = 20 y Cartón = 200.
                En Compras eliges la presentación en que llegó la mercadería y el sistema
                la convierte a {baseUnitLabel}. Si es el mismo producto con otro precio
                (caliente, servido en vaso), usa equivale a 1; puede llevar el mismo código.
              </p>

              {presentationError ? (
                <p className="form-error" role="alert">
                  {presentationError}
                </p>
              ) : null}

              {loadingPresentations ? (
                <small>Cargando presentaciones...</small>
              ) : (
                <ul className="presentation-list">
                  <li className="presentation-list__principal">
                    <span className="presentation-list__name">
                      <strong>
                        {principalName} <em>principal</em>
                      </strong>

                      <small>
                        1 {form.tipoVenta === "PESO" ? "lb" : form.tipoVenta === "VOLUMEN" ? "L" : "und"}
                        {" · "}
                        {form.codigoBarra.trim() || "sin código"}
                      </small>
                    </span>

                    <span className="presentation-list__price">
                      {Number(form.precio) > 0 ? `L ${Number(form.precio).toFixed(2)}` : "—"}
                    </span>

                    <div className="presentation-list__actions">
                      <small>Se edita arriba</small>
                    </div>
                  </li>

                  {extraPresentations.map((item) => (
                    <li
                      className={
                        editingPresentationId === item.id ? "presentation-list__editing" : undefined
                      }
                      key={item.id}
                    >
                      <span className="presentation-list__name">
                        <strong>{item.nombre}</strong>

                        <small>
                          Equivale a {formatNumber(item.cantidad)} {baseUnitLabel}
                          {" · "}
                          {item.codigoBarra || "sin código"}
                          {item.cantidad > 0
                            ? ` · L ${(item.precio / item.cantidad).toFixed(2)} c/u`
                            : ""}
                        </small>
                      </span>

                      <span className="presentation-list__price">
                        L {item.precio.toFixed(2)}
                      </span>

                      <div className="presentation-list__actions">
                        <button
                          className="text-button"
                          onClick={() => startEditingPresentation(item)}
                          type="button"
                        >
                          Editar
                        </button>

                        <button
                          aria-label={`Quitar ${item.nombre}`}
                          className="text-button presentation-list__remove"
                          onClick={() => handleRemovePresentation(item)}
                          type="button"
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="presentation-editor">
                <p className="presentation-editor__title">
                  {editingPresentationId
                    ? `Editando: ${presentationForm.nombre || "presentación"}`
                    : "Agregar presentación"}
                </p>

                <div className="presentation-editor__grid">
                  <label className="field">
                    <span>Nombre *</span>

                    <input
                      name="nombre"
                      onChange={updatePresentationField}
                      placeholder="Ejemplo: Six-pack, Cajetilla"
                      value={presentationForm.nombre}
                    />
                  </label>

                  <label className="field">
                    <span>Equivale a ({baseUnitLabel}) *</span>

                    <input
                      disabled={isEditingSavedPresentation}
                      min="0.001"
                      name="cantidad"
                      onChange={updatePresentationField}
                      placeholder={form.tipoVenta === "PESO" ? "Ejemplo: 5" : "Ejemplo: 6"}
                      step="0.001"
                      type="number"
                      value={presentationForm.cantidad}
                    />

                    {isEditingSavedPresentation ? (
                      <small>No se puede cambiar una vez creada. Quítala y crea otra.</small>
                    ) : null}
                  </label>

                  <label className="field">
                    <span>Precio de venta *</span>

                    <input
                      min="0.01"
                      name="precio"
                      onChange={updatePresentationField}
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={presentationForm.precio}
                    />
                  </label>

                  <label className="field">
                    <span>Código de barras</span>

                    <input
                      name="codigoBarra"
                      onChange={updatePresentationField}
                      placeholder="Escanea o escribe el código"
                      value={presentationForm.codigoBarra}
                    />
                  </label>
                </div>

                {sharedBarcodeWith.length > 0 ? (
                  <small className="presentation-editor__shared">
                    Comparte código con: {sharedBarcodeWith.join(", ")}. Al escanearlo, la
                    cajera verá las opciones y elegirá cuál vender.
                  </small>
                ) : null}

                {previewQuantity > 0 && presentationForm.nombre.trim() ? (
                  <small className="presentation-editor__preview">
                    Al vender 1 {presentationForm.nombre.trim()} se descuentan{" "}
                    {formatNumber(previewQuantity)} {baseUnitLabel} del inventario
                    {previewPrice > 0
                      ? ` · sale a L ${(previewPrice / previewQuantity).toFixed(2)} por ${
                          form.tipoVenta === "PESO" ? "lb" : form.tipoVenta === "VOLUMEN" ? "L" : "unidad"
                        }`
                      : ""}
                    .
                  </small>
                ) : null}

                <div className="form-actions">
                  <button
                    className="secondary-button"
                    onClick={cancelPresentationForm}
                    type="button"
                  >
                    {editingPresentationId ? "Cancelar edición" : "Limpiar"}
                  </button>

                  <button
                    className="primary-button"
                    disabled={savingPresentation}
                    onClick={handleSavePresentation}
                    type="button"
                  >
                    {savingPresentation
                      ? "Guardando..."
                      : editingPresentationId
                        ? "Guardar presentación"
                        : editingProductId
                          ? "Agregar presentación"
                          : "Agregar a la lista"}
                  </button>
                </div>

                {!editingProductId ? (
                  <small className="presentation-editor__preview">
                    Las presentaciones de la lista se guardan junto con el producto al
                    pulsar "Guardar producto".
                  </small>
                ) : null}
              </div>
            </section>

            <details
              className="composite-product"
              onToggle={(event) => setShowCompositeSection(event.currentTarget.open)}
              open={showCompositeSection}
            >
              <summary>
                Opción avanzada: producto compuesto
                {isComposite ? <em> · activo</em> : null}
              </summary>

              <p className="presentations-field__hint">
                Úsalo solo para mezclas de productos distintos (ej. Saco de pollo mixto:
                pierna + pechuga). Para six-pack, cajetilla o caja del mismo producto,
                usa Presentaciones.
              </p>

              <label className="composite-toggle">
                <input
                  checked={isComposite}
                  onChange={(event) => {
                    setIsComposite(event.target.checked);

                    if (!event.target.checked) {
                      setComponents([]);
                    }
                  }}
                  type="checkbox"
                />

                <span>
                  <strong>Producto compuesto</strong>

                  <small>
                    Ej. "Saco de pollo mixto": al venderlo, no descuenta su propio
                    inventario — descuenta una cantidad fija de otros productos
                    (Pierna, Pechuga, etc.) que tú defines.
                  </small>
                </span>
              </label>

              {isComposite ? (
                <div className="composite-editor">
                  {components.length > 0 ? (
                    <ul className="composite-list">
                      {components.map((item) => (
                        <li key={item.productoId}>
                          <span>{item.nombre}</span>

                          <div className="composite-list__proportion">
                            <input
                              min="0"
                              onChange={(event) =>
                                updateComponentQuantity(
                                  item.productoId,
                                  event.target.value,
                                )
                              }
                              placeholder="0"
                              step="0.001"
                              type="number"
                              value={item.cantidad}
                            />

                            <span>
                              {item.tipo === "PESO"
                                ? "lb"
                                : item.tipo === "VOLUMEN"
                                  ? "L"
                                  : "und"}
                            </span>
                          </div>

                          <button
                            aria-label={`Quitar ${item.nombre}`}
                            className="text-button"
                            onClick={() => removeComponent(item.productoId)}
                            type="button"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <small className="composite-sum">
                    Cantidad que se descuenta de cada componente por cada unidad
                    vendida de este producto.
                  </small>

                  <div className="inline-form">
                    <label className="field">
                      <span>Agregar componente</span>

                      <input
                        onChange={(event) => setComponentSearch(event.target.value)}
                        placeholder="Buscar producto por nombre"
                        value={componentSearch}
                      />
                    </label>
                  </div>

                  {searchingComponents ? (
                    <small>Buscando productos...</small>
                  ) : componentResults.length > 0 ? (
                    <ul className="composite-results">
                      {componentResults
                        .filter(
                          (product) =>
                            product.id !== editingProductId &&
                            !components.some((item) => item.productoId === product.id),
                        )
                        .map((product) => (
                          <li key={product.id}>
                            <button
                              onClick={() => addComponent(product)}
                              type="button"
                            >
                              {product.nombre}
                            </button>
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </details>

            <details className="optional-fields">
              <summary>Datos opcionales</summary>

              <div className="form-row">
                <label className="field">
                  <span>Código interno</span>

                  <input
                    name="sku"
                    onChange={updateField}
                    placeholder="Ejemplo: BEB-001"
                    value={form.sku}
                  />
                </label>

                <label className="field">
                  <span>Descripción</span>

                  <input
                    name="descripcion"
                    onChange={updateField}
                    placeholder="Información adicional"
                    value={form.descripcion}
                  />
                </label>
              </div>
            </details>

            <div className="form-actions">
              <button className="secondary-button" onClick={closeForm} type="button">
                Cancelar
              </button>

              <button className="primary-button" disabled={saving} type="submit">
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
        <form className="search-bar" onSubmit={handleSearch}>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, código o SKU"
            value={search}
          />

          <button className="secondary-button" type="submit">
            Buscar
          </button>
        </form>

        {loading ? (
          <p className="empty-state">Cargando productos...</p>
        ) : products.length === 0 ? (
          <p className="empty-state">
            No hay productos registrados. Pulsa "Nuevo producto" para comenzar.
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
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <strong>{product.nombre}</strong>

                      <small>{product.categoria?.nombre ?? "Sin categoría"}</small>
                    </td>

                    <td>
                      {product.presentacionPrincipal?.codigoBarra ?? product.sku ?? "—"}
                    </td>

                    <td>
                      {product.presentacionPrincipal?.nombre ?? "—"}

                      {product.presentaciones?.length > 1 ? (
                        <small className="presentation-count">
                          +{" "}
                          {product.presentaciones
                            .filter((item) => !item.esPrincipal)
                            .map((item) => item.nombre)
                            .join(" · ")}
                        </small>
                      ) : null}
                    </td>

                    <td>{formatNumber(product.stock)}</td>

                    <td>
                      {product.presentacionPrincipal ? (
                        <span className="price-cell">
                          <strong>
                            {Number(product.presentacionPrincipal.precio).toFixed(2)}
                          </strong>

                          <small>
                            {product.modoPrecio === "POR_HORARIO"
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
                        onClick={() => startEditing(product)}
                        type="button"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <footer className="product-pagination">
            <button
              className="secondary-button"
              disabled={page <= 1 || loading}
              onClick={() => loadProducts(page - 1)}
              type="button"
            >
              Anterior
            </button>

            <span>
              Página {page} de {totalPages} · {totalProducts} productos
            </span>

            <button
              className="secondary-button"
              disabled={page >= totalPages || loading}
              onClick={() => loadProducts(page + 1)}
              type="button"
            >
              Siguiente
            </button>
          </footer>
        ) : null}
      </section>

      {showUnsavedConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "rgba(11, 31, 23, 0.55)",
          }}
        >
          <div
            style={{
              width: "min(100%, 380px)",
              borderRadius: 16,
              padding: 26,
              background: "var(--surface, #fff)",
              boxShadow: "0 24px 60px rgba(11, 31, 23, 0.2)",
              display: "grid",
              gap: 16,
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, color: "var(--ink, #1c1c1c)", fontWeight: 500 }}>
              Tienes cambios sin guardar. ¿Salir de todas formas?
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                className="secondary-button"
                onClick={() => setShowUnsavedConfirm(false)}
                type="button"
              >
                Cancelar
              </button>

              <button className="primary-button" onClick={resetForm} type="button">
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}