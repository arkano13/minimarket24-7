import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { registrarBitacora } from "../bitacora/bitacora.service.js";

function normalized(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new AppError("Envía entre 1 y 100 productos.", 400);
  }
  return items.map((item) => {
    const nombre = String(item?.nombre ?? "").trim().replace(/\s+/g, " ");
    const cantidad = Number(item?.cantidad);
    if (!nombre || nombre.length > 150) throw new AppError("Hay un nombre de producto no válido.", 400);
    if (!Number.isFinite(cantidad) || cantidad === 0 || Math.abs(cantidad) > 10000 || Math.round(cantidad * 1000) !== cantidad * 1000) {
      throw new AppError(`La cantidad de ${nombre} no es válida.`, 400);
    }
    return { nombre, cantidad, productoId: item?.productoId };
  });
}

async function searchableProducts() {
  return prisma.producto.findMany({
    where: { activo: true, controlaInventario: true, esCompuesto: false },
    select: { id: true, nombre: true, stockActual: true, unidadInventario: true,
      presentaciones: { where: { activo: true }, orderBy: [{ esPrincipal: "desc" }, { id: "asc" }], select: { id: true, nombre: true, esPrincipal: true, factorInventario: true } } },
    orderBy: { nombre: "asc" },
  });
}

export async function searchMobileProducts(search) {
  const term = normalized(search);
  if (term.length < 2) return { productos: [] };
  const products = await searchableProducts();
  return { productos: products.filter((product) => normalized(product.nombre).includes(term)).slice(0, 15).map((product) => {
    const presentation = product.presentaciones[0];
    const factor = presentation ? Number(presentation.factorInventario) : 1;
    return { id: product.id, nombre: product.nombre, stockActual: Number(product.stockActual) / factor,
      unidad: product.unidadInventario === "PESO" ? "lb" : "unid." };
  }) };
}

export async function previewMobileAdjustments(input) {
  const items = validateItems(input?.items);
  const products = await searchableProducts();
  return { resultados: items.map((item) => {
    const key = normalized(item.nombre);
    const exact = products.filter((p) => normalized(p.nombre) === key);
    const candidates = exact.length ? exact : products.filter((p) => normalized(p.nombre).includes(key));
    if (candidates.length !== 1) return { ...item, estado: candidates.length ? "AMBIGUO" : "NO_ENCONTRADO", coincidencias: candidates.slice(0, 8).map((p) => ({ id: p.id, nombre: p.nombre })) };
    const product = candidates[0];
    const presentation = product.presentaciones[0];
    if (!presentation) return { ...item, estado: "SIN_PRESENTACION", coincidencias: [] };
    const factor = Number(presentation.factorInventario);
    const actual = Number(product.stockActual) / factor;
    return { ...item, estado: "LISTO", productoId: product.id, nombreEncontrado: product.nombre,
      presentacion: presentation.nombre, stockActual: actual, stockNuevo: actual + item.cantidad, unidad: product.unidadInventario === "PESO" ? "lb" : "unid." };
  }) };
}

export async function applyMobileAdjustments(input, userId) {
  const items = validateItems(input?.items);
  const ids = items.map((item) => Number(item.productoId));
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) throw new AppError("La confirmación contiene productos inválidos o repetidos.", 400);
  const result = await prisma.$transaction(async (tx) => {
    const outputs = [];
    for (const item of items) {
      const product = await tx.producto.findFirst({ where: { id: Number(item.productoId), activo: true, controlaInventario: true, esCompuesto: false },
        select: { id: true, nombre: true, stockActual: true, costoPromedio: true,
          presentaciones: { where: { activo: true }, orderBy: [{ esPrincipal: "desc" }, { id: "asc" }] } } });
      if (!product || !product.presentaciones[0]) throw new AppError("Uno de los productos ya no está disponible.", 409);
      const factor = new Prisma.Decimal(product.presentaciones[0].factorInventario);
      const visible = new Prisma.Decimal(String(Math.abs(item.cantidad)));
      const delta = visible.mul(factor);
      const current = new Prisma.Decimal(product.stockActual);
      const next = item.cantidad > 0 ? current.add(delta) : current.sub(delta);
      if (next.lessThan(0)) throw new AppError(`El ajuste dejaría ${product.nombre} con inventario negativo.`, 400);
      await tx.producto.update({ where: { id: product.id }, data: { stockActual: next } });
      await tx.movimientoInventario.create({ data: { productoId: product.id, usuarioId: userId,
        tipo: item.cantidad > 0 ? "AJUSTE_POSITIVO" : "AJUSTE_NEGATIVO", cantidad: delta,
        saldoPosterior: next, costoUnitario: product.costoPromedio, motivo: "Ajuste confirmado desde inventario móvil." } });
      outputs.push({ productoId: product.id, nombre: product.nombre, cantidad: item.cantidad,
        stockAnterior: Number(current.div(factor)), stockNuevo: Number(next.div(factor)) });
    }
    return outputs;
  }, { maxWait: 10000, timeout: 60000 });
  await registrarBitacora({ usuarioId: userId, accion: "AJUSTE_INVENTARIO_MOVIL", entidad: "Inventario", detalle: { ajustes: result } });
  return { resultados: result };
}
