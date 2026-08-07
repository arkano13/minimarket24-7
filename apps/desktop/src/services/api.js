const API_URL = `${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:3001"}/api`;

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(body?.error ?? "No se pudo completar la solicitud.");
  }

  return body;
}

export function login(usuario, contrasena) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      usuario,
      contrasena,
    }),
  });
}

export function getCurrentUser(token) {
  return request("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function logout(token) {
  return request("/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function listCategories(token) {
  return request("/productos/categorias", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createCategory(token, nombre) {
  return request("/productos/categorias", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ nombre }),
  });
}

export function listProducts(token, search = "", page = 1, perPage) {
  const params = new URLSearchParams();

  if (search) {
    params.set("buscar", search);
  }

  params.set("page", page);

  if (perPage) {
    params.set("perPage", perPage);
  }

  return request(`/productos?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createProduct(token, product) {
  return request("/productos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(product),
  });
}

export function updateProduct(token, productId, product) {
  return request(`/productos/${productId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(product),
  });
}

export function listInventoryMovements(token, productId = "", page = 1) {
  const params = new URLSearchParams();

  if (productId) {
    params.set("productoId", productId);
  }

  params.set("page", page);

  return request(`/inventario/movimientos?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createInventoryMovement(token, movement) {
  return request("/inventario/movimientos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(movement),
  });
}

export function searchSaleProducts(token, search = "", clientId = "") {
  const params = new URLSearchParams();

  if (search) {
    params.set("buscar", search);
  }

  if (clientId) {
    params.set("clienteId", clientId);
  }

  const query = params.size ? `?${params.toString()}` : "";

  return request(`/ventas/productos${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function searchSaleClients(token, search = "") {
  const query = search
    ? `?buscar=${encodeURIComponent(search)}`
    : "";

  return request(`/ventas/clientes${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createSale(token, sale) {
  return request("/ventas", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(sale),
  });
}

export function listSales(token, search = "") {
  const query = search ? `?buscar=${encodeURIComponent(search)}` : "";

  return request(`/ventas${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function cancelSale(token, saleId) {
  return request(`/ventas/${saleId}/cancelar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function repriceCart(token, presentacionIds, clienteId) {
  return request(`/ventas/reprecio`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      presentacionIds,
      clienteId: clienteId ?? null,
    }),
  });
}

export function getCurrentCashShift(token) {
  return request("/caja/actual", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function openCashShift(token, data) {
  return request("/caja/abrir", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export function createCashMovement(token, data) {
  return request("/caja/movimientos", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export function closeCashShift(token, data) {
  return request("/caja/cerrar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export function listSpecialClients(token, search = "") {
  const query = search
    ? `?buscar=${encodeURIComponent(search)}`
    : "";

  return request(`/clientes${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createSpecialClient(token, data) {
  return request("/clientes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export function updateSpecialClient(token, clientId, data) {
  return request(`/clientes/${clientId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export function searchSpecialPriceProducts(token, search = "") {
  const query = search
    ? `?buscar=${encodeURIComponent(search)}`
    : "";

  return request(`/clientes/productos${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function setClientSpecialPrice(token, clientId, data) {
  return request(`/clientes/${clientId}/precios`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
}

export function removeClientSpecialPrice(
  token,
  clientId,
  presentationId,
) {
  return request(
    `/clientes/${clientId}/precios/${presentationId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function listSuppliers(
  token,
  search = "",
) {
  const query = search
    ? `?buscar=${encodeURIComponent(search)}`
    : "";

  return request(`/proveedores${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createSupplier(token, data) {
  return request("/proveedores", {
    method: "POST",

    headers: {
      Authorization: `Bearer ${token}`,
    },

    body: JSON.stringify(data),
  });
}

export function updateSupplier(
  token,
  supplierId,
  data,
) {
  return request(
    `/proveedores/${supplierId}`,
    {
      method: "PATCH",

      headers: {
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify(data),
    },
  );
}

export function listPurchases(
  token,
  search = "",
  proveedorId = "",
) {
  const params = new URLSearchParams();

  if (search) {
    params.set("buscar", search);
  }

  if (proveedorId) {
    params.set("proveedorId", proveedorId);
  }

  const query = params.size
    ? `?${params.toString()}`
    : "";

  return request(`/compras${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getPurchase(
  token,
  purchaseId,
) {
  return request(`/compras/${purchaseId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function searchPurchaseSuppliers(
  token,
  search = "",
) {
  const query = search
    ? `?buscar=${encodeURIComponent(search)}`
    : "";

  return request(
    `/compras/proveedores${query}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function searchPurchaseProducts(
  token,
  search = "",
) {
  const query = search
    ? `?buscar=${encodeURIComponent(search)}`
    : "";

  return request(
    `/compras/productos${query}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function createPurchase(token, data) {
  return request("/compras", {
    method: "POST",

    headers: {
      Authorization: `Bearer ${token}`,
    },

    body: JSON.stringify(data),
  });
}

export function cancelPurchase(token, purchaseId) {
  return request(`/compras/${purchaseId}/anular`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getSalesReport(
  token,
  from,
  to,
) {
  const params = new URLSearchParams();

  if (from) {
    params.set("desde", from);
  }

  if (to) {
    params.set("hasta", to);
  }

  const query = params.size
    ? `?${params.toString()}`
    : "";

  return request(
    `/reportes/ventas${query}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export function listUsers(token) {
  return request("/usuarios", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function listUserModules(token) {
  return request("/usuarios/modulos", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function createUser(token, user) {
  return request("/usuarios", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(user),
  });
}

export function updateUser(token, userId, user) {
  return request(`/usuarios/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(user),
  });
}

export function updateUserStatus(token, userId, active) {
  return request(`/usuarios/${userId}/estado`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      activo: active,
    }),
  });
}

export function resetUserPassword(
  token,
  userId,
  password,
) {
  return request(`/usuarios/${userId}/contrasena`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      contrasena: password,
    }),
  });
}

export function getConfiguration(token) {
  return request("/configuracion", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function updateConfiguration(
  token,
  configuration,
) {
  return request("/configuracion", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(configuration),
  });
}

export function listBitacora(token, filters = {}) {
  const params = new URLSearchParams();

  if (filters.desde) {
    params.set("desde", filters.desde);
  }

  if (filters.hasta) {
    params.set("hasta", filters.hasta);
  }

  if (filters.usuarioId) {
    params.set("usuarioId", filters.usuarioId);
  }

  if (filters.origen) {
    params.set("origen", filters.origen);
  }

  if (filters.page) {
    params.set("page", filters.page);
  }

  const query = params.size ? `?${params.toString()}` : "";

  return request(`/bitacora${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}