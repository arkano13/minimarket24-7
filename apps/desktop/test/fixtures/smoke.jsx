// Manual regression fixture. Never imports the application entry point and
// never contacts a real API. Open /test/fixtures/smoke.html on the Vite server.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/tokens.css";
import "../../src/styles.css";
import "../../src/App.css";
import { ComprasPage } from "../../src/modules/compras/ComprasPage.jsx";
import { CancelacionesPage } from "../../src/modules/cancelaciones/CancelacionesPage.jsx";
import { CajaPage } from "../../src/modules/caja/CajaPage.jsx";

const product = { presentacionId: 1, productoId: 1, nombre: "Cerveza de prueba", presentacion: "Unidad", costoSugerido: 20 };
const sale = { id: 1, creadoEn: "2026-08-27T18:00:00-06:00", usuario: { nombre: "Prueba" }, total: 100, estado: "COMPLETADA", productos: [{ id: 1, nombre: product.nombre, presentacion: "Unidad", cantidad: 5, precio: 20, subtotal: 100 }] };
let purchases = [];
let failWrites = false;
window.fetch = async (url, options = {}) => {
  const path = new URL(url).pathname;
  let body;
  if (path === "/api/caja/actual") return { status: 200, ok: true, async json() { return { turno: null }; } };
  if (path === "/api/caja/mi-actividad") {
    const params = new URL(url).searchParams;
    const tipo = params.get("tipo");
    const page = Number(params.get("page"));
    const records = Array.from({ length: 21 }, (_, index) => ({
      id: index + 1, tipo, monto: 100, turnoCajaId: 7,
      creadoEn: `${params.get("fecha")}T18:00:00-06:00`, estado: index === 0 ? "CANCELADA" : "COMPLETADA",
      motivo: tipo === "INGRESO" ? "Cambio de prueba" : "Pago de prueba",
      productos: [{ id: 1, nombre: "Cerveza de prueba", presentacion: "Unidad", cantidad: 5, subtotal: 100 }],
      pagos: [{ metodo: "EFECTIVO", monto: 100 }],
    }));
    return { status: 200, ok: true, async json() { return { registros: records.slice((page - 1) * 20, page * 20), hayMas: page === 1 }; } };
  }
  if (options.method === "POST" && failWrites) throw new TypeError("Failed to fetch");
  if (path === "/api/compras/proveedores") body = { proveedores: [{ id: 1, nombre: "Proveedor de prueba" }] };
  else if (path === "/api/compras/productos") body = { productos: [product] };
  else if (path === "/api/compras" && options.method === "POST") {
    const input = JSON.parse(options.body);
    const compra = { id: purchases.length + 1, proveedor: { nombre: "Proveedor de prueba" }, usuario: { nombre: "Prueba" }, creadoEn: sale.creadoEn, estado: "RECIBIDA", total: input.productos.reduce((sum, item) => sum + Number(item.costoTotal), 0), productos: input.productos.map((item) => ({ ...product, ...item, id: 1, costo: Number(item.costoTotal) / Number(item.cantidad), subtotal: Number(item.costoTotal) })) };
    purchases.push(compra);
    body = { compra };
  } else if (path === "/api/compras") body = { compras: purchases };
  else if (/^\/api\/compras\/\d+$/.test(path)) body = { compra: purchases.find((item) => item.id === Number(path.split("/").pop())) };
  else if (path === "/api/ventas") body = { ventas: [sale] };
  else if (path === "/api/ventas/1/cancelar") { sale.estado = "CANCELADA"; body = { mensaje: "Venta de prueba cancelada." }; }
  else throw new Error(`Ruta de prueba no configurada: ${path}`);
  return { status: 200, ok: true, async json() { return body; } };
};

function Smoke() {
  const [view, setView] = useState("compras");
  return <>
    <header style={{ padding: 20 }}>
      <strong>PRUEBA LOCAL — datos ficticios, sin servidor</strong>
      <button onClick={() => setView("compras")}>Probar compras</button>
      <button onClick={() => setView("cancelaciones")}>Probar cancelaciones</button>
      <button onClick={() => setView("caja")}>Probar caja</button>
      <label><input type="checkbox" onChange={(event) => { failWrites = event.target.checked; }} />Simular fallo al guardar</label>
    </header>
    {view === "compras" ? <ComprasPage token="fake" /> : view === "caja" ? <CajaPage token="fake" /> : <CancelacionesPage token="fake" />}
  </>;
}
createRoot(document.getElementById("root")).render(<Smoke />);
