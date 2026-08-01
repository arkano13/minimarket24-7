import { useState } from "react";
import { NOMBRE_SISTEMA } from "@minisuper/shared";
import { login, logout } from "./services/api.js";
import { ProductosPage } from "./modules/productos/ProductosPage.jsx";
import { InventarioPage } from "./modules/inventario/InventarioPage.jsx";
import { VentasPage } from "./modules/ventas/VentasPage.jsx";
import { CajaPage } from "./modules/caja/CajaPage.jsx";
import { ClientesPage } from "./modules/clientes/ClientesPage.jsx";
import { ProveedoresPage } from "./modules/proveedores/ProveedoresPage.jsx";
import { ComprasPage } from "./modules/compras/ComprasPage.jsx";
import { ReportesPage } from "./modules/reportes/ReportesPage.jsx";

const MODULE_ICONS = {
  VENTAS: "🛒",
  CAJA: "💵",
  PRODUCTOS: "📦",
  INVENTARIO: "📋",
  CLIENTES: "👥",
  PROVEEDORES: "🚚",
  COMPRAS: "🧾",
  REPORTES: "📊",
  USUARIOS: "👤",
  CONFIGURACION: "⚙️",
};

const IMPLEMENTED_MODULES = new Set([
  "VENTAS",
  "CAJA",
  "PRODUCTOS",
  "INVENTARIO",
  "CLIENTES",
  "PROVEEDORES",
  "COMPRAS",
  "REPORTES",
]);

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
      <section className="login-brand">
        <div className="brand-mark" aria-hidden="true">
          M
        </div>

        <p className="eyebrow">Sistema de escritorio</p>
        <h1>{NOMBRE_SISTEMA}</h1>

        <p className="login-brand__description">
          Ventas, caja e inventario del minisúper en un solo lugar.
        </p>

        <div className="local-badge">
          <span className="local-badge__dot" />
          Datos almacenados localmente
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">Acceso al sistema</p>
            <h2>Iniciar sesión</h2>

            <p className="login-card__description">
              Ingresa con el usuario asignado para comenzar.
            </p>
          </div>

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
      </section>
    </main>
  );
}

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
          <strong>Minisúper</strong>
          <span>Punto de venta</span>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Módulos del sistema">
        <p className="sidebar__section-label">Menú</p>

        {modules.map((module) => {
          const implemented = IMPLEMENTED_MODULES.has(module.codigo);
          const selected = activeModule === module.codigo;

          return (
            <button
              className={`sidebar__item ${
                selected ? "sidebar__item--active" : ""
              }`}
              disabled={!implemented}
              key={module.codigo}
              onClick={() => onOpenModule(module.codigo)}
              type="button"
            >
              <span className="sidebar__item-icon" aria-hidden="true">
                {MODULE_ICONS[module.codigo] ?? "•"}
              </span>

              <span className="sidebar__item-text">
                <strong>{module.nombre}</strong>

                {!implemented ? <small>Próximamente</small> : null}
              </span>
            </button>
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

function SystemContent({ activeModule, token }) {
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

  return (
    <section className="module-placeholder">
      <p className="eyebrow">Minisúper POS</p>
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
        <SystemContent activeModule={activeModule} token={session.token} />
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
