import { useEffect, useState } from "react";
import {
  createSupplier,
  listSuppliers,
  updateSupplier,
} from "../../services/api.js";

const EMPTY_FORM = {
  nombre: "",
  contacto: "",
  telefono: "",
  correo: "",
  direccion: "",
  notas: "",
};

function supplierForm(supplier) {
  return {
    nombre: supplier.nombre ?? "",
    contacto: supplier.contacto ?? "",
    telefono: supplier.telefono ?? "",
    correo: supplier.correo ?? "",
    direccion: supplier.direccion ?? "",
    notas: supplier.notas ?? "",
  };
}

export function ProveedoresPage({ token }) {
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] =
    useState(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [
    confirmingDeactivate,
    setConfirmingDeactivate,
  ] = useState(false);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(async () => {
      try {
        const result = await listSuppliers(
          token,
          search.trim(),
        );

        if (active) {
          setSuppliers(result.proveedores);

          setSelectedSupplier((current) =>
            current
              ? result.proveedores.find(
                  (supplier) =>
                    supplier.id === current.id,
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
  }, [search, token]);

  function changeField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openNewSupplier() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    setConfirmingDeactivate(false);
    setError("");
    setSuccess("");
  }

  function openEditSupplier() {
    if (!selectedSupplier) {
      return;
    }

    setForm(supplierForm(selectedSupplier));
    setEditingId(selectedSupplier.id);
    setShowForm(true);
    setConfirmingDeactivate(false);
    setError("");
    setSuccess("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function updateSupplierEverywhere(
    updatedSupplier,
  ) {
    setSuppliers((current) =>
      current
        .map((supplier) =>
          supplier.id === updatedSupplier.id
            ? updatedSupplier
            : supplier,
        )
        .filter((supplier) => supplier.activo)
        .sort((first, second) =>
          first.nombre.localeCompare(second.nombre),
        ),
    );

    setSelectedSupplier(
      updatedSupplier.activo
        ? updatedSupplier
        : null,
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (editingId) {
        const result = await updateSupplier(
          token,
          editingId,
          form,
        );

        updateSupplierEverywhere(result.proveedor);
        setSuccess(
          "Proveedor actualizado correctamente.",
        );
      } else {
        const result = await createSupplier(
          token,
          form,
        );

        setSuppliers((current) =>
          [...current, result.proveedor].sort(
            (first, second) =>
              first.nombre.localeCompare(
                second.nombre,
              ),
          ),
        );

        setSelectedSupplier(result.proveedor);
        setSuccess(
          "Proveedor creado correctamente.",
        );
      }

      closeForm();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function deactivateSupplier() {
    if (!selectedSupplier) {
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await updateSupplier(
        token,
        selectedSupplier.id,
        {
          activo: false,
        },
      );

      updateSupplierEverywhere(result.proveedor);
      setConfirmingDeactivate(false);
      setSuccess(
        "Proveedor desactivado correctamente.",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function selectSupplier(supplier) {
    setSelectedSupplier(supplier);
    setShowForm(false);
    setEditingId(null);
    setConfirmingDeactivate(false);
    setError("");
    setSuccess("");
  }

  return (
    <main className="suppliers-page">
      <header className="suppliers-header">
        <div>
          <p className="eyebrow">
            Directorio de abastecimiento
          </p>

          <h1>Proveedores</h1>

          <p>
            Guarda los datos de quienes suministran
            los productos.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openNewSupplier}
          type="button"
        >
          + Nuevo proveedor
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
        <section className="supplier-form-card">
          <div className="supplier-form-heading">
            <div>
              <p className="eyebrow">
                {editingId
                  ? "Editar registro"
                  : "Nuevo registro"}
              </p>

              <h2>
                {editingId
                  ? "Editar proveedor"
                  : "Crear proveedor"}
              </h2>
            </div>

            <button
              className="secondary-button"
              disabled={loading}
              onClick={closeForm}
              type="button"
            >
              Cancelar
            </button>
          </div>

          <form
            className="supplier-form"
            onSubmit={handleSubmit}
          >
            <label className="field">
              <span>Nombre del proveedor</span>

              <input
                autoFocus
                maxLength="150"
                onChange={(event) =>
                  changeField(
                    "nombre",
                    event.target.value,
                  )
                }
                placeholder="Nombre obligatorio"
                required
                value={form.nombre}
              />
            </label>

            <label className="field">
              <span>Persona de contacto</span>

              <input
                maxLength="120"
                onChange={(event) =>
                  changeField(
                    "contacto",
                    event.target.value,
                  )
                }
                placeholder="Opcional"
                value={form.contacto}
              />
            </label>

            <label className="field">
              <span>Teléfono</span>

              <input
                maxLength="30"
                onChange={(event) =>
                  changeField(
                    "telefono",
                    event.target.value,
                  )
                }
                placeholder="Opcional"
                value={form.telefono}
              />
            </label>

            <label className="field">
              <span>Correo</span>

              <input
                maxLength="150"
                onChange={(event) =>
                  changeField(
                    "correo",
                    event.target.value,
                  )
                }
                placeholder="Opcional"
                type="email"
                value={form.correo}
              />
            </label>

            <label className="field supplier-form__wide">
              <span>Dirección</span>

              <input
                maxLength="250"
                onChange={(event) =>
                  changeField(
                    "direccion",
                    event.target.value,
                  )
                }
                placeholder="Opcional"
                value={form.direccion}
              />
            </label>

            <label className="field supplier-form__wide">
              <span>Notas</span>

              <input
                maxLength="250"
                onChange={(event) =>
                  changeField(
                    "notas",
                    event.target.value,
                  )
                }
                placeholder="Información adicional"
                value={form.notas}
              />
            </label>

            <button
              className="primary-button supplier-form__submit"
              disabled={loading}
              type="submit"
            >
              {loading
                ? "Guardando..."
                : "Guardar proveedor"}
            </button>
          </form>
        </section>
      ) : null}

      <div className="suppliers-layout">
        <aside className="supplier-list-card">
          <div className="supplier-search">
            <input
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Buscar proveedor"
              value={search}
            />
          </div>

          <div className="supplier-list">
            {suppliers.length === 0 ? (
              <p className="empty-state">
                No hay proveedores para mostrar.
              </p>
            ) : (
              suppliers.map((supplier) => (
                <button
                  className={`supplier-list-item ${
                    selectedSupplier?.id ===
                    supplier.id
                      ? "supplier-list-item--selected"
                      : ""
                  }`}
                  key={supplier.id}
                  onClick={() =>
                    selectSupplier(supplier)
                  }
                  type="button"
                >
                  <strong>{supplier.nombre}</strong>

                  <small>
                    {supplier.telefono ||
                      supplier.contacto ||
                      "Sin información de contacto"}
                  </small>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="supplier-detail-card">
          {!selectedSupplier ? (
            <div className="supplier-detail-empty">
              <span aria-hidden="true">🚚</span>

              <h2>Selecciona un proveedor</h2>

              <p>
                Aquí aparecerán sus datos de
                contacto.
              </p>
            </div>
          ) : (
            <>
              <header className="supplier-detail-header">
                <div>
                  <p className="eyebrow">
                    Proveedor seleccionado
                  </p>

                  <h2>
                    {selectedSupplier.nombre}
                  </h2>
                </div>

                <button
                  className="secondary-button"
                  onClick={openEditSupplier}
                  type="button"
                >
                  Editar
                </button>
              </header>

              <div className="supplier-information-grid">
                <article>
                  <span>Persona de contacto</span>

                  <strong>
                    {selectedSupplier.contacto ||
                      "No registrada"}
                  </strong>
                </article>

                <article>
                  <span>Teléfono</span>

                  <strong>
                    {selectedSupplier.telefono ||
                      "No registrado"}
                  </strong>
                </article>

                <article>
                  <span>Correo</span>

                  <strong>
                    {selectedSupplier.correo ||
                      "No registrado"}
                  </strong>
                </article>

                <article>
                  <span>Dirección</span>

                  <strong>
                    {selectedSupplier.direccion ||
                      "No registrada"}
                  </strong>
                </article>

                <article className="supplier-information-grid__wide">
                  <span>Notas</span>

                  <strong>
                    {selectedSupplier.notas ||
                      "Sin notas"}
                  </strong>
                </article>
              </div>

              <div className="supplier-purchases-note">
                <span aria-hidden="true">🧾</span>

                <div>
                  <strong>
                    Historial de compras
                  </strong>

                  <p>
                    Las compras de este proveedor
                    aparecerán aquí cuando construyamos
                    el siguiente módulo.
                  </p>
                </div>
              </div>

              <div className="supplier-deactivate-area">
                {!confirmingDeactivate ? (
                  <button
                    className="client-remove-price"
                    onClick={() =>
                      setConfirmingDeactivate(true)
                    }
                    type="button"
                  >
                    Desactivar proveedor
                  </button>
                ) : (
                  <div className="supplier-deactivate-confirmation">
                    <p>
                      El proveedor dejará de aparecer
                      en las búsquedas. Sus futuras
                      compras conservarán el historial.
                    </p>

                    <div>
                      <button
                        className="secondary-button"
                        disabled={loading}
                        onClick={() =>
                          setConfirmingDeactivate(false)
                        }
                        type="button"
                      >
                        Cancelar
                      </button>

                      <button
                        className="client-remove-price"
                        disabled={loading}
                        onClick={deactivateSupplier}
                        type="button"
                      >
                        {loading
                          ? "Desactivando..."
                          : "Sí, desactivar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}