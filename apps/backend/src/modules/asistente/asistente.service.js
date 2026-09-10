// apps/backend/src/modules/asistente/asistente.service.js
import { GoogleGenAI } from "@google/genai";
import { tools } from "./asistente.tools.js";

import { listProducts, listLowStockProducts } from "../productos/productos.service.js";
import { listSuppliers } from "../proveedores/proveedores.service.js";
import { listPurchases, getPurchase } from "../compras/compras.service.js";
import { listSales } from "../ventas/ventas.service.js";
import { getSalesReport } from "../reportes/reportes.service.js";
import { listInventoryMovements } from "../inventario/inventario.service.js";
import { listSpecialClients } from "../clientes/clientes.service.js";
import { listCashShifts } from "../caja/caja.service.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_PROMPT = `Eres el asistente de consultas de Minimarket 24/7. SOLO puedes leer
información — no tienes ninguna herramienta para crear, editar, anular o borrar nada.
Si te piden registrar una venta, anular una compra, ajustar stock o algo similar, explica
que eso se hace desde el sistema/panel directamente, no desde aquí.

FECHA Y HORA ACTUAL: ${new Date().toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" })}.
Cuando te pidan "hoy", "ayer", "esta semana", calcula tú mismo las fechas a partir de la de arriba.

Montos en Lempiras (L). Sé breve y directo. Para listas, una línea por elemento, sin
negritas de markdown.`;

async function executeTool(name, args) {
  try {
    switch (name) {
      case "list_products":
        return await listProducts(args.search ?? "");
      case "list_low_stock_products":
        return await listLowStockProducts();
      case "list_suppliers":
        return await listSuppliers(args.search ?? "");
      case "list_purchases":
        return await listPurchases();
      case "get_purchase":
        return await getPurchase(args.purchaseId);
      case "list_sales":
        return await listSales(args.search ?? "");
      case "get_sales_report":
        return await getSalesReport(args.from, args.to);
      case "list_inventory_movements":
        return await listInventoryMovements(args.productId);
      case "list_special_clients":
        return await listSpecialClients(args.search ?? "");
      case "list_cash_shifts":
        return await listCashShifts(args.date);
      default:
        return { error: "Herramienta desconocida" };
    }
  } catch (err) {
    return { error: err.message ?? "Error al consultar los datos." };
  }
}

export async function handleMessage(messages) {
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
  }));
  while (history.length > 0 && history[0].role === "model") history.shift();

  const chat = ai.chats.create({
    model: "gemini-3.6-flash",
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: tools }],
    },
    history,
  });

  try {
    let response = await chat.sendMessage({ message: messages[messages.length - 1].content });

    while (response.functionCalls && response.functionCalls.length > 0) {
      const functionResponses = await Promise.all(
        response.functionCalls.map(async (fc) => ({
          functionResponse: {
            id: fc.id,
            name: fc.name,
            response: { result: await executeTool(fc.name, fc.args) },
          },
        })),
      );

      response = await chat.sendMessage({ message: functionResponses });
    }

    return response.text || "No pude procesar tu consulta, intenta de nuevo.";
  } catch (err) {
    console.error("Error en asistente:", err);
    if (err.status === 429) {
      return "Estoy recibiendo muchas consultas ahora mismo, dame un momento e inténtalo de nuevo.";
    }
    return "Tuve un problema procesando tu consulta, intenta de nuevo.";
  }
}