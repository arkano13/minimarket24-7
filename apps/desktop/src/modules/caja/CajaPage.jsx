import { useEffect, useMemo, useState } from "react";
import "./CajaPage.css";
import { MiActividad } from "./MiActividad.jsx";

import {
  closeCashShift,
  createCashMovement,
  getCurrentCashShift,
  openCashShift,
} from "../../services/api.js";

function CashCardIcon({ name }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  if (name === "ABRIR") {
    return (
      <svg {...common}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }

  if (name === "RESUMEN") {
    return (
      <svg {...common}>
        <path d="M4 20V10M12 20V4M20 20v-7" />
        <path d="M2.5 20h19" />
      </svg>
    );
  }

  if (name === "MOVIMIENTO") {
    return (
      <svg {...common}>
        <path d="M7 17V7m0 0-3 3m3-3 3 3" />
        <path d="M17 7v10m0 0 3-3m-3 3-3-3" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function updateMoneyValue(setter, value) {
  const normalized = value.replace(",", ".");

  if (normalized === "" || /^\d+(\.\d{0,2})?$/.test(normalized)) {
    setter(normalized);
  }
}

export function CajaPage({ token }) {
  const [shift, setShift] = useState(undefined);
  const [lastClosedShift, setLastClosedShift] = useState(null);
  const [initialFund, setInitialFund] = useState("500");
  const [countedCash, setCountedCash] = useState("");
  const [movementType, setMovementType] = useState("INGRESO");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmingClose, setConfirmingClose] = useState(false);

  const previewDifference = useMemo(() => {
    if (!shift || countedCash === "") {
      return null;
    }

    const amount = Number(countedCash);

    if (!Number.isFinite(amount) || amount < 0) {
      return null;
    }

    return amount - shift.efectivoEsperado;
  }, [countedCash, shift]);

  useEffect(() => {
    let active = true;

    async function loadShift() {
      try {
        const result = await getCurrentCashShift(token);

        if (active) {
          setShift(result.turno);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message);
          setShift(null);
        }
      }
    }

    loadShift();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleOpen(event) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await openCashShift(token, { fondoInicial: initialFund });

      setShift(result.turno);
      setLastClosedShift(null);
      setInitialFund("500");

      setSuccess("Caja abierta correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMovement(event) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const result = await createCashMovement(token, {
        tipo: movementType,
        monto: movementAmount,
        motivo: movementReason,
      });

      setShift(result.turno);
      setMovementAmount("");
      setMovementReason("");

      setSuccess(
        movementType === "INGRESO"
          ? "Ingreso registrado correctamente."
          : "Retiro registrado correctamente.",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleClose(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!confirmingClose) {
      setConfirmingClose(true);
      return;
    }

    setLoading(true);

    try {
      const result = await closeCashShift(token, { efectivoContado: countedCash });

      setLastClosedShift(result.turno);

      setShift(null);
      setCountedCash("");
      setConfirmingClose(false);

      setSuccess("Caja cerrada correctamente.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  if (shift === undefined) {
    return (
      <main className="cash-page">
        <p className="empty-state">Cargando caja...</p>
      </main>
    );
  }

  return (
    <main className="cash-page">
      <header className="cash-header">
        <div>
          <p className="eyebrow">Control del dinero</p>

          <h1>Caja y turnos</h1>

          <p>Abre la caja antes de vender y ciérrala al terminar.</p>
        </div>

        <span className={`cash-status ${shift ? "cash-status--open" : "cash-status--closed"}`}>
          {shift ? "Caja abierta" : "Caja cerrada"}
        </span>
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

      {!shift ? (
        <>
          {lastClosedShift ? (
            <section className="cash-close-result">
              <div>
                <span>Efectivo esperado</span>

                <strong>L {formatMoney(lastClosedShift.efectivoEsperado)}</strong>
              </div>

              <div>
                <span>Efectivo contado</span>

                <strong>L {formatMoney(lastClosedShift.efectivoContado)}</strong>
              </div>

              <div>
                <span>Diferencia</span>

                <strong
                  className={
                    lastClosedShift.diferencia < 0 ? "cash-negative" : "cash-positive"
                  }
                >
                  L {formatMoney(lastClosedShift.diferencia)}
                </strong>
              </div>
            </section>
          ) : null}

          <section className="cash-open-card">
            <div className="cash-card-heading">
              <span aria-hidden="true">
                <CashCardIcon name="ABRIR" />
              </span>

              <div>
                <h2>Abrir caja</h2>

                <p>Confirma el efectivo disponible al comenzar.</p>
              </div>
            </div>

            <form onSubmit={handleOpen}>
              <label className="field">
                <span>Fondo inicial</span>

                <input
                  autoComplete="off"
                  onChange={(event) => updateMoneyValue(setInitialFund, event.target.value)}
                  placeholder="Escribe el monto"
                  required
                  type="text"
                  value={initialFund}
                />

                <small>El fondo habitual es de L 500.00.</small>
              </label>

              <button className="primary-button" disabled={loading} type="submit">
                {loading ? "Abriendo..." : "Abrir caja"}
              </button>
            </form>
          </section>
        </>
      ) : (
        <>
          <section className="cash-summary-grid">
            <article>
              <span>Fondo inicial</span>

              <strong>L {formatMoney(shift.fondoInicial)}</strong>
            </article>

            <article>
              <span>Ventas en efectivo</span>

              <strong>L {formatMoney(shift.totales.efectivo)}</strong>
            </article>

            <article className="cash-summary-grid__expected">
              <span>Efectivo esperado</span>

              <strong>L {formatMoney(shift.efectivoEsperado)}</strong>
            </article>
          </section>

          <section className="cash-details-card">
            <div className="cash-card-heading">
              <span aria-hidden="true">
                <CashCardIcon name="RESUMEN" />
              </span>

              <div>
                <h2>Resumen general del turno</h2>

                <p>
                  Abierta por {shift.usuarioApertura.nombre} · {formatDate(shift.abiertoEn)}
                </p>
              </div>
            </div>

            <div className="cash-payment-summary">
              <div>
                <span>Ventas realizadas</span>

                <strong>{shift.totales.cantidadVentas}</strong>
              </div>

              <div>
                <span>Total vendido</span>

                <strong>L {formatMoney(shift.totales.ventas)}</strong>
              </div>

              <div>
                <span>Tarjeta</span>

                <strong>L {formatMoney(shift.totales.tarjeta)}</strong>
              </div>

              <div>
                <span>Transferencia</span>

                <strong>L {formatMoney(shift.totales.transferencia)}</strong>
              </div>

              <div>
                <span>Otros ingresos</span>

                <strong>L {formatMoney(shift.totales.ingresos)}</strong>
              </div>

              <div>
                <span>Retiros</span>

                <strong>L {formatMoney(shift.totales.retiros)}</strong>
              </div>
            </div>
          </section>

          <div className="cash-actions-grid">
            <section className="cash-action-card">
              <div className="cash-card-heading">
                <span aria-hidden="true">
                  <CashCardIcon name="MOVIMIENTO" />
                </span>

                <div>
                  <h2>Entrada o retiro</h2>

                  <p>Registra dinero que no pertenece a una venta.</p>
                </div>
              </div>

              <form className="cash-action-form" onSubmit={handleMovement}>
                <div className="cash-movement-types">
                  <label>
                    <input
                      checked={movementType === "INGRESO"}
                      name="tipoMovimientoCaja"
                      onChange={() => setMovementType("INGRESO")}
                      type="radio"
                    />

                    <strong>Ingreso</strong>
                  </label>

                  <label>
                    <input
                      checked={movementType === "RETIRO"}
                      name="tipoMovimientoCaja"
                      onChange={() => setMovementType("RETIRO")}
                      type="radio"
                    />

                    <strong>Retiro</strong>
                  </label>
                </div>

                <label className="field">
                  <span>Monto</span>

                  <input
                    autoComplete="off"
                    onChange={(event) =>
                      updateMoneyValue(setMovementAmount, event.target.value)
                    }
                    placeholder="Escribe el monto"
                    required
                    type="text"
                    value={movementAmount}
                  />
                </label>

                <label className="field">
                  <span>Motivo</span>

                  <input
                    maxLength="200"
                    onChange={(event) => setMovementReason(event.target.value)}
                    placeholder="Ejemplo: pago a proveedor"
                    required
                    value={movementReason}
                  />
                </label>

                <button className="secondary-button" disabled={loading} type="submit">
                  {loading ? "Guardando..." : "Registrar movimiento"}
                </button>
              </form>
            </section>

            <section className="cash-action-card cash-close-card">
              <div className="cash-card-heading">
                <span aria-hidden="true">
                  <CashCardIcon name="CERRAR" />
                </span>

                <div>
                  <h2>Cerrar caja</h2>

                  <p>Cuenta todo el efectivo que quedó en caja.</p>
                </div>
              </div>

              <form className="cash-action-form" onSubmit={handleClose}>
                <label className="field">
                  <span>Efectivo contado</span>

                  <input
                    autoComplete="off"
                    onChange={(event) => {
                      updateMoneyValue(setCountedCash, event.target.value);
                      setConfirmingClose(false);
                    }}
                    placeholder="Escribe el monto"
                    required
                    type="text"
                    value={countedCash}
                  />
                </label>

                <div className="cash-difference-preview">
                  <span>Diferencia calculada</span>

                  <strong
                    className={
                      previewDifference !== null && previewDifference < 0
                        ? "cash-negative"
                        : "cash-positive"
                    }
                  >
                    {previewDifference === null ? "—" : `L ${formatMoney(previewDifference)}`}
                  </strong>
                </div>

                {confirmingClose ? (
                  <p className="cash-close-confirmation" role="alert">
                    Revisa el efectivo contado. Pulsa nuevamente para confirmar el cierre.
                  </p>
                ) : null}

                <div className="cash-close-buttons">
                  {confirmingClose ? (
                    <button
                      className="secondary-button"
                      disabled={loading}
                      onClick={() => setConfirmingClose(false)}
                      type="button"
                    >
                      Cancelar
                    </button>
                  ) : null}

                  <button className="danger-button" disabled={loading} type="submit">
                    {loading
                      ? "Cerrando..."
                      : confirmingClose
                        ? "Sí, cerrar caja"
                        : "Cerrar caja"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </>
      )}
      <MiActividad token={token} revision={shift} />
    </main>
  );
}
