import { useEffect, useMemo, useState } from "react";
import "./UsuariosPage.css";

import {
  createUser as createUserRequest,
  listUserModules,
  listUsers,
  resetUserPassword,
  updateUser as updateUserRequest,
  updateUserStatus,
} from "../../services/api.js";

const EMPTY_FORM = {
  nombre: "",
  usuario: "",
  rol: "CAJERO",
  contrasena: "",
  confirmarContrasena: "",
  modulos: [],
};

function UsersIcon({ name }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  if (name === "EDIT") {
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    );
  }

  if (name === "KEY") {
    return (
      <svg {...common}>
        <circle cx="8" cy="15" r="4" />
        <path d="M10.5 12.5 20 3M17 6l3 3M14 9l2.5 2.5" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function formatDate(value) {
  if (!value) {
    return "Todavía no ha iniciado sesión";
  }

  return new Intl.DateTimeFormat("es-HN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getInitialModules(modules) {
  const preferred = ["VENTAS", "CAJA"];

  return modules.filter((module) => preferred.includes(module.codigo)).map((module) => module.codigo);
}

export default function UsuariosPage({ token, currentUser }) {
  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [roles, setRoles] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("VIEW");
  const [form, setForm] = useState(EMPTY_FORM);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmStatusChange, setConfirmStatusChange] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedUser = users.find((user) => user.id === selectedUserId);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return users;
    }

    return users.filter((user) => {
      return (
        user.nombre.toLowerCase().includes(term) ||
        user.usuario.toLowerCase().includes(term) ||
        user.rol.toLowerCase().includes(term)
      );
    });
  }, [search, users]);

  async function loadData(userIdToSelect = null) {
    setLoading(true);
    setError("");

    try {
      const usersResponse = await listUsers(token);
      const optionsResponse = await listUserModules(token);

      const loadedUsers = usersResponse.usuarios ?? [];

      setUsers(loadedUsers);
      setModules(optionsResponse.modulos ?? []);
      setRoles(optionsResponse.roles ?? []);

      const requestedUserExists = loadedUsers.some((user) => user.id === userIdToSelect);

      if (requestedUserExists) {
        setSelectedUserId(userIdToSelect);
      } else if (loadedUsers.length > 0) {
        setSelectedUserId(loadedUsers[0].id);
      } else {
        setSelectedUserId(null);
      }
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  function clearNotices() {
    setError("");
    setMessage("");
  }

  function selectUser(userId) {
    clearNotices();
    setSelectedUserId(userId);
    setMode("VIEW");
    setShowPasswordForm(false);
    setConfirmStatusChange(false);
  }

  function startCreate() {
    clearNotices();

    setForm({ ...EMPTY_FORM, modulos: getInitialModules(modules) });

    setMode("CREATE");
    setSelectedUserId(null);
    setShowPasswordForm(false);
    setConfirmStatusChange(false);
  }

  function startEdit() {
    if (!selectedUser) {
      return;
    }

    clearNotices();

    setForm({
      nombre: selectedUser.nombre,
      usuario: selectedUser.usuario,
      rol: selectedUser.rol,
      contrasena: "",
      confirmarContrasena: "",
      modulos: selectedUser.modulos.map((module) => module.codigo),
    });

    setMode("EDIT");
    setShowPasswordForm(false);
    setConfirmStatusChange(false);
  }

  function cancelForm() {
    clearNotices();
    setMode("VIEW");

    if (!selectedUserId && users.length > 0) {
      setSelectedUserId(users[0].id);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeRole(role) {
    setForm((current) => ({
      ...current,
      rol: role,
      modulos: role === "ADMINISTRADOR" ? modules.map((module) => module.codigo) : current.modulos,
    }));
  }

  function toggleModule(moduleCode) {
    if (form.rol === "ADMINISTRADOR") {
      return;
    }

    setForm((current) => {
      const alreadySelected = current.modulos.includes(moduleCode);

      return {
        ...current,
        modulos: alreadySelected
          ? current.modulos.filter((code) => code !== moduleCode)
          : [...current.modulos, moduleCode],
      };
    });
  }

  async function saveUser(event) {
    event.preventDefault();
    clearNotices();

    if (mode === "CREATE" && form.contrasena !== form.confirmarContrasena) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        nombre: form.nombre,
        usuario: form.usuario,
        rol: form.rol,
        modulos: form.modulos,
      };

      let response;

      if (mode === "CREATE") {
        response = await createUserRequest(token, { ...payload, contrasena: form.contrasena });
      } else {
        response = await updateUserRequest(token, selectedUser.id, payload);
      }

      await loadData(response.usuario.id);
      setMode("VIEW");
      setMessage(response.mensaje);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeUserStatus() {
    if (!selectedUser) {
      return;
    }

    clearNotices();
    setSaving(true);

    try {
      const response = await updateUserStatus(token, selectedUser.id, !selectedUser.activo);

      setUsers((current) =>
        current.map((user) => (user.id === response.usuario.id ? response.usuario : user)),
      );

      setMessage(response.mensaje);
      setConfirmStatusChange(false);
    } catch (statusError) {
      setError(statusError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveNewPassword(event) {
    event.preventDefault();
    clearNotices();

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSaving(true);

    try {
      const response = await resetUserPassword(token, selectedUser.id, password);

      setPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
      setMessage(response.mensaje);
    } catch (passwordError) {
      setError(passwordError.message);
    } finally {
      setSaving(false);
    }
  }

  function roleName(roleCode) {
    return roles.find((role) => role.codigo === roleCode)?.nombre ?? roleCode;
  }

  if (loading) {
    return (
      <section className="users-page">
        <div className="users-loading">Cargando usuarios…</div>
      </section>
    );
  }

  return (
    <section className="users-page">
      <header className="users-header">
        <div>
          <span className="users-eyebrow">Acceso al sistema</span>

          <h1>Usuarios</h1>

          <p>Administra quién puede entrar y qué módulos puede utilizar.</p>
        </div>

        <button className="users-primary-button" onClick={startCreate} type="button">
          + Nuevo usuario
        </button>
      </header>

      {error && <div className="users-alert users-alert-error">{error}</div>}
      {message && <div className="users-alert users-alert-success">{message}</div>}

      <div className="users-layout">
        <aside className="users-sidebar">
          <div className="users-search">
            <span aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>

            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar usuario"
              type="search"
              value={search}
            />
          </div>

          <div className="users-count">{filteredUsers.length} usuarios</div>

          <div className="users-list">
            {filteredUsers.map((user) => (
              <button
                className={`users-list-item ${
                  selectedUserId === user.id && mode === "VIEW" ? "is-selected" : ""
                }`}
                key={user.id}
                onClick={() => selectUser(user.id)}
                type="button"
              >
                <span className="users-avatar">{user.nombre.charAt(0).toUpperCase()}</span>

                <span className="users-list-information">
                  <strong>{user.nombre}</strong>

                  <small>
                    @{user.usuario} · {roleName(user.rol)}
                  </small>
                </span>

                <span
                  className={`users-status-dot ${user.activo ? "is-active" : "is-inactive"}`}
                  title={user.activo ? "Activo" : "Desactivado"}
                />
              </button>
            ))}

            {filteredUsers.length === 0 && (
              <div className="users-empty">No se encontraron usuarios.</div>
            )}
          </div>
        </aside>

        <main className="users-content">
          {(mode === "CREATE" || mode === "EDIT") && (
            <form className="users-form" onSubmit={saveUser}>
              <div className="users-section-heading">
                <div>
                  <span className="users-eyebrow">
                    {mode === "CREATE" ? "Nueva cuenta" : "Editar cuenta"}
                  </span>

                  <h2>{mode === "CREATE" ? "Crear usuario" : `Editar a ${selectedUser?.nombre}`}</h2>
                </div>
              </div>

              <div className="users-fields-grid">
                <label className="users-field">
                  <span>Nombre completo</span>

                  <input
                    autoFocus
                    maxLength={120}
                    onChange={(event) => updateField("nombre", event.target.value)}
                    placeholder="Ejemplo: María López"
                    required
                    type="text"
                    value={form.nombre}
                  />
                </label>

                <label className="users-field">
                  <span>Usuario para iniciar sesión</span>

                  <input
                    autoCapitalize="none"
                    autoComplete="off"
                    maxLength={50}
                    onChange={(event) => updateField("usuario", event.target.value)}
                    placeholder="Ejemplo: maria"
                    required
                    spellCheck="false"
                    type="text"
                    value={form.usuario}
                  />
                </label>

                {mode === "CREATE" && (
                  <>
                    <label className="users-field">
                      <span>Contraseña</span>

                      <input
                        autoComplete="new-password"
                        minLength={8}
                        onChange={(event) => updateField("contrasena", event.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        required
                        type="password"
                        value={form.contrasena}
                      />
                    </label>

                    <label className="users-field">
                      <span>Confirmar contraseña</span>

                      <input
                        autoComplete="new-password"
                        minLength={8}
                        onChange={(event) => updateField("confirmarContrasena", event.target.value)}
                        placeholder="Escríbela nuevamente"
                        required
                        type="password"
                        value={form.confirmarContrasena}
                      />
                    </label>
                  </>
                )}
              </div>

              <div className="users-form-section">
                <h3>¿Qué trabajo realizará?</h3>

                <p>Selecciona el tipo de usuario. Esto ayuda a organizar sus permisos.</p>

                <div className="users-role-grid">
                  {roles.map((role) => (
                    <button
                      className={`users-role-option ${form.rol === role.codigo ? "is-selected" : ""}`}
                      key={role.codigo}
                      onClick={() => changeRole(role.codigo)}
                      type="button"
                    >
                      <strong>{role.nombre}</strong>
                      <span>{role.descripcion}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="users-form-section">
                <h3>Módulos permitidos</h3>

                <p>
                  Solamente verá las opciones seleccionadas. Los administradores reciben acceso
                  completo.
                </p>

                <div className="users-module-grid">
                  {modules.map((module) => {
                    const selected =
                      form.rol === "ADMINISTRADOR" || form.modulos.includes(module.codigo);

                    return (
                      <label
                        className={`users-module-option ${selected ? "is-selected" : ""}`}
                        key={module.codigo}
                      >
                        <input
                          checked={selected}
                          disabled={form.rol === "ADMINISTRADOR"}
                          onChange={() => toggleModule(module.codigo)}
                          type="checkbox"
                        />

                        <span>
                          <strong>{module.nombre}</strong>
                          <small>{module.tipo}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="users-form-actions">
                <button
                  className="users-secondary-button"
                  disabled={saving}
                  onClick={cancelForm}
                  type="button"
                >
                  Cancelar
                </button>

                <button className="users-primary-button" disabled={saving} type="submit">
                  {saving ? "Guardando…" : mode === "CREATE" ? "Crear usuario" : "Guardar cambios"}
                </button>
              </div>
            </form>
          )}

          {mode === "VIEW" && selectedUser && (
            <div className="users-detail">
              <div className="users-detail-header">
                <div className="users-profile">
                  <span className="users-avatar users-avatar-large">
                    {selectedUser.nombre.charAt(0).toUpperCase()}
                  </span>

                  <div>
                    <span className="users-eyebrow">Usuario seleccionado</span>

                    <h2>{selectedUser.nombre}</h2>

                    <p>@{selectedUser.usuario}</p>
                  </div>
                </div>

                <span
                  className={`users-status-badge ${selectedUser.activo ? "is-active" : "is-inactive"}`}
                >
                  {selectedUser.activo ? "Activo" : "Desactivado"}
                </span>
              </div>

              <div className="users-summary-grid">
                <div className="users-summary-card">
                  <span>Rol</span>
                  <strong>{roleName(selectedUser.rol)}</strong>
                </div>

                <div className="users-summary-card">
                  <span>Módulos permitidos</span>
                  <strong>{selectedUser.modulos.length}</strong>
                </div>

                <div className="users-summary-card">
                  <span>Último acceso</span>
                  <strong>{formatDate(selectedUser.ultimoAcceso)}</strong>
                </div>
              </div>

              <div className="users-detail-section">
                <h3>Opciones que puede utilizar</h3>

                <div className="users-permission-list">
                  {selectedUser.modulos.map((module) => (
                    <span key={module.codigo}>
                      <UsersIcon name="CHECK" />
                      {module.nombre}
                    </span>
                  ))}

                  {selectedUser.modulos.length === 0 && (
                    <p>Este usuario no tiene módulos asignados.</p>
                  )}
                </div>
              </div>

              <div className="users-management">
                <h3>Administrar usuario</h3>

                <div className="users-management-buttons">
                  <button className="users-secondary-button" onClick={startEdit} type="button">
                    <UsersIcon name="EDIT" />
                    Editar usuario
                  </button>

                  <button
                    className="users-secondary-button"
                    onClick={() => {
                      clearNotices();
                      setShowPasswordForm((current) => !current);
                      setConfirmStatusChange(false);
                    }}
                    type="button"
                  >
                    <UsersIcon name="KEY" />
                    Cambiar contraseña
                  </button>

                  <button
                    className={selectedUser.activo ? "users-danger-button" : "users-activate-button"}
                    disabled={selectedUser.id === currentUser?.id}
                    onClick={() => {
                      clearNotices();
                      setConfirmStatusChange(true);
                      setShowPasswordForm(false);
                    }}
                    type="button"
                  >
                    {selectedUser.activo ? "Desactivar usuario" : "Activar usuario"}
                  </button>
                </div>

                {selectedUser.id === currentUser?.id && (
                  <p className="users-own-account-note">Tu propia cuenta no puede ser desactivada.</p>
                )}

                {showPasswordForm && (
                  <form className="users-password-form" onSubmit={saveNewPassword}>
                    <div>
                      <h4>Nueva contraseña</h4>
                      <p>El usuario deberá utilizarla en su próximo inicio de sesión.</p>
                    </div>

                    <label className="users-field">
                      <span>Nueva contraseña</span>
                      <input
                        autoComplete="new-password"
                        minLength={8}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        required
                        type="password"
                        value={password}
                      />
                    </label>

                    <label className="users-field">
                      <span>Confirmar contraseña</span>
                      <input
                        autoComplete="new-password"
                        minLength={8}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Escríbela nuevamente"
                        required
                        type="password"
                        value={confirmPassword}
                      />
                    </label>

                    <button className="users-primary-button" disabled={saving} type="submit">
                      {saving ? "Guardando…" : "Guardar contraseña"}
                    </button>
                  </form>
                )}

                {confirmStatusChange && (
                  <div className="users-confirmation">
                    <div>
                      <strong>
                        {selectedUser.activo ? "¿Desactivar este usuario?" : "¿Activar este usuario?"}
                      </strong>

                      <p>
                        {selectedUser.activo
                          ? "Ya no podrá iniciar sesión hasta que vuelva a ser activado."
                          : "Podrá volver a iniciar sesión y utilizar sus módulos."}
                      </p>
                    </div>

                    <div>
                      <button
                        className="users-secondary-button"
                        disabled={saving}
                        onClick={() => setConfirmStatusChange(false)}
                        type="button"
                      >
                        Cancelar
                      </button>

                      <button
                        className={selectedUser.activo ? "users-danger-button" : "users-activate-button"}
                        disabled={saving}
                        onClick={changeUserStatus}
                        type="button"
                      >
                        {saving ? "Guardando…" : "Sí, confirmar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "VIEW" && !selectedUser && (
            <div className="users-empty users-empty-large">
              Selecciona un usuario o crea uno nuevo.
            </div>
          )}
        </main>
      </div>
    </section>
  );
}