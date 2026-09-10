// apps/backend/src/modules/asistente/asistente.tools.js
import { Type } from "@google/genai";

export const tools = [
  {
    name: "list_products",
    description: "Busca productos por nombre, SKU o código de barras. Devuelve stock, precio y presentaciones",
    parameters: {
      type: Type.OBJECT,
      properties: {
        search: { type: Type.STRING, description: "Término de búsqueda, vacío para listar todos" },
      },
    },
  },
  {
    name: "list_low_stock_products",
    description: "Lista productos activos cuyo stock actual está en o por debajo del mínimo configurado",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "list_suppliers",
    description: "Lista proveedores activos, opcionalmente filtrados por nombre, contacto o teléfono",
    parameters: {
      type: Type.OBJECT,
      properties: { search: { type: Type.STRING } },
    },
  },
  {
    name: "list_purchases",
    description: "Lista las compras registradas a proveedores",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "get_purchase",
    description: "Detalle completo de una compra específica por su ID",
    parameters: {
      type: Type.OBJECT,
      properties: { purchaseId: { type: Type.NUMBER } },
      required: ["purchaseId"],
    },
  },
  {
    name: "list_sales",
    description: "Lista las últimas ventas, opcionalmente filtradas por nombre de cliente o cajero",
    parameters: {
      type: Type.OBJECT,
      properties: { search: { type: Type.STRING } },
    },
  },
  {
    name: "get_sales_report",
    description: "Resumen de ventas completadas en un rango de fechas: totales y desglose por método de pago",
    parameters: {
      type: Type.OBJECT,
      properties: {
        from: { type: Type.STRING, description: "YYYY-MM-DD" },
        to: { type: Type.STRING, description: "YYYY-MM-DD, opcional (default = from)" },
      },
    },
  },
  {
    name: "list_inventory_movements",
    description: "Historial de movimientos de inventario, opcionalmente filtrado por producto",
    parameters: {
      type: Type.OBJECT,
      properties: { productId: { type: Type.NUMBER } },
    },
  },
  {
    name: "list_special_clients",
    description: "Lista clientes con precios especiales configurados",
    parameters: {
      type: Type.OBJECT,
      properties: { search: { type: Type.STRING } },
    },
  },
  {
    name: "list_cash_shifts",
    description: "Lista todos los turnos de caja de un día (por defecto hoy), con totales y diferencias",
    parameters: {
      type: Type.OBJECT,
      properties: { date: { type: Type.STRING, description: "YYYY-MM-DD, opcional" } },
    },
  },
];