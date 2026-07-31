const API_URL = "http://127.0.0.1:3001/api";

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

export function listProducts(token, search = "") {
  const query = search
    ? `?buscar=${encodeURIComponent(search)}`
    : "";

  return request(`/productos${query}`, {
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

export function listInventoryMovements(token, productId = "") {
  const query = productId
    ? `?productoId=${encodeURIComponent(productId)}`
    : "";

  return request(`/inventario/movimientos${query}`, {
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