import { useEffect, useState } from "react";

import {
  getConfiguration,
  updateConfiguration,
} from "../../services/api.js";

function cleanMoneyInput(value) {
  const cleaned = String(value)
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parts = cleaned.split(".");

  if (parts.length > 2) {
    return `${parts[0]}.${parts
      .slice(1)
      .join("")}`;
  }

  if (parts[1]?.length > 2) {
    return `${parts[0]}.${parts[1].slice(0, 2)}`;
  }

  return cleaned;
}

function formatDate(value) {
  if (!value) {
    return "Sin cambios registrados";
  }

  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ConfiguracionPage({ token }) {
  const [form, setForm] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadConfiguration() {
    setLoading(true);
    setError("");

    try {
      const response = await getConfiguration(token);

      setForm({
        ...response.configuracion,
        fondoInicial: String(
          response.configuracion.fondoInicial,
        ),
        turnos: response.configuracion.turnos.map(
          (shift) => ({
            ...shift,
          }),
        ),
      });

      setLastUpdate(
        response.configuracion.actualizadoEn,
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfiguration();
  }, [token]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateShift(index, field, value) {
    setForm((current) => {
      const shifts = current.turnos.map((shift) => ({
        ...shift,
      }));

      shifts[index][field] = value;

      /*
       * Si cambia el inicio de un turno, también cambia
       * el final del turno anterior.
       */
      if (field === "horaInicio") {
        const previousIndex =
          (index - 1 + shifts.length) %
          shifts.length;

        shifts[previousIndex].horaFin = value;
      }

      /*
       * Si cambia el final de un turno, también cambia
       * el inicio del siguiente.
       */
      if (field === "horaFin") {
        const nextIndex =
          (index + 1) % shifts.length;

        shifts[nextIndex].horaInicio = value;
      }

      return {
        ...current,
        turnos: shifts,
      };
    });
  }

  async function saveConfiguration(event) {
    event.preventDefault();

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const response = await updateConfiguration(
        token,
        {
          nombreNegocio: form.nombreNegocio,
          direccion: form.direccion,
          telefono: form.telefono,
          simboloMoneda: form.simboloMoneda,
          fondoInicial: form.fondoInicial,
          mensajeReportes: form.mensajeReportes,
          turnos: form.turnos.map((shift) => ({
            id: shift.id,
            horaInicio: shift.horaInicio,
            horaFin: shift.horaFin,
          })),
        },
      );

      setForm({
        ...response.configuracion,
        fondoInicial: String(
          response.configuracion.fondoInicial,
        ),
        turnos: response.configuracion.turnos.map(
          (shift) => ({
            ...shift,
          }),
        ),
      });

      setLastUpdate(
        response.configuracion.actualizadoEn,
      );

      setMessage(response.mensaje);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="settings-page">
        <div className="settings-loading">
          Cargando configuración…
        </div>
      </section>
    );
  }

  if (!form) {
    return (
      <section className="settings-page">
        <div className="settings-alert settings-alert-error">
          {error ||
            "No fue posible cargar la configuración."}
        </div>

        <button
          className="settings-primary-button"
          onClick={loadConfiguration}
          type="button"
        >
          Intentar nuevamente
        </button>
      </section>
    );
  }

  return (
    <section className="settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-eyebrow">
            AJUSTES GENERALES
          </span>

          <h1>Configuración</h1>

          <p>
            Personaliza los datos y el funcionamiento del
            minisúper.
          </p>
        </div>

        <div className="settings-update">
          <span>Último cambio</span>
          <strong>{formatDate(lastUpdate)}</strong>
        </div>
      </header>

      {error && (
        <div className="settings-alert settings-alert-error">
          {error}
        </div>
      )}

      {message && (
        <div className="settings-alert settings-alert-success">
          {message}
        </div>
      )}

      <form
        className="settings-form"
        onSubmit={saveConfiguration}
      >
        <section className="settings-card">
          <div className="settings-card-heading">
            <span className="settings-card-icon">
              🏪
            </span>

            <div>
              <h2>Datos del negocio</h2>

              <p>
                Esta información aparecerá en reportes y
                documentos internos.
              </p>
            </div>
          </div>

          <div className="settings-fields-grid">
            <label className="settings-field">
              <span>Nombre del negocio</span>

              <input
                maxLength={120}
                onChange={(event) =>
                  updateField(
                    "nombreNegocio",
                    event.target.value,
                  )
                }
                placeholder="Nombre del minisúper"
                required
                type="text"
                value={form.nombreNegocio}
              />
            </label>

            <label className="settings-field">
              <span>Teléfono opcional</span>

              <input
                maxLength={30}
                onChange={(event) =>
                  updateField(
                    "telefono",
                    event.target.value,
                  )
                }
                placeholder="Ejemplo: 9999-9999"
                type="text"
                value={form.telefono}
              />
            </label>

            <label className="settings-field settings-field-wide">
              <span>Dirección opcional</span>

              <input
                maxLength={250}
                onChange={(event) =>
                  updateField(
                    "direccion",
                    event.target.value,
                  )
                }
                placeholder="Dirección del negocio"
                type="text"
                value={form.direccion}
              />
            </label>

            <label className="settings-field settings-field-wide">
              <span>
                Mensaje para el final de los reportes
              </span>

              <textarea
                maxLength={300}
                onChange={(event) =>
                  updateField(
                    "mensajeReportes",
                    event.target.value,
                  )
                }
                placeholder="Ejemplo: Reporte administrativo de uso interno."
                rows={3}
                value={form.mensajeReportes}
              />
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <span className="settings-card-icon">
              💵
            </span>

            <div>
              <h2>Caja y moneda</h2>

              <p>
                Valores que utilizará el sistema de forma
                predeterminada.
              </p>
            </div>
          </div>

          <div className="settings-fields-grid">
            <label className="settings-field">
              <span>Fondo inicial de caja</span>

              <div className="settings-money-input">
                <span>{form.simboloMoneda}</span>

                <input
                  autoComplete="off"
                  inputMode="decimal"
                  onChange={(event) =>
                    updateField(
                      "fondoInicial",
                      cleanMoneyInput(
                        event.target.value,
                      ),
                    )
                  }
                  placeholder="500.00"
                  required
                  type="text"
                  value={form.fondoInicial}
                />
              </div>

              <small>
                Será el monto sugerido al abrir la caja.
              </small>
            </label>

            <label className="settings-field">
              <span>Símbolo de moneda</span>

              <input
                maxLength={10}
                onChange={(event) =>
                  updateField(
                    "simboloMoneda",
                    event.target.value,
                  )
                }
                placeholder="L"
                required
                type="text"
                value={form.simboloMoneda}
              />

              <small>
                Para Honduras normalmente se utiliza L.
              </small>
            </label>
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card-heading">
            <span className="settings-card-icon">
              🕐
            </span>

            <div>
              <h2>Horarios de precios</h2>

              <p>
                Define cuándo comienza y termina cada turno
                de precios.
              </p>
            </div>
          </div>

          <div className="settings-shift-notice">
            Los cambios se aplicarán a los productos que
            utilizan precios por horario. Los precios
            asignados no se borrarán.
          </div>

          <div className="settings-shifts">
            {form.turnos.map((shift, index) => (
              <article
                className="settings-shift-card"
                key={shift.id}
              >
                <div className="settings-shift-number">
                  {index + 1}
                </div>

                <div className="settings-shift-title">
                  <strong>{shift.nombre}</strong>

                  <small>
                    {index === 0
                      ? "Horario del precio normal"
                      : "Horario de precio especial"}
                  </small>
                </div>

                <label className="settings-time-field">
                  <span>Comienza</span>

                  <input
                    onChange={(event) =>
                      updateShift(
                        index,
                        "horaInicio",
                        event.target.value,
                      )
                    }
                    required
                    type="time"
                    value={shift.horaInicio}
                  />
                </label>

                <span
                  className="settings-time-arrow"
                  aria-hidden="true"
                >
                  →
                </span>

                <label className="settings-time-field">
                  <span>Termina</span>

                  <input
                    onChange={(event) =>
                      updateShift(
                        index,
                        "horaFin",
                        event.target.value,
                      )
                    }
                    required
                    type="time"
                    value={shift.horaFin}
                  />
                </label>
              </article>
            ))}
          </div>
        </section>

        <section className="settings-card settings-system-card">
          <div className="settings-card-heading">
            <span className="settings-card-icon">
              💾
            </span>

            <div>
              <h2>Información del sistema</h2>

              <p>
                El programa trabaja con la base de datos
                instalada en esta computadora.
              </p>
            </div>
          </div>

          <div className="settings-system-status">
            <span className="settings-system-dot" />

            <div>
              <strong>PostgreSQL local</strong>
              <small>
                Los datos están disponibles sin depender de
                Internet.
              </small>
            </div>
          </div>
        </section>

        <footer className="settings-actions">
          <div>
            <strong>¿Terminaste los cambios?</strong>
            <span>
              Revisa la información antes de guardarla.
            </span>
          </div>

          <button
            className="settings-primary-button"
            disabled={saving}
            type="submit"
          >
            {saving
              ? "Guardando…"
              : "Guardar configuración"}
          </button>
        </footer>
      </form>
    </section>
  );
}