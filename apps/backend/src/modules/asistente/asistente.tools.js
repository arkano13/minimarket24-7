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
    description: "Resumen de ventas completadas de uno o varios días comerciales, opcionalmente de turnos específicos (A, B o C). Es el MISMO cálculo del informe de turno que llega por WhatsApp. Incluye: total vendido, cuadre total, efectivo esperado, desglose por método de pago (efectivo/tarjeta/transferencia/crédito), ventas a crédito con cliente, desglose por hora y desglose COMPLETO POR PRODUCTO con cantidad, monto y ganancia. Úsala para '¿cuánto se vendió en el turno C?', '¿cuánto se vendió ayer?' o de un producto en un rango — filtrá vos mismo los productos según lo que te pidan.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        from: { type: Type.STRING, description: "Día comercial inicial YYYY-MM-DD" },
        to: { type: Type.STRING, description: "Día comercial final YYYY-MM-DD, opcional (default = from)" },
        turnos: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Turnos a incluir: 'A', 'B' y/o 'C'. Vacío u omitido = día completo (A, B y C).",
        },
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
    description: "Lista los cierres de caja de un día comercial (por defecto hoy): turno (A, B o C), hora de apertura y cierre en hora de Honduras, cajero, ventas, efectivo, tarjeta, transferencia, entradas, salidas, efectivo esperado, contado y diferencia (faltante/sobrante).",
    parameters: {
      type: Type.OBJECT,
      properties: { date: { type: Type.STRING, description: "YYYY-MM-DD, opcional" } },
    },
  },
];