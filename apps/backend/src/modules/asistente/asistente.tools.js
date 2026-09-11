// apps/backend/src/modules/asistente/asistente.tools.js
import { Type } from "@google/genai";

export const tools = [
  {
    name: "list_products",
    description: "Busca UN producto específico por nombre, SKU o código de barras. Para preguntas sobre un tipo o categoría de producto en general (ej: cervezas, bebidas, snacks), usa list_products_by_category en su lugar.",
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
    name: "list_categories",
    description: "Lista todas las categorías de productos existentes. Úsala primero cuando no estés seguro de qué categoría corresponde a lo que preguntan (ej: 'cervezas', 'snacks'), para elegir la categoría real antes de llamar a list_products_by_category.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: "list_products_by_category",
    description: "Lista TODOS los productos de una categoría. Úsala para preguntas generales sobre un tipo de producto (ej: '¿cuántas cervezas tengo?', 'productos de la categoría bebidas'), no para un producto específico por nombre — para eso usa list_products.",
    parameters: {
      type: Type.OBJECT,
      properties: { categoria: { type: Type.STRING, description: "Nombre exacto o parcial de la categoría" } },
      required: ["categoria"],
    },
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
    description: "Resumen de ventas completadas en un rango de fechas. Incluye: total general, desglose por método de pago (efectivo/tarjeta/transferencia), desglose por hora del día, y desglose COMPLETO POR PRODUCTO con cantidad vendida, monto y ganancia de cada uno. Úsala también para preguntas sobre cuánto se vendió de un producto o tipo de producto específico en un rango de fechas — filtrá vos mismo el resultado según lo que te pidan (ej: solo los productos de cerveza) en vez de decir que no tenés esa información.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        from: { type: Type.STRING, description: "YYYY-MM-DD" },
        to: { type: Type.STRING, description: "YYYY-MM-DD, opcional (default = from)" },
      },
      required: ["from"],
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