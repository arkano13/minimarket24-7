import { useState } from "react";
import { NOMBRE_SISTEMA } from "@minisuper/shared";

import "./App.css";

import { login, logout } from "./services/api.js";
import { ProductosPage } from "./modules/productos/ProductosPage.jsx";
import { InventarioPage } from "./modules/inventario/InventarioPage.jsx";
import { VentasPage } from "./modules/ventas/VentasPage.jsx";
import { CajaPage } from "./modules/caja/CajaPage.jsx";
import { ClientesPage } from "./modules/clientes/ClientesPage.jsx";
import { ProveedoresPage } from "./modules/proveedores/ProveedoresPage.jsx";
import { ComprasPage } from "./modules/compras/ComprasPage.jsx";
import { ReportesPage } from "./modules/reportes/ReportesPage.jsx";
import UsuariosPage from "./modules/usuarios/UsuariosPage.jsx";
import { ConfiguracionPage } from "./modules/configuracion/ConfiguracionPage.jsx";
import { BitacoraPage } from "./modules/bitacora/BitacoraPage.jsx";
import { CancelacionesPage } from "./modules/cancelaciones/CancelacionesPage.jsx";


function ModuleIcon({ name }) {
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

  const paths = {
    VENTAS: (
      <svg {...common}>
        <circle cx="9" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.5 3h2l2.8 12.5a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L21.5 8H6" />
      </svg>
    ),
    CAJA: (
      <svg {...common}>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 6v-.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V6" />
      </svg>
    ),
    PRODUCTOS: (
      <svg {...common}>
        <path d="M21 8 12 3 3 8v8l9 5 9-5Z" />
        <path d="M3 8l9 5 9-5" />
        <path d="M12 13v8" />
      </svg>
    ),
    INVENTARIO: (
      <svg {...common}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M9 3v3h6V3" />
        <path d="M8 11h8M8 15h5" />
      </svg>
    ),
    CLIENTES: (
      <svg {...common}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M2.5 19.5c0-3.3 2.9-5.8 6.5-5.8s6.5 2.5 6.5 5.8" />
        <path d="M16.5 5.2a3.2 3.2 0 0 1 0 6.2" />
        <path d="M18.5 14.3c2.3.6 4 2.6 4 5.2" />
      </svg>
    ),
    PROVEEDORES: (
      <svg {...common}>
        <rect x="1.5" y="7" width="13" height="9" rx="1" />
        <path d="M14.5 10.5H18l3.5 3v2.5h-3" />
        <circle cx="6" cy="18.5" r="1.6" />
        <circle cx="17" cy="18.5" r="1.6" />
      </svg>
    ),
    COMPRAS: (
      <svg {...common}>
        <path d="M6 3h12l1 5H5Z" />
        <path d="M5 8v11a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8" />
        <path d="M9.5 12a2.5 2.5 0 0 0 5 0" />
      </svg>
    ),
    REPORTES: (
      <svg {...common}>
        <path d="M4 20V10M12 20V4M20 20v-7" />
        <path d="M2.5 20h19" />
      </svg>
    ),
    USUARIOS: (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M4.5 20c0-3.9 3.4-6.8 7.5-6.8s7.5 2.9 7.5 6.8" />
      </svg>
    ),
    CONFIGURACION: (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.8 7.8 0 0 0-1.7-1L15 3h-6l-.3 2.5a7.8 7.8 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.8 7.8 0 0 0 1.7 1L9 21h6l.3-2.5a7.8 7.8 0 0 0 1.7-1l2.4 1 2-3.4Z" />
      </svg>
    ),
    BITACORA: (
      <svg {...common}>
        <path d="M6 2.5h9.5L19 6v15.5H6a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 6 2.5Z" />
        <path d="M15 2.5V6h4" />
        <path d="M8 12h8M8 16h5" />
      </svg>
    ),
    DEVOLUCIONES: (
      <svg {...common}>
        <path d="M4 10h10a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9" />
        <path d="M8 5 3 10l5 5" />
      </svg>
    ),
  };

  return paths[name] ?? (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

const IMPLEMENTED_MODULES = new Set([
  "VENTAS",
  "CAJA",
  "PRODUCTOS",
  "INVENTARIO",
  "CLIENTES",
  "PROVEEDORES",
  "COMPRAS",
  "REPORTES",
  "USUARIOS",
  "CONFIGURACION",
  "BITACORA",
  "DEVOLUCIONES"
]);

function ReceiptBarcode() {
  const widths = [2, 1, 3, 1, 2, 1, 3, 1, 2, 1, 3, 2, 1, 3, 1, 2, 1, 3, 1, 2, 1, 3, 2];
  let x = 0;

  return (
    <svg
      aria-hidden="true"
      className="login-barcode"
      height="26"
      viewBox="0 0 160 26"
      width="160"
    >
      {widths.map((w, index) => {
        const rect = (
          <rect height="26" key={index} width={w} x={x} y="0" />
        );
        x += w + 2;
        return rect;
      })}
    </svg>
  );
}

function LoginScreen({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await login(usuario, contrasena);

      onLogin(session);
    } catch (requestError) {
      setError(
        requestError.message === "Failed to fetch"
          ? "No se pudo conectar con el sistema local."
          : requestError.message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-ticket-wrap">
        <span className="login-sticker">Abierto 24/7</span>

        <article className="login-ticket">
          <header className="login-ticket__brand">
            <ReceiptBarcode />
            <h1>{NOMBRE_SISTEMA}</h1>
            <p>Sistema de punto de venta</p>
          </header>

          <div className="login-ticket__intro">
            <div className="login-ticket__intro-row">
              <span className="eyebrow">Acceso al sistema</span>
              <span className="login-ticket__number">N.° 0001</span>
            </div>

            <h2>Iniciar sesión</h2>
            <p className="login-card__description">
              Ingresa con el usuario asignado para comenzar.
            </p>
          </div>

          <form className="login-ticket__form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Usuario</span>

              <input
                autoComplete="username"
                autoFocus
                disabled={loading}
                onChange={(event) => setUsuario(event.target.value)}
                placeholder="Escribe tu usuario"
                required
                value={usuario}
              />
            </label>

            <label className="field">
              <span>Contraseña</span>

              <input
                autoComplete="current-password"
                disabled={loading}
                onChange={(event) => setContrasena(event.target.value)}
                placeholder="Escribe tu contraseña"
                required
                type="password"
                value={contrasena}
              />
            </label>

            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}

            <button className="primary-button" disabled={loading} type="submit">
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

          <footer className="login-ticket__footer">
            <span className="local-badge">
              <span className="local-badge__dot" />
              Datos almacenados localmente
            </span>
          </footer>
        </article>
      </div>
    </main>
  );
}

const MENU_SECTIONS = [
  { label: "Ventas", codes: ["VENTAS", "CAJA"] },
  { label: "Catálogo", codes: ["PRODUCTOS", "INVENTARIO", "PROVEEDORES", "COMPRAS"] },
  {
    label: "Administración",
    codes: ["CLIENTES", "REPORTES", "USUARIOS", "CONFIGURACION", "BITACORA", "DEVOLUCIONES"],
  },
];

function Sidebar({ activeModule, modules, onLogout, onOpenModule, session }) {
  const [closingSession, setClosingSession] = useState(false);

  async function handleLogout() {
    setClosingSession(true);

    try {
      await logout(session.token);
    } finally {
      onLogout();
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">M</div>

        <div>
          <strong>Minimarket 24/7</strong>
          <span>Punto de venta</span>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Módulos del sistema">
        {MENU_SECTIONS.map((section) => {
          const sectionModules = section.codes
            .map((code) => modules.find((module) => module.codigo === code))
            .filter(Boolean);

          if (sectionModules.length === 0) {
            return null;
          }

          return (
            <div key={section.label}>
              <p className="sidebar__section-label">{section.label}</p>

              {sectionModules.map((module) => {
                const implemented = IMPLEMENTED_MODULES.has(module.codigo);
                const selected = activeModule === module.codigo;

                return (
                  <button
                    className={`sidebar__item ${selected ? "sidebar__item--active" : ""}`}
                    disabled={!implemented}
                    key={module.codigo}
                    onClick={() => onOpenModule(module.codigo)}
                    type="button"
                  >
                    <span className="sidebar__item-icon" aria-hidden="true">
                      <ModuleIcon name={module.codigo} />
                    </span>

                    <span className="sidebar__item-text">
                      <strong>{module.nombre}</strong>

                      {!implemented ? <small>Próximamente</small> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user">
          <span className="sidebar__avatar" aria-hidden="true">
            {session.usuario.nombre.charAt(0).toUpperCase()}
          </span>

          <div>
            <strong>{session.usuario.nombre}</strong>

            <small>{session.usuario.rol}</small>
          </div>
        </div>

        <button
          className="sidebar__logout"
          disabled={closingSession}
          onClick={handleLogout}
          type="button"
        >
          {closingSession ? "Cerrando..." : "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}

function SystemContent({ activeModule, token, currentUser }) {
  if (activeModule === "VENTAS") {
    return <VentasPage token={token} />;
  }

  if (activeModule === "CAJA") {
    return <CajaPage token={token} />;
  }

  if (activeModule === "PRODUCTOS") {
    return <ProductosPage token={token} />;
  }

  if (activeModule === "INVENTARIO") {
    return <InventarioPage token={token} />;
  }

  if (activeModule === "CLIENTES") {
    return <ClientesPage token={token} />;
  }

  if (activeModule === "PROVEEDORES") {
    return <ProveedoresPage token={token} />;
  }

  if (activeModule === "COMPRAS") {
    return <ComprasPage token={token} />;
  }

  if (activeModule === "REPORTES") {
    return <ReportesPage token={token} />;
  }

  if (activeModule === "USUARIOS") {
    return <UsuariosPage currentUser={currentUser} token={token} />;
  }

  if (activeModule === "CONFIGURACION") {
    return <ConfiguracionPage token={token} />;
  }

  if (activeModule === "BITACORA") {
    return <BitacoraPage token={token} />;
  }

    if (activeModule === "DEVOLUCIONES") {
    return <CancelacionesPage token={token} />;
  }
 

  return (
    <section className="module-placeholder">
      <p className="eyebrow">Minimarket 24/7</p>

      <h1>Selecciona una opción del menú</h1>

      <p>Los módulos disponibles aparecen en el lado izquierdo.</p>
    </section>
  );
}

function DesktopSystem({ session, onLogout }) {
  const firstImplementedModule =
    session.usuario.modulos.find((module) =>
      IMPLEMENTED_MODULES.has(module.codigo),
    )?.codigo ?? null;

  const [activeModule, setActiveModule] = useState(firstImplementedModule);

  return (
    <div className="desktop-layout">
      <Sidebar
        activeModule={activeModule}
        modules={session.usuario.modulos}
        onLogout={onLogout}
        onOpenModule={setActiveModule}
        session={session}
      />

      <section className="desktop-content">
        <SystemContent
          activeModule={activeModule}
          currentUser={session.usuario}
          token={session.token}
        />
      </section>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState(null);

  if (!session) {
    return <LoginScreen onLogin={setSession} />;
  }

  return <DesktopSystem onLogout={() => setSession(null)} session={session} />;
}