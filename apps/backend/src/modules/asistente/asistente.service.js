// apps/backend/src/modules/asistente/asistente.service.js
import { GoogleGenAI } from "@google/genai";
import { tools } from "./asistente.tools.js";

import {
  listProducts,
  listLowStockProducts,
  listCategories,
  listProductsByCategory,
} from "../productos/productos.service.js";
import { listSuppliers } from "../proveedores/proveedores.service.js";
import { listPurchases, getPurchase } from "../compras/compras.service.js";
import { listSales } from "../ventas/ventas.service.js";
import { getSalesReport } from "../reportes/reportes.service.js";
import { listInventoryMovements } from "../inventario/inventario.service.js";
import { listSpecialClients } from "../clientes/clientes.service.js";
import { listCashShifts } from "../caja/caja.service.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODELO = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

const SYSTEM_PROMPT = `Eres el asistente de consultas de Minimarket 24/7. SOLO puedes leer
información — no tienes ninguna herramienta para crear, editar, anular o borrar nada.
Si te piden registrar una venta, anular una compra, ajustar stock o algo similar, explica
que eso se hace desde el sistema/panel directamente, no desde aquí.

FECHA Y HORA ACTUAL: ${new Date().toLocaleString("es-HN", { timeZone: "America/Tegucigalpa" })}.
Cuando te pidan "hoy", "ayer", "esta semana", calcula tú mismo las fechas a partir de la de arriba.

IMPORTANTE - desglose: cuando la herramienta te devuelva varios productos, ventas o
movimientos que coincidan con la pregunta, SIEMPRE desglosa cada uno por separado con su
cantidad exacta, además del total si aplica. Nunca resumas en un solo número cuando hay
más de un ítem.

IMPORTANTE - categorías: si te preguntan por un TIPO o CATEGORÍA de producto en general
(ej: "cuántas cervezas tengo", "productos de snacks", "bebidas disponibles") y no estás
seguro de cómo se llama la categoría exacta en el sistema, primero llama a
list_categories para ver las categorías reales, elegí la que mejor corresponda, y luego
usá list_products_by_category con ese nombre. Si la persona menciona un tipo de producto
que no tiene su propia categoría (por ejemplo "cerveza" cuando todo está bajo "Bebidas"),
usá la categoría más cercana disponible y aclará en tu respuesta que estás mostrando toda
esa categoría, no solo ese tipo específico, para que la persona sepa que el resultado
puede incluir otros productos relacionados.

IMPORTANTE - honestidad: si te preguntan algo para lo cual no tenés una herramienta que
calcule ese dato exacto (ej: promedios agregados de toda la tienda, rankings que ninguna
tool soporta), decilo claramente en vez de inventar un número. Podés ofrecer acercarte
con los datos que sí tenés disponibles, pero nunca falsees una cifra precisa que no
calculaste con datos reales.

Montos en Lempiras (L). Sé breve y directo en el texto alrededor de los datos, pero
nunca sacrifiques el desglose. Para listas, una línea por elemento, sin negritas de
markdown.`;

function recortarLista(lista, campos, limite = 15) {
  return lista.slice(0, limite).map((item) => {
    const recortado = {};
    for (const campo of campos) recortado[campo] = item[campo];
    return recortado;
  });
}

async function executeTool(name, args) {
  try {
    switch (name) {
      case "list_products": {
        const resultado = await listProducts(args.search ?? "");
        const productos = Array.isArray(resultado) ? resultado : resultado.productos ?? [];
        return recortarLista(productos, ["id", "sku", "nombre", "stock", "stockMinimo", "presentaciones"], 20);
      }
      case "list_low_stock_products":
        return await listLowStockProducts();
      case "list_categories":
        return await listCategories();
      case "list_products_by_category": {
        const productos = await listProductsByCategory(args.categoria);
        return recortarLista(productos, ["id", "sku", "nombre", "stock", "stockMinimo"], 30);
      }
      case "list_suppliers": {
        const resultado = await listSuppliers(args.search ?? "");
        const proveedores = Array.isArray(resultado) ? resultado : resultado.proveedores ?? [];
        return recortarLista(proveedores, ["id", "nombre", "telefono", "correo"], 20);
      }
      case "list_purchases": {
        const resultado = await listPurchases();
        const compras = Array.isArray(resultado) ? resultado : resultado.compras ?? [];
        return recortarLista(compras, ["id", "proveedor", "total", "estado", "creadoEn"], 15);
      }
      case "get_purchase":
        return await getPurchase(args.purchaseId);
      case "list_sales": {
        const resultado = await listSales(args.search ?? "");
        const ventas = Array.isArray(resultado) ? resultado : resultado.ventas ?? [];
        return recortarLista(ventas, ["id", "total", "estado", "creadoEn"], 15);
      }
      case "get_sales_report":
        return await getSalesReport(args.from, args.to);
      case "list_inventory_movements": {
        const resultado = await listInventoryMovements(args.productId);
        const movimientos = Array.isArray(resultado) ? resultado : resultado.movimientos ?? [];
        return recortarLista(movimientos, ["id", "tipo", "cantidad", "saldoPosterior", "creadoEn"], 15);
      }
      case "list_special_clients": {
        const resultado = await listSpecialClients(args.search ?? "");
        const clientes = Array.isArray(resultado) ? resultado : resultado.clientes ?? [];
        return recortarLista(clientes, ["id", "nombre", "telefono"], 20);
      }
      case "list_cash_shifts":
        return await listCashShifts(args.date);
      default:
        return { error: "Herramienta desconocida" };
    }
  } catch (err) {
    console.error(`Error en tool "${name}" con args`, args, ":", err);
    return { error: err.message ?? "Error al consultar los datos." };
  }
}

export async function transcribirAudio(base64Audio, mimeType) {
  const response = await ai.models.generateContent({
    model: MODELO,
    contents: [
      {
        role: "user",
        parts: [
          { text: "Transcribe exactamente lo que se dice en este audio. Responde solo con el texto transcrito, sin comentarios ni explicaciones adicionales." },
          { inlineData: { mimeType, data: base64Audio } },
        ],
      },
    ],
  });

  return response.text?.trim() || "";
}

export async function handleMessage(messages) {
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
  }));
  while (history.length > 0 && history[0].role === "model") history.shift();

  const chat = ai.chats.create({
    model: MODELO,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: tools }],
      thinkingConfig: { thinkingLevel: "medium" },
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